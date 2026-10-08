-- Archived generations are retained, but are no longer operational tenants.
do $$declare body text;begin
 body:=pg_get_functiondef('financial_private.daily()'::regprocedure);
 body:=replace(body,'where exists(select 1 from public.loan_instalments', 'where exists(select 1 from public.tenants t where t.id=a.tenant_id and t.active) and exists(select 1 from public.loan_instalments');execute body;
 body:=pg_get_functiondef('communication_private.schedule()'::regprocedure);
 body:=replace(body,'where status=''scheduled'' and scheduled_at<=now()', 'where status=''scheduled'' and scheduled_at<=now() and exists(select 1 from public.tenants t where t.id=tenant_id and t.active)');
 body:=replace(body,'where category=''automation'' and', 'where category=''automation'' and exists(select 1 from public.tenants t where t.id=tenant_id and t.active) and');execute body;
end;$$;
