create function communication_private.origin_allowed(job public.message_jobs) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(actor is null or exists(select 1 from public.platform_admins where user_id=actor) or exists(select 1 from public.memberships m join public.tenant_roles r on r.id=m.role_id and r.tenant_id=(job).tenant_id where m.tenant_id=(job).tenant_id and m.user_id=actor and m.active and ('messages.manage'=any(r.permissions) or (job).source_key like 'manual:%' and 'collections.manage'=any(r.permissions)) and (m.branch_id is null or m.branch_id=(job).branch_id)),false)
 from (select coalesce((job).created_by,(select c.created_by from public.campaigns c where c.id=(job).campaign_id and c.tenant_id=(job).tenant_id)) actor) x;
$$;
create or replace function communication_private.dispatch(j uuid) returns boolean language plpgsql security definer set search_path='' as $$declare job public.message_jobs;c public.clients;r jsonb;hour int;blocked_reason text;local_time timestamp;limit_messages int;begin
 select * into job from public.message_jobs where id=j and status='uncertain' and reason='dispatching' for update;if job.id is null then return false;end if;
 select * into c from public.clients where id=job.client_id and tenant_id=job.tenant_id for update;r:=communication_private.rules(job.tenant_id);local_time:=now() at time zone(r->>'timezone');hour:=extract(hour from local_time);
 if not communication_private.origin_allowed(job) then blocked_reason:='access';
 elsif not coalesce(communication_private.allowed(job.tenant_id,c.id,job.channel),false) then blocked_reason:='consent';
 elsif c.branch_id<>job.branch_id then blocked_reason:='branch_changed';
 elsif job.campaign_id is not null and exists(select 1 from public.campaigns where id=job.campaign_id and status='cancelled') then blocked_reason:='cancelled';
 elsif job.campaign_id is not null and not exists(select 1 from public.tenants te join public.plans p on p.id=te.plan_id where te.id=job.tenant_id and coalesce((p.features->>'campaigns')::boolean,false)) then blocked_reason:='access';
 elsif hour<(r->>'startHour')::int or hour>=(r->>'endHour')::int then blocked_reason:='window';
 elsif (select count(*) from public.message_jobs where tenant_id=job.tenant_id and client_id=c.id and coalesce(accepted_at,attempted_at) is not null and (coalesce(accepted_at,attempted_at) at time zone(r->>'timezone'))::date=local_time::date)>(r->>'maxPerDay')::int then blocked_reason:='frequency';end if;
 select (p.limits->>'messages')::int into limit_messages from public.tenants te join public.plans p on p.id=te.plan_id where te.id=job.tenant_id;
 if blocked_reason is null and (select count(*) from public.message_jobs where tenant_id=job.tenant_id and coalesce(accepted_at,attempted_at)>=date_trunc('month',now()))>limit_messages then blocked_reason:='plan_limit';end if;
 if blocked_reason is not null then
 update public.message_jobs set status=case when blocked_reason in ('window','frequency','plan_limit') then 'queued' else 'suppressed' end,reason=blocked_reason,attempted_at=null,
 available_at=case when blocked_reason='plan_limit' then date_trunc('month',now())+interval '1 month' when blocked_reason in ('window','frequency') then ((local_time::date+case when blocked_reason='frequency' or hour>=(r->>'endHour')::int then 1 else 0 end)+make_interval(hours=>(r->>'startHour')::int)) at time zone(r->>'timezone') else available_at end where id=j;
 insert into public.message_events(tenant_id,message_id,state,detail) values(job.tenant_id,j,case when blocked_reason in ('window','frequency','plan_limit') then 'deferred' else 'suppressed' end,jsonb_build_object('reason',blocked_reason));return false;end if;return true;
end;$$;
create function communication_private.dispatch_payload(j uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare contact text;job public.message_jobs;begin
 if not communication_private.dispatch(j) then return null;end if;select * into job from public.message_jobs where id=j;
 select x->>'value' into contact from public.clients c cross join lateral jsonb_array_elements(c.profile->'contacts') x where c.id=job.client_id and c.tenant_id=job.tenant_id and x->>'kind'=case when job.channel='email' then 'email' else 'phone' end limit 1;
 if contact is null then update public.message_jobs set status='suppressed',reason='contact',attempted_at=null where id=j;insert into public.message_events(tenant_id,message_id,state,detail) values(job.tenant_id,j,'suppressed','{"reason":"contact"}');return null;end if;return jsonb_build_object('to',contact);
end;$$;
do $$declare b text;begin b:=pg_get_functiondef('communication_private.finish(uuid,jsonb)'::regprocedure);b:=replace(b,'update public.message_jobs set status=', $new$update public.message_jobs set attempted_at=case when s in ('retry','failed') then null else attempted_at end,status=$new$);execute b;end;$$;
revoke all on function communication_private.origin_allowed(public.message_jobs),communication_private.dispatch_payload(uuid) from public,anon,authenticated;
grant execute on function communication_private.dispatch_payload(uuid) to loma_message_worker;
