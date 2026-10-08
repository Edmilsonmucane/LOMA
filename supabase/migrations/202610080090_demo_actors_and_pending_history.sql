-- Prefer an analyst as the independent author of synthetic applications.
do $$declare body text;begin
 body:=pg_get_functiondef('public.reset_demo(uuid,integer,text,text)'::regprocedure);
 body:=replace(body,'select user_id into creator from public.memberships where tenant_id=nt and user_id<>owner and active order by display_name limit 1;',
 'select m.user_id into creator from public.memberships m join public.tenant_roles r on r.id=m.role_id and r.tenant_id=nt where m.tenant_id=nt and m.user_id<>owner and m.active order by case when r.key=''analyst'' then 0 when r.key=''cashier'' then 1 else 2 end,m.display_name,m.user_id limit 1;');
 body:=replace(body,$old$creator,now()-interval '2 days');end loop;$old$,
 $events$creator,now()-interval '2 days') returning id into coid;
 insert into public.application_events(tenant_id,application_id,branch_id,actor_id,actor_name,status,detail,created_at) values(nt,coid,aid,creator,(select display_name from public.memberships where tenant_id=nt and user_id=creator),'submitted','Pedido sintético de demonstração.',now()-interval '2 days');
 if idx%2=1 then insert into public.application_events(tenant_id,application_id,branch_id,actor_id,actor_name,status,detail,created_at) values(nt,coid,aid,owner,(select display_name from public.memberships where tenant_id=nt and user_id=owner),'in_review','Análise sintética de demonstração.',now()-interval '1 day');end if;
 end loop;$events$);execute body;
end;$$;
