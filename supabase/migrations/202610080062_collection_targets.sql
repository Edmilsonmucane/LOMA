alter table public.collection_assignments add column assigned_at timestamptz not null default now();
create function communication_private.assignment_start() returns trigger language plpgsql set search_path='' as $$begin new.assigned_at:=now();return new;end;$$;
create trigger collection_assignment_start before update on public.collection_assignments for each row execute function communication_private.assignment_start();
create function public.collection_targets(t uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.has_permission(t,'collections.manage') then raise exception 'Access denied' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(z)) from(select a.user_id,m.display_name name,sum(a.target)::text target,sum(coalesce((select sum(p.amount) from public.payments p where p.tenant_id=t and p.loan_id=a.loan_id and p.created_at>=a.assigned_at and not exists(select 1 from public.payment_reversals r where r.payment_id=p.id and r.tenant_id=t)),0))::text received from public.collection_assignments a join public.memberships m on m.tenant_id=t and m.user_id=a.user_id where a.tenant_id=t and public.branch_allowed(t,a.branch_id) group by a.user_id,m.display_name order by m.display_name)z),'[]');
end;$$;
revoke all on function public.collection_targets(uuid) from public,anon;
grant execute on function public.collection_targets(uuid) to authenticated;
revoke all on function communication_private.assignment_start() from public,anon,authenticated;
