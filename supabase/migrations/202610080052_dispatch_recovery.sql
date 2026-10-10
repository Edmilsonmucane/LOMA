create function communication_private.dispatch(j uuid) returns boolean language plpgsql security definer set search_path='' as $$declare job public.message_jobs;c public.clients;r jsonb;hour int;reason text;begin
 select * into job from public.message_jobs where id=j and status='uncertain' and message_jobs.reason='dispatching' for update;
 if job.id is null then return false;end if;
 select * into c from public.clients where id=job.client_id and tenant_id=job.tenant_id for update;
 r:=communication_private.rules(job.tenant_id);hour:=extract(hour from now() at time zone(r->>'timezone'));
 if not coalesce(communication_private.allowed(job.tenant_id,c.id,job.channel),false) then reason:='consent';
 elsif c.branch_id<>job.branch_id then reason:='branch_changed';
 elsif hour<(r->>'startHour')::int or hour>=(r->>'endHour')::int then reason:='window';
 elsif job.campaign_id is not null and exists(select 1 from public.campaigns where id=job.campaign_id and status='cancelled') then reason:='cancelled';end if;
 if reason is not null then update public.message_jobs set status='suppressed',reason=dispatch.reason where id=j;insert into public.message_events(tenant_id,message_id,state,detail) values(job.tenant_id,j,'suppressed',jsonb_build_object('reason',reason));return false;end if;
 return true;
end;$$;
do $$declare b text;begin
 b:=pg_get_functiondef('communication_private.dispatch(uuid)'::regprocedure);b:=replace(b,'reason text;','blocked_reason text;');b:=replace(b,'reason:=','blocked_reason:=');b:=replace(b,'if reason is not null','if blocked_reason is not null');b:=replace(b,'reason=dispatch.reason','reason=blocked_reason');b:=replace(b,$old$'reason',reason)$old$,$new$'reason',blocked_reason)$new$);execute b;
 b:=pg_get_functiondef('communication_private.finish(uuid,jsonb)'::regprocedure);b:=replace(b,$old$if job.status<>'queued' then$old$,$new$if job.status<>'queued' and not (job.status='uncertain' and job.reason='dispatching') then$new$);execute b;
end;$$;
revoke all on all functions in schema communication_private from public,anon,authenticated;
