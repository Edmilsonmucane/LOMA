-- Current contact details require access to the client's current agency as well as the credit.
do $$declare b text;begin
 b:=pg_get_functiondef('public.collections_summary(uuid,text,integer,integer,boolean)'::regprocedure);b:=replace(b,'and public.branch_allowed(t,l.branch_id) and i.due_date','and public.branch_allowed(t,l.branch_id) and public.branch_allowed(t,c.branch_id) and i.due_date');execute b;
 b:=pg_get_functiondef('public.record_collection(uuid,uuid,text,text,date,text,uuid)'::regprocedure);b:=replace(b,'select branch_id into b from public.loans where id=l and tenant_id=t;',$new$select lo.branch_id into b from public.loans lo join public.contracts ct on ct.id=lo.contract_id and ct.tenant_id=t join public.applications ap on ap.id=ct.application_id and ap.tenant_id=t join public.clients cl on cl.id=ap.client_id and cl.tenant_id=t where lo.id=l and lo.tenant_id=t and public.branch_allowed(t,cl.branch_id);$new$);execute b;
end;$$;
