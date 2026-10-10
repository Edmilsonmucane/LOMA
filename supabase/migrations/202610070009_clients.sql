create extension if not exists pg_trgm with schema extensions;
create table public.clients (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),branch_id uuid not null,
 name text not null check(length(name) between 2 and 150),birth_date date,revision integer not null default 1,
 profile jsonb not null,classification text not null default 'regular' check(classification in ('regular','vip','blacklisted')),
 consent jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,tenant_id),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id)
);
create table public.client_keys (
 tenant_id uuid not null,client_id uuid not null,kind text not null check(kind in ('bi','nuit','passport','dire','phone')),value text not null,
 primary key(tenant_id,kind,value),foreign key(client_id,tenant_id) references public.clients(id,tenant_id),check(length(value) between 1 and 100)
);
create table public.client_events (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,client_id uuid not null,actor_id uuid references auth.users(id),
 kind text not null check(kind in ('created','updated','consent','note','document')),detail jsonb not null,created_at timestamptz not null default now(),
 foreign key(client_id,tenant_id) references public.clients(id,tenant_id)
);
create table public.client_documents (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,client_id uuid not null,kind text not null check(kind in ('document','photo')),
 title text not null check(length(title) between 2 and 150),filename text not null check(length(filename) between 1 and 200),path text not null unique,
 mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),size integer not null check(size between 1 and 5242880),
 expires_on date,status text not null default 'pending' check(status in ('pending','ready')),created_at timestamptz not null default now(),
 foreign key(client_id,tenant_id) references public.clients(id,tenant_id),unique(id,tenant_id)
);
create index clients_name_search on public.clients using gin(lower(name) extensions.gin_trgm_ops);
create index on public.clients(tenant_id,branch_id,created_at desc);
create index on public.client_keys(client_id,tenant_id);
create index on public.client_events(tenant_id,client_id,created_at desc);
create index on public.client_documents(tenant_id,client_id);
create function public.client_allowed(t uuid,c uuid,p text default 'clients.read') returns boolean language sql stable security definer set search_path='' as $$
 select public.has_permission(t,p) and exists(select 1 from public.clients where id=c and tenant_id=t and public.branch_allowed(t,branch_id));
$$;
alter table public.clients enable row level security;
alter table public.client_keys enable row level security;
alter table public.client_events enable row level security;
alter table public.client_documents enable row level security;
create policy clients_read on public.clients for select to authenticated using(public.has_permission(tenant_id,'clients.read') and public.branch_allowed(tenant_id,branch_id));
create policy client_keys_read on public.client_keys for select to authenticated using(public.client_allowed(tenant_id,client_id));
create policy client_events_read on public.client_events for select to authenticated using(public.client_allowed(tenant_id,client_id));
create policy client_documents_read on public.client_documents for select to authenticated using(public.client_allowed(tenant_id,client_id));
grant select on public.clients,public.client_keys,public.client_events,public.client_documents to authenticated;
create trigger client_events_immutable before update or delete on public.client_events for each row execute function public.audit_immutable();
create trigger client_events_no_truncate before truncate on public.client_events for each statement execute function public.audit_immutable();
create trigger audit_clients after insert or update on public.clients for each row execute function public.record_audit();
create function public.valid_client_profile(p jsonb,consent jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare x jsonb;k text;begin
 if jsonb_typeof(p) is distinct from 'object' or not p ?& array['identities','contacts','province','district','neighbourhood','address','activity','employer','income','expenses','references','guarantors'] then return false;end if;
 for k in select unnest(array['province','district','neighbourhood','address','activity','employer','income','expenses']) loop
  if jsonb_typeof(p->k) is distinct from 'string' or length(p->>k)>500 then return false;end if;
 end loop;
 if p->>'income' !~ '^\d+$' or p->>'expenses' !~ '^\d+$' or length(p->>'income')>19 or length(p->>'expenses')>19 then return false;end if;
 for k in select unnest(array['identities','contacts','references','guarantors']) loop if jsonb_typeof(p->k) is distinct from 'array' or jsonb_array_length(p->k)>20 then return false;end if;end loop;
 if jsonb_array_length(p->'contacts')=0 then return false;end if;
 for x in select value from jsonb_array_elements(p->'identities') loop
  if jsonb_typeof(x->'kind') is distinct from 'string' or x->>'kind' not in ('bi','nuit','passport','dire') or jsonb_typeof(x->'value') is distinct from 'string' or x->>'value' !~ '^[A-Za-z0-9][A-Za-z0-9 ./-]{1,99}$' then return false;end if;
 end loop;
 for x in select value from jsonb_array_elements(p->'contacts') loop
  if jsonb_typeof(x->'kind') is distinct from 'string' or x->>'kind' not in ('phone','email') or jsonb_typeof(x->'value') is distinct from 'string' or length(x->>'value')>150 then return false;end if;
  if x->>'kind'='phone' and x->>'value' !~ '^\+[1-9][0-9]{7,14}$' then return false;end if;
  if x->>'kind'='email' and x->>'value' !~ '^[^ @]+@[^ @]+\.[^ @]+$' then return false;end if;
 end loop;
 for k in select unnest(array['references','guarantors']) loop for x in select value from jsonb_array_elements(p->k) loop
  if jsonb_typeof(x->'name') is distinct from 'string' or length(x->>'name') not between 2 and 150 or jsonb_typeof(x->'phone') is distinct from 'string' or x->>'phone' !~ '^\+[1-9][0-9]{7,14}$' or jsonb_typeof(x->'relationship') is distinct from 'string' or length(x->>'relationship')>100 then return false;end if;
 end loop;end loop;
 if jsonb_typeof(consent) is distinct from 'object' or not consent ?& array['sms','whatsapp','email','source'] or jsonb_typeof(consent->'source') is distinct from 'string' or length(consent->>'source')>500 then return false;end if;
 for k in select unnest(array['sms','whatsapp','email']) loop if jsonb_typeof(consent->k) is distinct from 'boolean' then return false;end if;end loop;
 if (consent->>'sms')::boolean or (consent->>'whatsapp')::boolean or (consent->>'email')::boolean then if length(trim(consent->>'source'))<2 then return false;end if;end if;
 return true;
exception when others then return false;end;$$;
alter table public.clients add constraint client_profile_valid check(public.valid_client_profile(profile,consent));
create function public.save_client(t uuid,client_data jsonb,selected_client uuid default null,expected_revision integer default 0) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.clients;b uuid;cid uuid:=coalesce(selected_client,gen_random_uuid());p jsonb:=client_data->'profile';cc jsonb:=client_data->'consent';x jsonb;k text;v text;begin
 b:=(client_data->>'branch_id')::uuid;
 if not public.has_permission(t,'clients.manage') or not public.branch_allowed(t,b) then raise exception 'Access denied' using errcode='42501';end if;
 if not public.valid_client_profile(p,cc) then raise exception 'Invalid profile' using errcode='23514';end if;
 if selected_client is not null then
  select * into c from public.clients where id=selected_client and tenant_id=t for update;
  if c.id is null or not public.client_allowed(t,c.id,'clients.manage') then raise exception 'Access denied' using errcode='42501';end if;
  if c.revision<>expected_revision then raise exception 'Client changed' using errcode='PT409';end if;
  update public.clients set branch_id=b,name=client_data->>'name',birth_date=nullif(client_data->>'birth_date','')::date,profile=p,consent=cc,classification=client_data->>'classification',revision=revision+1,updated_at=now() where id=cid;
  delete from public.client_keys where client_id=cid and tenant_id=t;
 else
  if expected_revision<>0 then raise exception 'Invalid revision' using errcode='23514';end if;
  insert into public.clients(id,tenant_id,branch_id,name,birth_date,profile,consent,classification) values(cid,t,b,client_data->>'name',nullif(client_data->>'birth_date','')::date,p,cc,client_data->>'classification');
 end if;
 for x in select value from jsonb_array_elements(p->'identities') union all select value from jsonb_array_elements(p->'contacts') where value->>'kind'='phone' loop
  k:=x->>'kind';v:=case when k='phone' then x->>'value' else upper(regexp_replace(x->>'value','[^A-Za-z0-9]','','g')) end;
  insert into public.client_keys(tenant_id,client_id,kind,value) values(t,cid,k,v);
 end loop;
 insert into public.client_events(tenant_id,client_id,actor_id,kind,detail) values(t,cid,auth.uid(),case when c.id is null then 'created' else 'updated' end,jsonb_build_object('revision',coalesce(c.revision,0)+1));
 if c.id is null or c.consent is distinct from cc then insert into public.client_events(tenant_id,client_id,actor_id,kind,detail) values(t,cid,auth.uid(),'consent',jsonb_build_object('previous',c.consent,'current',cc));end if;
 return cid;
end;$$;
create function public.add_client_note(t uuid,c uuid,note text) returns uuid language plpgsql security definer set search_path='' as $$
declare nid uuid;begin
 if not public.client_allowed(t,c,'clients.manage') then raise exception 'Access denied' using errcode='42501';end if;
 if length(trim(note)) not between 2 and 2000 then raise exception 'Invalid note' using errcode='23514';end if;
 insert into public.client_events(tenant_id,client_id,actor_id,kind,detail) values(t,c,auth.uid(),'note',jsonb_build_object('note',trim(note))) returning id into nid;return nid;
end;$$;
create function public.search_clients(t uuid,query text default '',selected_class text default '',selected_branch uuid default null,page_offset integer default 0,page_size integer default 50) returns setof public.clients language sql stable security invoker set search_path='' as $$
 select c.* from public.clients c where tenant_id=t and (selected_class='' or classification=selected_class) and (selected_branch is null or branch_id=selected_branch)
 and (query='' or strpos(lower(c.name),lower(query))>0 or exists(select 1 from public.client_keys k where k.client_id=c.id and k.tenant_id=t and strpos(lower(k.value),lower(regexp_replace(query,'[^A-Za-z0-9+]','','g')))>0 and length(regexp_replace(query,'[^A-Za-z0-9+]','','g'))>0))
 order by c.name,c.id limit greatest(1,least(page_size,100)) offset greatest(0,page_offset);
$$;
create function public.import_clients(t uuid,rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare x jsonb;results jsonb:='[]';cid uuid;begin
 if not public.has_permission(t,'clients.manage') then raise exception 'Access denied' using errcode='42501';end if;
 if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>1000 then raise exception 'Invalid batch' using errcode='23514';end if;
 for x in select value from jsonb_array_elements(rows) loop
  begin cid:=public.save_client(t,x->'data');results:=results||jsonb_build_array(jsonb_build_object('row',x->'row','id',cid,'error',null));
  exception when unique_violation then results:=results||jsonb_build_array(jsonb_build_object('row',x->'row','error','duplicate'));
  when insufficient_privilege then results:=results||jsonb_build_array(jsonb_build_object('row',x->'row','error','denied'));
  when check_violation or invalid_text_representation or datetime_field_overflow or foreign_key_violation then results:=results||jsonb_build_array(jsonb_build_object('row',x->'row','error','invalid'));
  end;
 end loop;return results;
end;$$;
revoke all on function public.client_allowed(uuid,uuid,text),public.valid_client_profile(jsonb,jsonb),public.save_client(uuid,jsonb,uuid,integer),public.add_client_note(uuid,uuid,text),public.search_clients(uuid,text,text,uuid,integer,integer),public.import_clients(uuid,jsonb) from public,anon;
grant execute on function public.client_allowed(uuid,uuid,text),public.save_client(uuid,jsonb,uuid,integer),public.add_client_note(uuid,uuid,text),public.search_clients(uuid,text,text,uuid,integer,integer),public.import_clients(uuid,jsonb) to authenticated;
