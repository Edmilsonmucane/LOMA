-- Draft-only profiles never silently replace an existing staff-managed client.
alter table public.customer_accounts add column created_client boolean not null default false;
do $$declare body text;begin
 body:=pg_get_functiondef('public.customer_save_draft(uuid,uuid,jsonb,integer)'::regprocedure);
 body:=replace(body,'insert into public.customer_accounts(tenant_id,user_id,client_id) values(t,auth.uid(),c);','insert into public.customer_accounts(tenant_id,user_id,client_id,created_client) values(t,auth.uid(),c,true);');execute body;
 body:=pg_get_functiondef('public.customer_submit(uuid,uuid,integer,text,text)'::regprocedure);
 body:=replace(body,'aid:=d.id;', $new$
 perform 1 from public.customer_accounts where tenant_id=t and user_id=auth.uid() for update;
 if exists(select 1 from public.customer_accounts ca where ca.tenant_id=t and ca.user_id=auth.uid() and ca.created_client) and not exists(select 1 from public.applications where tenant_id=t and client_id=d.client_id) then
 update public.clients set name=d.data->>'name',birth_date=nullif(d.data->>'birth_date','')::date,profile=d.data->'profile',revision=revision+1,updated_at=now() where tenant_id=t and id=d.client_id;
 delete from public.client_keys where tenant_id=t and client_id=d.client_id and kind<>'phone';
 insert into public.client_keys(tenant_id,client_id,kind,value) select t,d.client_id,x->>'kind',upper(regexp_replace(x->>'value','[^A-Za-z0-9]','','g')) from jsonb_array_elements(d.data->'profile'->'identities') x;
 update public.customer_accounts set created_client=false where tenant_id=t and user_id=auth.uid();
 insert into public.client_events(tenant_id,client_id,actor_id,kind,detail) select t,d.client_id,auth.uid(),'updated',jsonb_build_object('revision',revision) from public.clients where tenant_id=t and id=d.client_id;
 end if;
 update public.portal_drafts set data=data||jsonb_build_object('acceptance',jsonb_build_object('at',now(),'user',auth.uid(),'terms',(select value->>'terms' from public.tenant_configuration where tenant_id=t and category='website' and key='main'),'privacy',(select value->>'privacy' from public.tenant_configuration where tenant_id=t and category='website' and key='main'))) where id=d.id;
 aid:=d.id;
 $new$);execute body;
 -- The first request counts as one, not two.
 body:=pg_get_functiondef('portal_private.rate(uuid,text,text,integer,integer)'::regprocedure);
 body:=replace(body,'insert into portal_private.rate_limits(tenant_id,kind,key) values(t,k,v)','insert into portal_private.rate_limits(tenant_id,kind,key,count) values(t,k,v,0)');execute body;
end;$$;
