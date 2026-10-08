-- Avoid the trigger/function record variable r when selecting the independent author.
do $$declare body text;begin
 body:=pg_get_functiondef('public.reset_demo(uuid,integer,text,text)'::regprocedure);
 body:=replace(body,'join public.tenant_roles r on r.id=m.role_id and r.tenant_id=nt', 'join public.tenant_roles demo_role on demo_role.id=m.role_id and demo_role.tenant_id=nt');
 body:=replace(body,'case when r.key=''analyst'' then 0 when r.key=''cashier'' then 1 else 2 end', 'case when demo_role.key=''analyst'' then 0 when demo_role.key=''cashier'' then 1 else 2 end');execute body;
end;$$;
