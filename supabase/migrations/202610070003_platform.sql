create table public.platform_audit_events (id bigint generated always as identity primary key,actor_id uuid references auth.users(id),action text not null,entity text not null,previous jsonb,current jsonb,occurred_at timestamptz not null default now());
alter table public.platform_audit_events enable row level security;
create policy platform_audit_read on public.platform_audit_events for select to authenticated using(public.is_platform_admin());
revoke all on public.platform_audit_events from anon,authenticated;
grant select on public.platform_audit_events to authenticated;
create trigger immutable_platform_audit before update or delete on public.platform_audit_events for each row execute function public.audit_immutable();
create trigger immutable_platform_audit_truncate before truncate on public.platform_audit_events for each statement execute function public.audit_immutable();
create function public.record_platform_audit() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.platform_audit_events(actor_id,action,entity,previous,current) values(auth.uid(),lower(tg_op),tg_table_name,case when tg_op='INSERT' then null else to_jsonb(old) end,case when tg_op='DELETE' then null else to_jsonb(new) end);return coalesce(new,old);end;$$;
create trigger audit_plans after insert or update or delete on public.plans for each row execute function public.record_platform_audit();
create trigger audit_presets after insert or update or delete on public.presets for each row execute function public.record_platform_audit();
create trigger audit_platform_admins after insert or update or delete on public.platform_admins for each row execute function public.record_platform_audit();
create function public.tenant_usage() returns table(tenant_id uuid,user_count bigint) language plpgsql stable security definer set search_path='' as $$begin
 if not public.is_platform_admin() then raise exception 'Platform administration required' using errcode='42501';end if;
 return query select t.id,count(m.id) from public.tenants t left join public.memberships m on m.tenant_id=t.id and m.active group by t.id;end;$$;
create function public.log_platform_access() returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_platform_admin() then raise exception 'Platform administration required' using errcode='42501';end if;
 insert into public.platform_audit_events(actor_id,action,entity) values(auth.uid(),'access','session');end;$$;
revoke all on function public.record_platform_audit(),public.tenant_usage(),public.log_platform_access() from public,anon;
grant execute on function public.tenant_usage(),public.log_platform_access() to authenticated;
