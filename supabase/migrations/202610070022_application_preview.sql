-- Reject a product changed between preview and saving, inside the same write boundary.
create or replace function public.save_application(t uuid,input jsonb,selected_application uuid default null,expected_revision integer default 0) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.applications;c public.clients;v public.product_versions;pid uuid;pv integer;aid uuid:=coalesce(selected_application,gen_random_uuid());amount numeric;count_periods integer;begin
 if not public.has_permission(t,'applications.manage') then raise exception 'Access denied' using errcode='42501';end if;
 select * into c from public.clients where id=(input->>'client_id')::uuid and tenant_id=t for share;
 if c.id is null or not public.client_allowed(t,c.id,'applications.manage') then raise exception 'Access denied' using errcode='42501';end if;
 select id,active_version into pid,pv from public.products where id=(input->>'product_id')::uuid and tenant_id=t and status='active';
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
