create schema portal_private;
revoke all on schema portal_private from public,anon,authenticated;
create table portal_private.request_key(id boolean primary key default true check(id),secret text not null);
insert into portal_private.request_key(secret) values(encode(extensions.gen_random_bytes(32),'hex'));
create table portal_private.rate_limits(tenant_id uuid not null references public.tenants(id),kind text not null,key text not null,started_at timestamptz not null default now(),count integer not null default 1,primary key(tenant_id,kind,key));
create table portal_private.auth_codes(id uuid primary key default gen_random_uuid(),phone text not null,code text not null,created_at timestamptz not null default now(),logged_at timestamptz);
alter table portal_private.request_key enable row level security;
alter table portal_private.rate_limits enable row level security;
alter table portal_private.auth_codes enable row level security;
create function public.console_sms_hook(event jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin
 insert into portal_private.auth_codes(phone,code) values(event->'user'->>'phone',event->'sms'->>'otp');
 return '{}'::jsonb;
end;$$;
revoke all on function public.console_sms_hook(jsonb) from public,anon,authenticated;
grant execute on function public.console_sms_hook(jsonb) to supabase_auth_admin;
-- Only this development hook is enabled by local Compose. Hosted Auth uses its supported SMS provider.
create function portal_private.defaults(t uuid) returns void language sql security definer set search_path='' as $$
 insert into public.tenant_configuration(tenant_id,category,key,value) values(t,'website','main',jsonb_build_object(
 'enabled',true,'theme','classic','title','Crédito com condições claras.','intro','Escolha o valor e o prazo. Veja quanto vai pagar antes de pedir crédito.',
 'image','', 'sections',jsonb_build_array('simulator','products','steps','faq','branches'),
 'steps',jsonb_build_array('Simule com as condições reais do produto.','Confirme o telefone e envie o pedido com os documentos.','A agência analisa o pedido e informa a decisão.'),
 'faq',jsonb_build_array(jsonb_build_object('question','A simulação garante a aprovação?','answer','Não. A agência analisa os dados e os documentos antes de decidir.'),jsonb_build_object('question','Como acompanho o pedido?','answer','Entre na Área do cliente com o seu telefone e o código SMS.')),
 'terms','As condições do crédito são apresentadas na simulação e confirmadas no contrato. O pedido está sujeito à análise da agência. O microcrédito é responsável pelos seus produtos e obrigações legais e regulatórias.',
 'privacy','Os dados enviados são usados para analisar e acompanhar o pedido. Contacte a agência para consultar os seus dados ou pedir a sua correcção.',
 'limits',jsonb_build_object('otpPerHour',5,'requestsPerDay',5,'leadsPerDay',3,'sessionHours',24))) on conflict(tenant_id,category,key) do nothing;
$$;
select portal_private.defaults(id) from public.tenants;
create function portal_private.provision() returns trigger language plpgsql security definer set search_path='' as $$begin perform portal_private.defaults(new.id);return new;end;$$;
create trigger public_site_defaults after insert on public.tenants for each row execute function portal_private.provision();
create function public.public_site(tenant_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',t.id,'slug',t.slug,'name',t.name,'accent',t.accent,'logo',t.logo_url,'phone',t.contact_phone,'license',t.license_number,'legalName',t.legal_name,'footer',t.footer,'currency',t.currency,'site',c.value,
 'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'versionId',v.id,'name',v.name,'terms',v.terms) order by v.name) from public.products p join public.product_versions v on v.product_id=p.id and v.tenant_id=p.tenant_id and v.version=p.active_version where p.tenant_id=t.id and p.status<>'archived'),'[]'::jsonb),
 'branches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'phone',t.contact_phone) order by b.name) from public.branches b where b.tenant_id=t.id),'[]'::jsonb))
 from public.tenants t join public.tenant_configuration c on c.tenant_id=t.id and c.category='website' and c.key='main' where t.slug=tenant_slug and t.active and (c.value->>'enabled')::boolean;
$$;
grant execute on function public.public_site(text) to anon,authenticated;
create function portal_private.valid_site(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare x jsonb;k text;begin
 if jsonb_typeof(v) is distinct from 'object' or not v ?& array['enabled','theme','title','intro','image','sections','steps','faq','terms','privacy','limits'] then return false;end if;
 if jsonb_typeof(v->'enabled') is distinct from 'boolean' or v->>'theme' not in ('classic','modern') then return false;end if;
 for k in select unnest(array['title','intro','image','terms','privacy']) loop if jsonb_typeof(v->k) is distinct from 'string' or length(v->>k)>10000 then return false;end if;end loop;
 if length(trim(v->>'title')) not between 2 and 150 or length(trim(v->>'intro')) not between 2 and 1000 or length(trim(v->>'terms'))<2 or length(trim(v->>'privacy'))<2 or (v->>'image'<>'' and v->>'image' !~ '^https://[^ @]+$') then return false;end if;
 if jsonb_typeof(v->'sections') is distinct from 'array' or jsonb_array_length(v->'sections')<>5 or (select count(distinct value) from jsonb_array_elements_text(v->'sections'))<>5 then return false;end if;
 for x in select value from jsonb_array_elements(v->'sections') loop if x#>>'{}' not in ('simulator','products','steps','faq','branches') then return false;end if;end loop;
 if jsonb_typeof(v->'steps') is distinct from 'array' or jsonb_array_length(v->'steps') not between 1 and 8 or jsonb_typeof(v->'faq') is distinct from 'array' or jsonb_array_length(v->'faq')>20 then return false;end if;
 for x in select value from jsonb_array_elements(v->'steps') loop if jsonb_typeof(x) is distinct from 'string' or length(x#>>'{}') not between 2 and 500 then return false;end if;end loop;
 for x in select value from jsonb_array_elements(v->'faq') loop if jsonb_typeof(x->'question') is distinct from 'string' or jsonb_typeof(x->'answer') is distinct from 'string' or length(x->>'question') not between 2 and 300 or length(x->>'answer') not between 2 and 2000 then return false;end if;end loop;
 for k in select unnest(array['otpPerHour','requestsPerDay','leadsPerDay','sessionHours']) loop if jsonb_typeof(v->'limits'->k) is distinct from 'number' or v->'limits'->>k !~ '^\d+$' or (v->'limits'->>k)::int not between 1 and 100 then return false;end if;end loop;
 return true;exception when others then return false;end;$$;
create function portal_private.site_guard() returns trigger language plpgsql set search_path='' as $$begin
 if new.category='website' and (new.key<>'main' or not portal_private.valid_site(new.value)) then raise exception 'Invalid site' using errcode='23514';end if;return new;
end;$$;
create trigger site_config_guard before insert or update on public.tenant_configuration for each row execute function portal_private.site_guard();
create function public.save_public_site(t uuid,settings jsonb,expected jsonb) returns void language plpgsql security definer set search_path='' as $$declare old jsonb;begin
 if not public.has_permission(t,'tenant.manage') then raise exception 'Access denied' using errcode='42501';end if;
 select value into old from public.tenant_configuration where tenant_id=t and category='website' and key='main' for update;
 if old is distinct from expected then raise exception 'Site changed' using errcode='PT409';end if;
 if not portal_private.valid_site(settings) then raise exception 'Invalid site' using errcode='23514';end if;
 update public.tenant_configuration set value=settings where tenant_id=t and category='website' and key='main';
end;$$;
revoke all on function public.save_public_site(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_public_site(uuid,jsonb,jsonb) to authenticated;
create function portal_private.rate(t uuid,k text,v text,maximum integer,seconds integer) returns void language plpgsql security definer set search_path='' as $$declare r portal_private.rate_limits;begin
 insert into portal_private.rate_limits(tenant_id,kind,key) values(t,k,v) on conflict do nothing;
 select * into r from portal_private.rate_limits where tenant_id=t and kind=k and key=v for update;
 if r.started_at+make_interval(secs=>seconds)<now() then update portal_private.rate_limits set count=1,started_at=now() where tenant_id=t and kind=k and key=v;
 elsif r.count>=maximum then raise exception 'Rate limit' using errcode='PT429';
 else update portal_private.rate_limits set count=count+1 where tenant_id=t and kind=k and key=v;end if;
end;$$;
create function portal_private.verify_request(t uuid,context text,signature text,action text) returns jsonb language plpgsql security definer set search_path='' as $$declare v jsonb;secret text;cfg jsonb;maximum integer;begin
 select k.secret into secret from portal_private.request_key k where id;
 if signature is null or signature<>encode(extensions.hmac(convert_to(context,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex') then raise exception 'Access denied' using errcode='42501';end if;
 v:=context::jsonb;
 if v->>'tenant' is distinct from t::text or v->>'action' is distinct from action or abs(extract(epoch from now())-(v->>'time')::numeric)>60 or length(v->>'ip')<>64 then raise exception 'Access denied' using errcode='42501';end if;
 select value into cfg from public.tenant_configuration where tenant_id=t and category='website' and key='main';
 if cfg is null or not (cfg->>'enabled')::boolean or not exists(select 1 from public.tenants where id=t and active) then raise exception 'Access denied' using errcode='42501';end if;
 maximum:=(cfg->'limits'->>case action when 'otp' then 'otpPerHour' when 'lead' then 'leadsPerDay' else 'requestsPerDay' end)::int;
 perform portal_private.rate(t,action||':ip',v->>'ip',maximum*5,case when action='otp' then 3600 else 86400 end);
 perform portal_private.rate(t,action||':phone',v->>'phone',maximum,case when action='otp' then 3600 else 86400 end);
 return v;
end;$$;
create function public.public_request_gate(t uuid,context text,signature text) returns void language plpgsql security definer set search_path='' as $$begin perform portal_private.verify_request(t,context,signature,'otp');end;$$;
grant execute on function public.public_request_gate(uuid,text,text) to anon,authenticated;
create table public.customer_accounts(tenant_id uuid not null references public.tenants(id),user_id uuid not null references auth.users(id),client_id uuid not null,created_at timestamptz not null default now(),primary key(tenant_id,user_id),unique(tenant_id,client_id),foreign key(client_id,tenant_id) references public.clients(id,tenant_id));
create table public.portal_drafts(id uuid primary key,tenant_id uuid not null references public.tenants(id),user_id uuid not null references auth.users(id),client_id uuid not null,branch_id uuid not null,product_version_id uuid not null,data jsonb not null,revision integer not null default 1,application_id uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,tenant_id),unique(tenant_id,application_id),foreign key(client_id,tenant_id) references public.clients(id,tenant_id),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id),foreign key(product_version_id,tenant_id) references public.product_versions(id,tenant_id),foreign key(application_id,tenant_id) references public.applications(id,tenant_id));
alter table public.customer_accounts enable row level security;
alter table public.portal_drafts enable row level security;
create function portal_private.phone(t uuid) returns text language plpgsql stable security definer set search_path='' as $$declare ph text;cfg jsonb;begin
 select u.phone into ph from auth.users u join auth.sessions s on s.user_id=u.id and s.id=(auth.jwt()->>'session_id')::uuid join public.tenants x on x.id=t and x.active join public.tenant_configuration c on c.tenant_id=t and c.category='website' and c.key='main' where u.id=auth.uid() and u.phone_confirmed_at is not null and (c.value->>'enabled')::boolean and s.created_at+make_interval(hours=>(c.value->'limits'->>'sessionHours')::int)>now();
 if ph is null then raise exception 'Phone verification required' using errcode='42501';end if;return '+'||ltrim(ph,'+');end;$$;
create function public.customer_owns(t uuid,c uuid) returns boolean language plpgsql stable security definer set search_path='' as $$begin
 perform portal_private.phone(t);return exists(select 1 from public.customer_accounts where tenant_id=t and client_id=c and user_id=auth.uid());
 exception when insufficient_privilege then return false;end;$$;
revoke all on function public.customer_owns(uuid,uuid) from public,anon;
grant execute on function public.customer_owns(uuid,uuid) to authenticated;
create policy accounts_self on public.customer_accounts for select to authenticated using(public.customer_owns(tenant_id,client_id));
create policy drafts_read on public.portal_drafts for select to authenticated using((user_id=auth.uid() and public.customer_owns(tenant_id,client_id)) or (application_id is not null and public.has_permission(tenant_id,'applications.read') and public.branch_allowed(tenant_id,branch_id)));
grant select on public.customer_accounts,public.portal_drafts to authenticated;
create trigger audit_customer_account after insert on public.customer_accounts for each row execute function public.record_audit();
create trigger audit_portal_draft after insert or update on public.portal_drafts for each row execute function public.record_audit();
create function public.customer_enter(t uuid) returns uuid language plpgsql security definer set search_path='' as $$declare ph text;c uuid;begin
 ph:=portal_private.phone(t);
 select client_id into c from public.customer_accounts where tenant_id=t and user_id=auth.uid();if c is not null then return c;end if;
 -- Only the primary phone can establish the first link. Other contacts do not confer ownership.
 select id into c from public.clients where tenant_id=t and profile->'contacts'->0->>'kind'='phone' and profile->'contacts'->0->>'value'=ph;
 if c is not null then insert into public.customer_accounts(tenant_id,user_id,client_id) values(t,auth.uid(),c) on conflict(tenant_id,user_id) do nothing;end if;return c;
end;$$;
create function public.customer_save_draft(t uuid,d_id uuid,input jsonb,expected_revision integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$declare ph text;c uuid;cl public.clients;d public.portal_drafts;v public.product_versions;p jsonb;cc jsonb;x jsonb;k text;keyval text;b uuid;begin
 ph:=portal_private.phone(t);c:=public.customer_enter(t);
 select * into d from public.portal_drafts where id=d_id and tenant_id=t for update;
 if exists(select 1 from public.portal_drafts where id=d_id and (tenant_id<>t or user_id<>auth.uid())) or (d.id is not null and (d.user_id<>auth.uid() or d.application_id is not null or d.revision<>expected_revision)) or (d.id is null and expected_revision<>0) then raise exception 'Draft changed' using errcode='PT409';end if;
 b:=(input->>'branch_id')::uuid;
 if not exists(select 1 from public.branches where id=b and tenant_id=t) then raise exception 'Invalid branch' using errcode='23514';end if;
 select v1.* into v from public.product_versions v1 join public.products pr on pr.id=v1.product_id and pr.tenant_id=t and pr.status<>'archived' and pr.active_version=v1.version where v1.id=(input->>'product_version_id')::uuid and v1.tenant_id=t;
 if v.id is null then raise exception 'Product changed' using errcode='PT409';end if;
 p:=input->'profile';cc:=jsonb_build_object('sms',false,'whatsapp',false,'email',false,'source','');
 p:=p||jsonb_build_object('contacts',jsonb_build_array(jsonb_build_object('kind','phone','value',ph)));
 if not public.valid_client_profile(p,cc) or length(trim(input->>'name')) not between 2 and 150 or input->>'principal' !~ '^\d+$' or (input->>'principal')::numeric not between (v.terms->>'minPrincipal')::numeric and (v.terms->>'maxPrincipal')::numeric or (input->>'periods')::int not between (v.terms->>'minPeriods')::int and (v.terms->>'maxPeriods')::int or length(trim(input->>'purpose')) not between 2 and 2000 or jsonb_typeof(input->'guarantees') is distinct from 'array' or nullif(input->>'birth_date','')::date>current_date then raise exception 'Invalid draft' using errcode='23514';end if;
 if c is null then
 c:=gen_random_uuid();
 insert into public.clients(id,tenant_id,branch_id,name,birth_date,profile,consent) values(c,t,b,input->>'name',nullif(input->>'birth_date','')::date,p,cc);
 for x in select value from jsonb_array_elements(p->'identities') union all select jsonb_build_object('kind','phone','value',ph) loop k:=x->>'kind';keyval:=case when k='phone' then ph else upper(regexp_replace(x->>'value','[^A-Za-z0-9]','','g')) end;insert into public.client_keys(tenant_id,client_id,kind,value) values(t,c,k,keyval);end loop;
 insert into public.customer_accounts(tenant_id,user_id,client_id) values(t,auth.uid(),c);
 insert into public.client_events(tenant_id,client_id,actor_id,kind,detail) values(t,c,auth.uid(),'created',jsonb_build_object('revision',1));
 end if;
 -- Identity collisions with another client require staff review, never automatic linking.
 if exists(select 1 from jsonb_array_elements(p->'identities') x join public.client_keys ck on ck.tenant_id=t and ck.kind=x->>'kind' and ck.value=upper(regexp_replace(x->>'value','[^A-Za-z0-9]','','g')) where ck.client_id<>c) then raise exception 'Duplicate identity' using errcode='23505';end if;
 input:=input||jsonb_build_object('profile',p);
 insert into public.portal_drafts(id,tenant_id,user_id,client_id,branch_id,product_version_id,data) values(d_id,t,auth.uid(),c,b,v.id,input) on conflict(id) do update set branch_id=excluded.branch_id,product_version_id=excluded.product_version_id,data=excluded.data,revision=public.portal_drafts.revision+1,updated_at=now();
 return jsonb_build_object('id',d_id,'revision',coalesce(d.revision,0)+1,'client',c);
end;$$;
create function public.customer_submit(t uuid,d_id uuid,expected_revision integer,context text,signature text) returns uuid language plpgsql security definer set search_path='' as $$declare d public.portal_drafts;v public.product_versions;aid uuid;ph text;req jsonb;begin
 ph:=portal_private.phone(t);select * into d from public.portal_drafts where id=d_id and tenant_id=t for update;
 if d.id is null or d.user_id<>auth.uid() or not public.customer_owns(t,d.client_id) then raise exception 'Access denied' using errcode='42501';end if;
 if d.application_id is not null then return d.application_id;end if;
 if d.revision<>expected_revision then raise exception 'Draft changed' using errcode='PT409';end if;
 req:=portal_private.verify_request(t,context,signature,'submit');if req->>'phone' is distinct from ph then raise exception 'Access denied' using errcode='42501';end if;
 select pv.* into v from public.product_versions pv join public.products p on p.id=pv.product_id and p.tenant_id=t and p.status<>'archived' and p.active_version=pv.version where pv.id=d.product_version_id and pv.tenant_id=t;
 if v.id is null then raise exception 'Product changed' using errcode='PT409';end if;
 if exists(select 1 from jsonb_array_elements_text(v.terms->'requirements'->'documents') required where not exists(select 1 from public.client_documents cd where cd.tenant_id=t and cd.client_id=d.client_id and cd.status='ready' and lower(trim(cd.title))=lower(trim(required)) and (cd.expires_on is null or cd.expires_on>=current_date))) then raise exception 'Documents required' using errcode='PT422';end if;
 aid:=d.id;
 insert into public.applications(id,tenant_id,client_id,branch_id,product_version_id,principal,periods,start_date,purpose,guarantees,status,created_by) values(aid,t,d.client_id,d.branch_id,v.id,d.data->>'principal',(d.data->>'periods')::int,(now() at time zone 'Africa/Maputo')::date,d.data->>'purpose',array(select jsonb_array_elements_text(d.data->'guarantees')),'submitted',auth.uid());
 insert into public.application_events(tenant_id,application_id,branch_id,actor_id,actor_name,status,detail) values(t,aid,d.branch_id,auth.uid(),d.data->>'name','submitted','Pedido enviado pelo site.');
 update public.portal_drafts set application_id=aid,revision=revision+1,updated_at=now() where id=d.id;
 update public.leads set client_id=d.client_id,status='submitted',revision=revision+1 where tenant_id=t and phone=ph;
 return aid;
end;$$;
create function public.customer_reserve_document(t uuid,d_id uuid,metadata jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare d public.portal_drafts;doc public.client_documents;begin
 perform portal_private.phone(t);select * into d from public.portal_drafts where id=d_id and tenant_id=t and user_id=auth.uid();
 if d.id is null or d.application_id is not null or not public.customer_owns(t,d.client_id) then raise exception 'Access denied' using errcode='42501';end if;
 if (select count(*) from public.client_documents where tenant_id=t and client_id=d.client_id)>100 then raise exception 'Limit' using errcode='PT429';end if;
 insert into public.client_documents(tenant_id,client_id,kind,title,filename,path,mime_type,size,expires_on) values(t,d.client_id,'document',metadata->>'title',metadata->>'filename',t::text||'/'||d.client_id::text||'/'||gen_random_uuid()::text,metadata->>'mime_type',(metadata->>'size')::int,nullif(metadata->>'expires_on','')::date) returning * into doc;
 return jsonb_build_object('id',doc.id,'path',doc.path);
end;$$;
create function public.customer_object_allowed(object_path text,upload boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.client_documents cd where cd.path=object_path and public.customer_owns(cd.tenant_id,cd.client_id) and (not upload or (cd.status='pending' and exists(select 1 from public.portal_drafts d where d.tenant_id=cd.tenant_id and d.client_id=cd.client_id and d.user_id=auth.uid() and d.application_id is null))));
$$;
create policy customer_files_read on storage.objects for select to authenticated using(bucket_id='client-documents' and public.customer_object_allowed(name));
create policy customer_files_insert on storage.objects for insert to authenticated with check(bucket_id='client-documents' and public.customer_object_allowed(name,true));
create policy customer_files_pending_delete on storage.objects for delete to authenticated using(bucket_id='client-documents' and public.customer_object_allowed(name,true));
create function public.customer_complete_document(t uuid,did uuid) returns void language plpgsql security definer set search_path='' as $$declare d public.client_documents;begin
 select * into d from public.client_documents where id=did and tenant_id=t for update;
 if d.id is null or not public.customer_object_allowed(d.path,true) then raise exception 'Access denied' using errcode='42501';end if;
 if not exists(select 1 from storage.objects where bucket_id='client-documents' and name=d.path and (metadata->>'size')::bigint=d.size and metadata->>'mimetype'=d.mime_type) then raise exception 'Upload incomplete' using errcode='23514';end if;
 update public.client_documents set status='ready' where id=did;
 insert into public.client_events(tenant_id,client_id,actor_id,kind,detail) values(t,d.client_id,auth.uid(),'document',jsonb_build_object('title',d.title,'id',d.id));
end;$$;
create function public.customer_dashboard(t uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare c uuid;begin
 c:=public.customer_enter(t);
 return jsonb_build_object('client',c,'name',(select name from public.clients where id=c and tenant_id=t),
 'drafts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'revision',revision,'data',data)) from public.portal_drafts where tenant_id=t and user_id=auth.uid() and application_id is null),'[]'::jsonb),
 'applications',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'principal',a.principal,'periods',a.periods,'date',a.created_at,'product',v.name,'reason',case when a.status='declined' then a.decision_reason else '' end) order by a.created_at desc) from public.applications a join public.product_versions v on v.id=a.product_version_id and v.tenant_id=t where a.tenant_id=t and a.client_id=c),'[]'::jsonb),
 'documents',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'expires',expires_on)) from public.client_documents where tenant_id=t and client_id=c and status='ready'),'[]'::jsonb),
 'loans',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'status',l.status,'balance',(select coalesce(sum(li.principal+li.interest+li.fine+li.late_interest),0)::text from public.loan_instalments li where li.tenant_id=t and li.loan_id=l.id),'instalments',coalesce((select jsonb_agg(jsonb_build_object('date',i.due_date,'balance',(i.principal+i.interest+i.fine+i.late_interest)::text) order by i.due_date,i.number) from public.loan_instalments i where i.tenant_id=t and i.loan_id=l.id),'[]'::jsonb),'payments',coalesce((select jsonb_agg(jsonb_build_object('date',p.paid_on,'amount',p.amount::text,'number',p.receipt_number::text,'reversed',exists(select 1 from public.payment_reversals r where r.tenant_id=t and r.payment_id=p.id)) order by p.paid_on desc) from public.payments p where p.tenant_id=t and p.loan_id=l.id),'[]'::jsonb))) from public.loans l join public.contracts co on co.id=l.contract_id and co.tenant_id=t join public.applications a on a.id=co.application_id and a.tenant_id=t join public.loan_accounts ac on ac.loan_id=l.id and ac.tenant_id=t where l.tenant_id=t and a.client_id=c),'[]'::jsonb));
end;$$;
create function public.capture_public_lead(t uuid,input jsonb,context text,signature text) returns uuid language plpgsql security definer set search_path='' as $$declare ph text;lid uuid;v jsonb;begin
 v:=portal_private.verify_request(t,context,signature,'lead');ph:=v->>'phone';
 if ph !~ '^\+258[0-9]{9}$' or length(trim(input->>'name')) not between 2 and 150 or input->>'consent' is distinct from 'true' then raise exception 'Consent required' using errcode='23514';end if;
 insert into public.leads(tenant_id,branch_id,name,phone,origin,status,consent) values(t,(input->>'branch_id')::uuid,input->>'name',ph,'Simulador do site','simulated',jsonb_build_object('sms',true,'whatsapp',false,'email',false,'source','Autorização expressa no simulador do site')) on conflict(tenant_id,phone) do nothing returning id into lid;
 return lid;
end;$$;
grant execute on function public.capture_public_lead(uuid,jsonb,text,text) to anon,authenticated;
revoke all on all functions in schema portal_private from public,anon,authenticated;
revoke all on function public.customer_enter(uuid),public.customer_save_draft(uuid,uuid,jsonb,integer),public.customer_submit(uuid,uuid,integer,text,text),public.customer_reserve_document(uuid,uuid,jsonb),public.customer_complete_document(uuid,uuid),public.customer_dashboard(uuid),public.customer_object_allowed(text,boolean) from public,anon;
grant execute on function public.customer_enter(uuid),public.customer_save_draft(uuid,uuid,jsonb,integer),public.customer_submit(uuid,uuid,integer,text,text),public.customer_reserve_document(uuid,uuid,jsonb),public.customer_complete_document(uuid,uuid),public.customer_dashboard(uuid),public.customer_object_allowed(text,boolean) to authenticated;
notify pgrst,'reload schema';
