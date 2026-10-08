-- Synthetic generations carry explicit historical application events, using the existing immutable timeline.
do $$declare body text;begin
 body:=pg_get_functiondef('public.reset_demo(uuid,integer,text,text)'::regprocedure);
 body:=replace(body,E'returning id into aid;\n select profile',
 $events$returning id into aid;
 insert into public.application_events(tenant_id,application_id,branch_id,actor_id,actor_name,status,detail,created_at) values
 (nt,aid,coid,creator,(select display_name from public.memberships where tenant_id=nt and user_id=creator),'submitted','Pedido sintético de demonstração.',(ln->>'startDate')::date),
 (nt,aid,coid,owner,(select display_name from public.memberships where tenant_id=nt and user_id=owner),'approved','Aprovação sintética de demonstração.',(ln->>'startDate')::date),
 (nt,aid,coid,owner,(select display_name from public.memberships where tenant_id=nt and user_id=owner),'disbursed','Desembolso sintético de demonstração.',(ln->>'startDate')::date);
 select profile$events$);
 execute body;
end;$$;
