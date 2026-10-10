do $$declare b text;begin
 b:=pg_get_functiondef('communication_private.defaults(uuid)'::regprocedure);b:=replace(b,'as $function$begin','as $function$begin');b:=replace(b,' insert into public.tenant_configuration(tenant_id,category,key,value) values(t,',' perform set_config(''loma.communication_config'',''on'',true);'||chr(10)||' insert into public.tenant_configuration(tenant_id,category,key,value) values(t,');execute b;
 b:=pg_get_functiondef('communication_private.schedule()'::regprocedure);b:=replace(b,$old$and p.created_at>now()-interval '7 days'$old$,'');b:=replace(b,$old$and e.created_at>now()-interval '7 days'$old$,'');execute b;
end;$$;
-- A message's originator must still be allowed to act when dispatch starts.
do $$declare b text;begin
 b:=pg_get_functiondef('communication_private.prepare(uuid)'::regprocedure);
 b:=replace(b,'if not coalesce(communication_private.allowed',$new$if job.created_by is not null and not exists(select 1 from public.platform_admins where user_id=job.created_by) and not exists(select 1 from public.memberships m join public.tenant_roles r on r.id=m.role_id and r.tenant_id=job.tenant_id where m.tenant_id=job.tenant_id and m.user_id=job.created_by and m.active and (r.permissions ? 'messages.manage' or job.source_key like 'manual:%' and r.permissions ? 'collections.manage') and (m.branch_id is null or m.branch_id=job.branch_id)) then suppression_reason:='access';
 elsif not coalesce(communication_private.allowed$new$);
 execute b;
end;$$;
create function public.message_history(t uuid,selected_state text default '',query text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.has_permission(t,'messages.manage') then raise exception 'Access denied' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from(select j.id,j.body,j.status,j.channel,j.cost::text cost,j.attempts,j.reason,j.created_at,c.name from public.message_jobs j join public.clients c on c.id=j.client_id and c.tenant_id=t where j.tenant_id=t and public.branch_allowed(t,j.branch_id) and public.branch_allowed(t,c.branch_id) and (selected_state='' or j.status=selected_state) and (query='' or c.name ilike '%'||query||'%') order by j.created_at desc limit 50)x),'[]');
end;$$;
revoke all on function public.message_history(uuid,text,text) from public,anon;
grant execute on function public.message_history(uuid,text,text) to authenticated;
revoke all on all functions in schema communication_private from public,anon,authenticated;
