-- No-op runs do not rewrite status or append duplicate audit rows.
create or replace function financial_private.status(l uuid) returns void language sql set search_path='' as $$
 with state as (select case when not exists(select 1 from public.loan_instalments where loan_id=l and principal+interest+fine+late_interest>0) then 'settled' when exists(select 1 from public.loan_instalments where loan_id=l and due_date<(now() at time zone 'Africa/Maputo')::date and principal+interest+fine+late_interest>0) then 'overdue' else 'active' end as value)
 update public.loans set status=state.value from state where id=l and status in ('active','overdue','settled') and status is distinct from state.value;
$$;
create or replace function financial_private.daily() returns void language plpgsql set search_path='' as $$declare r record;begin
 for r in select a.tenant_id,a.loan_id from public.loan_accounts a where exists(select 1 from public.loan_instalments i where i.loan_id=a.loan_id and i.accrued_on<(now() at time zone 'Africa/Maputo')::date) order by a.tenant_id,a.loan_id loop
 perform 1 from public.tenants where id=r.tenant_id for update;
 perform financial_private.accrue(r.tenant_id,r.loan_id,(now() at time zone 'Africa/Maputo')::date);
 end loop;
end;$$;
-- Hosted Supabase offers pg_cron; the local official PostgreSQL uses the equivalent worker.
do $$begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
 execute 'create extension if not exists pg_cron';
 execute $cron$select cron.schedule('loma-overdue-daily','*/15 * * * *','select financial_private.daily();')$cron$;
 end if;
end;$$;
revoke all on all functions in schema financial_private from public,anon,authenticated;
