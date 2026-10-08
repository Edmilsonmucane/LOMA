create function communication_private.schedule() returns integer language plpgsql security definer set search_path='' as $$declare a record;x record;c record;n int:=0;day date;extra jsonb;j uuid;begin
 perform financial_private.daily();
 for c in select * from public.campaigns where status='scheduled' and scheduled_at<=now() order by scheduled_at for update skip locked loop
 -- Re-check the initiating staff account and its current branch scope before expanding a campaign.
 if not exists(select 1 from public.memberships m join public.tenant_roles r on r.id=m.role_id and r.tenant_id=c.tenant_id where m.tenant_id=c.tenant_id and m.user_id=c.created_by and m.active and r.permissions ? 'messages.manage' and (m.branch_id is null or m.branch_id=c.branch_id)) then update public.campaigns set status='cancelled' where id=c.id;continue;end if;
 for x in select * from communication_private.segment(c.tenant_id,c.branch_id,c.segment,c.channel) loop
 j:=communication_private.enqueue(c.tenant_id,x.id,c.channel,c.template_key,'campaign:'||c.id||':'||x.id,'{}',now(),c.id);if j is not null then n:=n+1;end if;
 end loop;
 update public.campaigns set status='queued' where id=c.id;
 end loop;
 for a in select * from public.tenant_configuration where category='automation' and (value->>'enabled')::boolean loop
 day:=(now() at time zone (communication_private.rules(a.tenant_id)->>'timezone'))::date;
 if a.value->>'event'='due' then
 for x in select l.id loan,ap.client_id,i.number,i.due_date,(i.principal+i.interest+i.fine+i.late_interest) amount from public.loans l join public.contracts ct on ct.id=l.contract_id and ct.tenant_id=a.tenant_id join public.applications ap on ap.id=ct.application_id and ap.tenant_id=a.tenant_id join public.loan_instalments i on i.loan_id=l.id and i.tenant_id=a.tenant_id where l.tenant_id=a.tenant_id and l.status in ('active','overdue') and i.due_date=day-(a.value->>'offsetDays')::int and i.principal+i.interest+i.fine+i.late_interest>0 loop
 extra:=jsonb_build_object('valor',communication_private.money(x.amount),'data',to_char(x.due_date,'DD/MM/YYYY'),'numero',left(x.loan::text,8));
 j:=communication_private.enqueue(a.tenant_id,x.client_id,a.value->>'channel',a.value->>'template','due:'||a.key||':'||x.loan||':'||x.number||':'||day,extra);if j is not null then n:=n+1;end if;
 end loop;
 elsif a.value->>'event'='payment' then
 for x in select p.*,ap.client_id from public.payments p join public.loans l on l.id=p.loan_id and l.tenant_id=a.tenant_id join public.contracts ct on ct.id=l.contract_id and ct.tenant_id=a.tenant_id join public.applications ap on ap.id=ct.application_id and ap.tenant_id=a.tenant_id where p.tenant_id=a.tenant_id and p.created_at>=(a.value->>'activatedAt')::timestamptz and p.created_at>now()-interval '7 days' and not exists(select 1 from public.payment_reversals r where r.payment_id=p.id and r.tenant_id=p.tenant_id) loop
 j:=communication_private.enqueue(a.tenant_id,x.client_id,a.value->>'channel',a.value->>'template','payment:'||a.key||':'||x.id,jsonb_build_object('valor',communication_private.money(x.amount),'data',to_char(x.paid_on,'DD/MM/YYYY'),'numero',x.receipt_number::text));if j is not null then n:=n+1;end if;
 end loop;
 else
 for x in select e.id event_id,ap.id,ap.client_id,ap.principal from public.application_events e join public.applications ap on ap.id=e.application_id and ap.tenant_id=a.tenant_id where e.tenant_id=a.tenant_id and e.status=a.value->>'event' and e.created_at>=(a.value->>'activatedAt')::timestamptz and e.created_at>now()-interval '7 days' loop
 j:=communication_private.enqueue(a.tenant_id,x.client_id,a.value->>'channel',a.value->>'template','application:'||a.key||':'||x.event_id,jsonb_build_object('numero',left(x.id::text,8),'valor',communication_private.money(x.principal)));if j is not null then n:=n+1;end if;
 end loop;
 end if;
 end loop;return n;
end;$$;
-- Called in the worker transaction; caller holds a tenant advisory lock through provider submission.
create function communication_private.prepare(j uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare job public.message_jobs;c public.clients;r jsonb;settings jsonb;local_time timestamp;contact text;reason text;limit_messages int;key text;begin
 select * into job from public.message_jobs where id=j and status='queued' and available_at<=now() for update;
 if job.id is null then return null;end if;
 select * into c from public.clients where id=job.client_id and tenant_id=job.tenant_id for update;
 r:=communication_private.rules(job.tenant_id);local_time:=now() at time zone (r->>'timezone');
 if not coalesce(communication_private.allowed(job.tenant_id,c.id,job.channel),false) then reason:='consent';
 elsif job.branch_id<>c.branch_id then reason:='branch_changed';
 elsif job.campaign_id is not null and exists(select 1 from public.campaigns where id=job.campaign_id and status='cancelled') then reason:='cancelled';
 elsif job.source_key like 'payment:%' and exists(select 1 from public.payment_reversals where payment_id=split_part(job.source_key,':',3)::uuid and tenant_id=job.tenant_id) then reason:='reversed';
 end if;
 select x->>'value' into contact from jsonb_array_elements(c.profile->'contacts') x where x->>'kind'=case when job.channel='email' then 'email' else 'phone' end limit 1;
 if contact is null then reason:='contact';end if;
 if reason is not null then update public.message_jobs set status='suppressed',message_jobs.reason=prepare.reason where id=j;insert into public.message_events(tenant_id,message_id,state,detail) values(job.tenant_id,j,'suppressed',jsonb_build_object('reason',reason));return null;end if;
 if extract(hour from local_time)<(r->>'startHour')::int or extract(hour from local_time)>=(r->>'endHour')::int then
 update public.message_jobs set available_at=((local_time::date+case when extract(hour from local_time)>=(r->>'endHour')::int then 1 else 0 end)+make_interval(hours=>(r->>'startHour')::int)) at time zone (r->>'timezone'),reason='window' where id=j;return null;end if;
 select (p.limits->>'messages')::int into limit_messages from public.tenants te join public.plans p on p.id=te.plan_id where te.id=job.tenant_id;
 if (select count(*) from public.message_jobs where tenant_id=job.tenant_id and accepted_at>=date_trunc('month',now()))>=limit_messages then
 update public.message_jobs set available_at=date_trunc('month',now())+interval '1 month',reason='plan_limit' where id=j;return null;end if;
 if (select count(*) from public.message_jobs where tenant_id=job.tenant_id and client_id=c.id and accepted_at is not null and (accepted_at at time zone (r->>'timezone'))::date=local_time::date)>=(r->>'maxPerDay')::int then
 update public.message_jobs set available_at=(local_time::date+1+make_interval(hours=>(r->>'startHour')::int)) at time zone (r->>'timezone'),reason='frequency' where id=j;return null;end if;
 select secret into key from communication_private.key where id;
 select extensions.pgp_sym_decrypt(cipher,key)::jsonb into settings from communication_private.integrations where tenant_id=job.tenant_id and channel=job.channel;
 settings:=coalesce(settings,'{"provider":"console","cost":"0"}'::jsonb);
 update public.message_jobs set attempts=attempts+1,reason=null where id=j;
 insert into public.message_events(tenant_id,message_id,state,detail) values(job.tenant_id,j,'attempt',jsonb_build_object('number',job.attempts+1));
 return jsonb_build_object('id',j,'tenant',job.tenant_id,'channel',job.channel,'to',contact,'body',job.body,'variables',job.variables,'template',(select value from public.tenant_configuration where tenant_id=job.tenant_id and category='message_template' and key=job.template_key),'integration',settings,'rules',r);
end;$$;
create function communication_private.finish(j uuid,result jsonb) returns void language plpgsql security definer set search_path='' as $$declare job public.message_jobs;r jsonb;s text;begin
 select * into job from public.message_jobs where id=j for update;if job.status<>'queued' then return;end if;r:=communication_private.rules(job.tenant_id);
 s:=result->>'state';if s not in ('accepted','retry','failed','uncertain') then raise exception 'Invalid result';end if;
 if s='retry' and job.attempts>=(r->>'maxAttempts')::int then s:='failed';end if;
 update public.message_jobs set status=case when s='retry' then 'queued' else s end,cost=coalesce(result->>'cost','0')::bigint,provider_id=result->>'providerId',reason=result->>'reason',accepted_at=case when s='accepted' then now() else null end,available_at=case when s='retry' then now()+make_interval(secs=>(r->>'retrySeconds')::int*power(2,greatest(0,job.attempts-1))::int) else available_at end where id=j;
 insert into public.message_events(tenant_id,message_id,state,detail) values(job.tenant_id,j,s,jsonb_build_object('reason',result->>'reason','cost',coalesce(result->>'cost','0'),'provider',result->>'providerId'));
end;$$;
revoke all on all functions in schema communication_private from public,anon,authenticated;
