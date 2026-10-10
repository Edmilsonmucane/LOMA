-- Platform metadata is global; every business record is tenant-scoped.
create table public.platform_admins (user_id uuid primary key references auth.users(id));
create table public.plans (id uuid primary key default gen_random_uuid(), name text not null, limits jsonb not null, features jsonb not null default '{}');
create table public.presets (id uuid primary key default gen_random_uuid(), name text not null, configuration jsonb not null);
create table public.tenants (
 id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z][a-z0-9-]{2,39}$' and slug not in ('www','admin','app','api','platform')),
 name text not null check(length(name) between 2 and 100), accent text not null default '#0E5A4A' check(accent ~ '^#[0-9A-Fa-f]{6}$'),
 logo_url text, legal_name text not null default '', contact_phone text not null default '', license_number text not null default '', footer text not null default '',
 currency text not null default 'MZN', timezone text not null default 'Africa/Maputo',
 plan_id uuid not null references public.plans(id), active boolean not null default true,
 security jsonb not null default '{"require_mfa":false,"session_hours":12,"password_min_length":8}',
 created_at timestamptz not null default now(),
 check(security ?& array['session_hours','password_min_length','require_mfa']), check((security->>'session_hours')::int between 1 and 720), check((security->>'password_min_length')::int between 8 and 128), check(jsonb_typeof(security->'require_mfa')='boolean')
);
create table public.branches (id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),name text not null check(length(name) between 2 and 100),unique(id,tenant_id),unique(tenant_id,name));
create table public.tenant_roles (id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),key text not null,name text not null,permissions text[] not null,unique(id,tenant_id),unique(tenant_id,key));
create table public.memberships (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),user_id uuid not null references auth.users(id),
 role_id uuid not null,branch_id uuid,display_name text not null,email text not null,active boolean not null default true,
 foreign key(role_id,tenant_id) references public.tenant_roles(id,tenant_id), foreign key(branch_id,tenant_id) references public.branches(id,tenant_id),unique(tenant_id,user_id)
);
create table public.tenant_configuration (id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),category text not null,key text not null,value jsonb not null,unique(tenant_id,category,key));
create table public.audit_events (
 id bigint generated always as identity primary key,tenant_id uuid not null references public.tenants(id),branch_id uuid,
 actor_id uuid references auth.users(id),action text not null,entity text not null,entity_id text,previous jsonb,current jsonb,occurred_at timestamptz not null default now(),
 foreign key(branch_id,tenant_id) references public.branches(id,tenant_id)
);
create index on public.memberships(user_id,tenant_id);
create index on public.audit_events(tenant_id,occurred_at desc);
create index on public.branches(tenant_id);
create index on public.tenant_roles(tenant_id);
create index on public.tenant_configuration(tenant_id);

create function public.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.platform_admins where user_id=auth.uid());
$$;
create function public.tenant_session_valid(t uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tenants x join auth.sessions s on s.id=(auth.jwt()->>'session_id')::uuid
 where x.id=t and x.active and s.user_id=auth.uid()
 and s.created_at+make_interval(hours=>(x.security->>'session_hours')::int)>now()
 and (not (x.security->>'require_mfa')::boolean or auth.jwt()->>'aal'='aal2'));
$$;
create function public.has_permission(t uuid,p text) returns boolean language sql stable security definer set search_path='' as $$
 select public.tenant_session_valid(t) and (public.is_platform_admin() or exists(
 select 1 from public.memberships m join public.tenant_roles r on r.id=m.role_id and r.tenant_id=m.tenant_id
 where m.tenant_id=t and m.user_id=auth.uid() and m.active and p=any(r.permissions) and (m.branch_id is null or p not in ('tenant.manage','users.manage'))));
$$;
create function public.branch_allowed(t uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.has_permission(t,'tenant.read') and (public.is_platform_admin() or exists(select 1 from public.memberships where tenant_id=t and user_id=auth.uid() and active and (branch_id is null or branch_id=b)));
$$;

alter table public.platform_admins enable row level security;
alter table public.plans enable row level security;
alter table public.presets enable row level security;
alter table public.tenants enable row level security;
alter table public.branches enable row level security;
alter table public.tenant_roles enable row level security;
alter table public.memberships enable row level security;
alter table public.tenant_configuration enable row level security;
alter table public.audit_events enable row level security;
create policy admins_self on public.platform_admins for select to authenticated using(user_id=auth.uid());
create policy plans_read on public.plans for select to authenticated using(public.is_platform_admin() or exists(select 1 from public.memberships where user_id=auth.uid()));
create policy plans_manage on public.plans for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy presets_admin on public.presets for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy tenants_read on public.tenants for select to authenticated using(public.is_platform_admin() or public.has_permission(id,'tenant.read'));
create policy tenants_update on public.tenants for update to authenticated using(public.is_platform_admin() or public.has_permission(id,'tenant.manage')) with check(public.is_platform_admin() or public.has_permission(id,'tenant.manage'));
create policy branches_read on public.branches for select to authenticated using(public.branch_allowed(tenant_id,id));
create policy branches_write on public.branches for insert to authenticated with check(public.has_permission(tenant_id,'users.manage'));
create policy branches_update on public.branches for update to authenticated using(public.has_permission(tenant_id,'users.manage')) with check(public.has_permission(tenant_id,'users.manage'));
create policy roles_read on public.tenant_roles for select to authenticated using(public.has_permission(tenant_id,'tenant.read'));
create policy roles_update on public.tenant_roles for update to authenticated using(public.has_permission(tenant_id,'users.manage')) with check(public.has_permission(tenant_id,'users.manage'));
create policy members_read on public.memberships for select to authenticated using(public.tenant_session_valid(tenant_id) and (user_id=auth.uid() or (public.has_permission(tenant_id,'users.manage') and public.branch_allowed(tenant_id,branch_id))));
create policy members_insert on public.memberships for insert to authenticated with check(public.has_permission(tenant_id,'users.manage') and public.branch_allowed(tenant_id,branch_id));
create policy members_update on public.memberships for update to authenticated using(public.has_permission(tenant_id,'users.manage') and public.branch_allowed(tenant_id,branch_id)) with check(public.has_permission(tenant_id,'users.manage') and public.branch_allowed(tenant_id,branch_id));
create policy config_read on public.tenant_configuration for select to authenticated using(public.has_permission(tenant_id,'tenant.read'));
create policy config_insert on public.tenant_configuration for insert to authenticated with check(public.has_permission(tenant_id,'tenant.manage'));
create policy config_update on public.tenant_configuration for update to authenticated using(public.has_permission(tenant_id,'tenant.manage')) with check(public.has_permission(tenant_id,'tenant.manage'));
create policy audit_read on public.audit_events for select to authenticated using(public.has_permission(tenant_id,'audit.read') and public.branch_allowed(tenant_id,branch_id));

-- Public tenant discovery exposes branding only, never business configuration or membership.
create function public.resolve_tenant(tenant_slug text) returns table(id uuid,slug text,name text,accent text,logo_url text,require_mfa boolean,password_min_length integer) language sql stable security definer set search_path='' as $$
 select t.id,t.slug,t.name,t.accent,t.logo_url,(t.security->>'require_mfa')::boolean,(t.security->>'password_min_length')::int from public.tenants t where t.slug=tenant_slug and t.active;
$$;

create function public.record_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare old_row jsonb; new_row jsonb; row_value jsonb; t uuid;
begin
 old_row:=case when tg_op='INSERT' then null else to_jsonb(old) end;
 new_row:=case when tg_op='DELETE' then null else to_jsonb(new) end;
 row_value:=coalesce(new_row,old_row); t:=case when tg_table_name='tenants' then (row_value->>'id')::uuid else (row_value->>'tenant_id')::uuid end;
 insert into public.audit_events(tenant_id,branch_id,actor_id,action,entity,entity_id,previous,current)
 values(t,(row_value->>'branch_id')::uuid,auth.uid(),lower(tg_op),tg_table_name,row_value->>'id',old_row,new_row);
 return coalesce(new,old);
end; $$;
create function public.audit_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Audit records are immutable' using errcode='42501'; end;$$;
create trigger immutable_audit before update or delete on public.audit_events for each row execute function public.audit_immutable();
create trigger immutable_audit_truncate before truncate on public.audit_events for each statement execute function public.audit_immutable();

create function public.guard_business_record() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id<>old.id or to_jsonb(new)->>'tenant_id' is distinct from to_jsonb(old)->>'tenant_id') then raise exception 'Record identity cannot change' using errcode='42501'; end if;
 if tg_table_name='tenants' then
 if tg_op='UPDATE' and not public.is_platform_admin() and auth.uid() is not null and (new.plan_id<>old.plan_id or new.slug<>old.slug or new.active<>old.active) then raise exception 'Platform administration required' using errcode='42501';end if;
 end if;
 if tg_table_name='tenant_roles' then
 if tg_op='UPDATE' and new.key<>old.key then raise exception 'Role identity cannot change' using errcode='42501';end if;
 if new.key='manager' and not array['tenant.read','tenant.manage','users.manage'] <@ new.permissions then raise exception 'Manager access must be retained' using errcode='42501';end if;
 end if;
 if tg_table_name='memberships' then
  perform 1 from public.tenants where id=new.tenant_id for update;
  if new.active and (tg_op='INSERT' or (tg_op='UPDATE' and not old.active)) and (select count(*) from public.memberships where tenant_id=new.tenant_id and active)>=(select (p.limits->>'users')::int from public.plans p join public.tenants t on t.plan_id=p.id where t.id=new.tenant_id) then raise exception 'User limit reached' using errcode='23514';end if;
  if tg_op='UPDATE' and old.user_id<>new.user_id then raise exception 'Membership user cannot change' using errcode='42501';end if;
  if tg_op='UPDATE' and old.active and (not new.active or old.role_id<>new.role_id or new.branch_id is not null) and exists(select 1 from public.tenant_roles where id=old.role_id and key='manager') and not exists(select 1 from public.memberships m join public.tenant_roles r on r.id=m.role_id where m.tenant_id=old.tenant_id and m.id<>old.id and m.active and m.branch_id is null and r.key='manager') then raise exception 'Last manager must be retained' using errcode='23514';end if;
 end if;
 return new;
end;$$;
do $$declare tbl text;begin foreach tbl in array array['tenants','branches','tenant_roles','memberships','tenant_configuration'] loop
 execute format('create trigger protect_record before insert or update on public.%I for each row execute function public.guard_business_record()',tbl);
 execute format('create trigger audit_record after insert or update or delete on public.%I for each row execute function public.record_audit()',tbl);
end loop;end;$$;

create function public.provision_tenant(tenant_name text,tenant_slug text,preset_id uuid,selected_plan_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare t uuid; config jsonb; r jsonb; row_value jsonb; manager_role uuid;
begin
 if not public.is_platform_admin() then raise exception 'Platform administration required' using errcode='42501';end if;
 select configuration into strict config from public.presets where id=preset_id;
 insert into public.tenants(name,slug,plan_id) values(tenant_name,tenant_slug,selected_plan_id) returning id into t;
 insert into public.branches(tenant_id,name) values(t,'Sede');
 for r in select * from jsonb_array_elements(config->'roles') loop
 insert into public.tenant_roles(tenant_id,key,name,permissions) values(t,r->>'key',r->>'name',array(select jsonb_array_elements_text(r->'permissions'))) returning id into manager_role;
 if r->>'key'='manager' then
 insert into public.memberships(tenant_id,user_id,role_id,display_name,email) select t,auth.uid(),manager_role,coalesce(raw_user_meta_data->>'name',email),email from auth.users where id=auth.uid();end if;
 end loop;
 for row_value in select * from jsonb_array_elements(config->'products') loop
 insert into public.tenant_configuration(tenant_id,category,key,value) values(t,'product',row_value->>'key',row_value);end loop;
 for row_value in select * from jsonb_array_elements(config->'messages') loop
 insert into public.tenant_configuration(tenant_id,category,key,value) values(t,'message',row_value->>'key',row_value);end loop;
 insert into public.tenant_configuration(tenant_id,category,key,value) values(t,'site','home',config->'site');
 return t;
end;$$;
create function public.log_access(t uuid) returns void language plpgsql security definer set search_path='' as $$
begin if not public.has_permission(t,'tenant.read') then raise exception 'Access denied' using errcode='42501';end if;
 insert into public.audit_events(tenant_id,branch_id,actor_id,action,entity) select t,branch_id,auth.uid(),'access','session' from public.memberships where tenant_id=t and user_id=auth.uid();end;$$;

-- Explicit function and table privileges. Definer helpers have fixed empty search_path.
revoke all on all tables in schema public from anon;
grant select,insert,update on public.plans,public.presets,public.tenants,public.branches,public.tenant_roles,public.memberships,public.tenant_configuration to authenticated;
grant select on public.audit_events,public.platform_admins to authenticated;
revoke all on function public.provision_tenant(text,text,uuid,uuid),public.log_access(uuid),public.is_platform_admin(),public.tenant_session_valid(uuid),public.has_permission(uuid,text),public.branch_allowed(uuid,uuid),public.record_audit(),public.guard_business_record(),public.audit_immutable() from public,anon;
grant execute on function public.provision_tenant(text,text,uuid,uuid),public.log_access(uuid),public.is_platform_admin(),public.tenant_session_valid(uuid),public.has_permission(uuid,text),public.branch_allowed(uuid,uuid) to authenticated;
revoke all on function public.resolve_tenant(text) from public;
grant execute on function public.resolve_tenant(text) to anon,authenticated;
