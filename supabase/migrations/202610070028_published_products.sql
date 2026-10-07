-- A pending draft does not withdraw the previous published version; only archiving does.
-- Reject a product changed between preview and saving, inside the same write boundary.
create or replace function public.save_application(t uuid,input jsonb,selected_application uuid default null,expected_revision integer default 0) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.applications;c public.clients;v public.product_versions;pid uuid;pv integer;aid uuid:=coalesce(selected_application,gen_random_uuid());amount numeric;count_periods integer;begin
 if not public.has_permission(t,'applications.manage') then raise exception 'Access denied' using errcode='42501';end if;
 select * into c from public.clients where id=(input->>'client_id')::uuid and tenant_id=t for share;
 if c.id is null or not public.client_allowed(t,c.id,'applications.manage') then raise exception 'Access denied' using errcode='42501';end if;
 select id,active_version into pid,pv from public.products where id=(input->>'product_id')::uuid and tenant_id=t and status<>'archived' and active_version is not null;
 select * into v from public.product_versions where product_id=pid and version=pv and tenant_id=t;
 if v.id is null then raise exception 'Active product required' using errcode='23514';end if;
 if input ? 'product_version_id' and (input->>'product_version_id') is distinct from v.id::text then raise exception 'Product version changed' using errcode='PT409';end if;
 amount:=(input->>'principal')::numeric;count_periods:=(input->>'periods')::integer;
 if amount not between (v.terms->>'minPrincipal')::numeric and (v.terms->>'maxPrincipal')::numeric or count_periods not between (v.terms->>'minPeriods')::integer and (v.terms->>'maxPeriods')::integer or jsonb_typeof(input->'guarantees') is distinct from 'array' then raise exception 'Invalid conditions' using errcode='23514';end if;
 if selected_application is not null then
 select * into a from public.applications where id=aid and tenant_id=t for update;
 if a.id is null or not public.branch_allowed(t,a.branch_id) then raise exception 'Access denied' using errcode='42501';end if;
 if a.revision<>expected_revision then raise exception 'Application changed' using errcode='PT409';end if;
 if a.status<>'draft' then raise exception 'Draft required' using errcode='23514';end if;
 update public.applications set client_id=c.id,branch_id=c.branch_id,product_version_id=v.id,principal=input->>'principal',periods=count_periods,start_date=(input->>'start_date')::date,purpose=input->>'purpose',guarantees=array(select jsonb_array_elements_text(input->'guarantees')),revision=revision+1,updated_at=now() where id=aid;
 else
 if expected_revision<>0 then raise exception 'Invalid revision' using errcode='23514';end if;
 insert into public.applications(id,tenant_id,client_id,branch_id,product_version_id,principal,periods,start_date,purpose,guarantees,created_by) values(aid,t,c.id,c.branch_id,v.id,input->>'principal',count_periods,(input->>'start_date')::date,input->>'purpose',array(select jsonb_array_elements_text(input->'guarantees')),auth.uid());
 end if;
 insert into public.application_events(tenant_id,application_id,branch_id,actor_id,actor_name,status,detail) values(t,aid,c.branch_id,auth.uid(),coalesce((select display_name from public.memberships where tenant_id=t and user_id=auth.uid()),'Administração'),'draft',input->>'purpose');
 return aid;
end;$$;

-- Preserve submitted versions; require renewed analysis when the published product changes.
create or replace function public.transition_application(t uuid,a_id uuid,expected_revision integer,next_status text,note text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare a public.applications;c public.clients;v public.product_versions;brand public.tenants;required_role text;actor_role text;template jsonb;cid uuid;d text;begin
 if not public.has_permission(t,'applications.manage') then raise exception 'Access denied' using errcode='42501';end if;
 select * into a from public.applications where id=a_id and tenant_id=t for update;
 if a.id is null or not public.branch_allowed(t,a.branch_id) then raise exception 'Access denied' using errcode='42501';end if;
 if a.revision<>expected_revision then raise exception 'Application changed' using errcode='PT409';end if;
 if note is null or length(note)>4000 then raise exception 'Invalid opinion' using errcode='23514';end if;
 if not ((a.status='draft' and next_status='submitted') or (a.status='submitted' and next_status in ('in_review','draft')) or (a.status='in_review' and next_status in ('in_review','approved','declined','draft')) or (a.status in ('draft','submitted','in_review','approved') and next_status='cancelled')) then raise exception 'Invalid transition' using errcode='23514';end if;
 if next_status in ('approved','declined') then
 if a.created_by=auth.uid() then raise exception 'Creator cannot decide' using errcode='42501';end if;
 select * into v from public.product_versions where id=a.product_version_id and tenant_id=t;
 select level->>'role' into required_role from jsonb_array_elements(v.terms->'approvalLevels') level where (level->>'upTo')::numeric>=a.principal::numeric order by (level->>'upTo')::numeric limit 1;
 select r.key into actor_role from public.memberships m join public.tenant_roles r on r.id=m.role_id and r.tenant_id=m.tenant_id where m.tenant_id=t and m.user_id=auth.uid() and m.active;
 if required_role is null or (actor_role is distinct from required_role and actor_role is distinct from 'manager') or length(trim(note))<2 then raise exception 'Decision not authorised' using errcode='42501';end if;
 end if;
 if next_status='approved' then
 if not exists(select 1 from public.products p where p.id=v.product_id and p.tenant_id=t and p.status<>'archived' and p.active_version=v.version) then raise exception 'Product version changed; revise draft' using errcode='PT409';end if;
 select * into c from public.clients where id=a.client_id and tenant_id=t for share;
 if not public.branch_allowed(t,c.branch_id) then raise exception 'Access denied' using errcode='42501';end if;
 if (v.terms->'requirements'->>'minIncome') is not null and (c.profile->>'income')::numeric<(v.terms->'requirements'->>'minIncome')::numeric then raise exception 'Income requirement' using errcode='23514';end if;
 if (v.terms->'requirements'->>'minAge') is not null and (c.birth_date is null or extract(year from age(a.start_date,c.birth_date))<(v.terms->'requirements'->>'minAge')::integer) then raise exception 'Age requirement' using errcode='23514';end if;
 for d in select jsonb_array_elements_text(v.terms->'requirements'->'documents') loop
 if not exists(select 1 from public.client_documents where tenant_id=t and client_id=c.id and status='ready' and lower(trim(title))=lower(trim(d)) and (expires_on is null or expires_on>=a.start_date)) then raise exception 'Required document missing' using errcode='23514';end if;end loop;
 if not array(select jsonb_array_elements_text(v.terms->'requirements'->'guarantees')) <@ a.guarantees then raise exception 'Guarantee missing' using errcode='23514';end if;
 select * into brand from public.tenants where id=t;
 select value into template from public.tenant_configuration where tenant_id=t and category='document' and key='contract';
 if template is null or jsonb_typeof(template->'body') is distinct from 'string' or length(trim(template->>'body'))<2 then raise exception 'Configure contract template' using errcode='23514';end if;
 insert into public.contracts(tenant_id,application_id,branch_id,approved_by,snapshot) values(t,a.id,a.branch_id,auth.uid(),jsonb_build_object('principal',a.principal,'periods',a.periods,'startDate',a.start_date,'terms',v.terms,'productName',v.name,'productVersion',v.version,'client',jsonb_build_object('name',c.name,'birthDate',c.birth_date,'profile',c.profile),'brand',jsonb_build_object('name',brand.name,'legalName',brand.legal_name,'license',brand.license_number,'contact',brand.contact_phone,'footer',brand.footer,'currency',brand.currency),'template',template,'purpose',a.purpose,'guarantees',to_jsonb(a.guarantees))) returning id into cid;
 end if;
 update public.applications set status=next_status,opinion=case when next_status in ('in_review','approved','declined') then note else opinion end,decision_reason=case when next_status='declined' then note else decision_reason end,decided_by=case when next_status in ('approved','declined') then auth.uid() else decided_by end,revision=revision+1,updated_at=now() where id=a.id;
 insert into public.application_events(tenant_id,application_id,branch_id,actor_id,actor_name,status,detail) values(t,a.id,a.branch_id,auth.uid(),coalesce((select display_name from public.memberships where tenant_id=t and user_id=auth.uid()),'Administração'),next_status,note);
 return coalesce(cid,a.id);
end;$$;
