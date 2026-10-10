-- Cashiers may consult requests/contracts to verify a disbursement, without deciding them.
update public.tenant_roles set permissions=array_append(permissions,'applications.read') where key='cashier' and not 'applications.read'=any(permissions);
update public.presets set configuration=jsonb_set(configuration,'{roles}',(select jsonb_agg(case when r->>'key'='cashier' and not (r->'permissions') ? 'applications.read' then jsonb_set(r,'{permissions}',(r->'permissions')||'"applications.read"'::jsonb) else r end) from jsonb_array_elements(configuration->'roles') r));
