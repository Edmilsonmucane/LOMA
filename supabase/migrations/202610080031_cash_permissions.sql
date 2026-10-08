-- Editable permissions separate accepting money, reversals and cash control.
update public.tenant_roles set permissions=permissions||array['payments.reverse','cash.manage'] where key='manager';
update public.tenant_roles set permissions=permissions||array['cash.manage'] where key='cashier';
update public.presets set configuration=jsonb_set(configuration,'{roles}',(select jsonb_agg(case when r->>'key'='manager' then jsonb_set(r,'{permissions}',r->'permissions'||'["payments.reverse","cash.manage"]'::jsonb) when r->>'key'='cashier' then jsonb_set(r,'{permissions}',r->'permissions'||'["cash.manage"]'::jsonb) else r end) from jsonb_array_elements(configuration->'roles') r));
do $$begin
 execute replace(pg_get_functiondef('public.reverse_payment(uuid,uuid,text)'::regprocedure),'has_permission(t,''tenant.manage'')','has_permission(t,''payments.reverse'')');
 execute replace(pg_get_functiondef('public.manage_cash(uuid,uuid,text,text,text,uuid)'::regprocedure),'has_permission(t,''loans.disburse'')','has_permission(t,''cash.manage'')');
 execute replace(pg_get_functiondef('public.cash_summary(uuid,uuid)'::regprocedure),'has_permission(t,''loans.disburse'')','has_permission(t,''cash.manage'')');
end;$$;
