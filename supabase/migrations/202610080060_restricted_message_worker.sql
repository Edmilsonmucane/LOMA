-- An operator supplies a private LOGIN member; this group cannot authenticate by itself.
do $$begin if not exists(select 1 from pg_roles where rolname='loma_message_worker') then create role loma_message_worker nologin;end if;end;$$;
grant usage on schema communication_private,public to loma_message_worker;
grant execute on function communication_private.schedule(),communication_private.prepare(uuid),communication_private.dispatch(uuid),communication_private.finish(uuid,jsonb) to loma_message_worker;
grant select(id,tenant_id,status,reason,available_at) on public.message_jobs to loma_message_worker;
grant update(status,reason,attempted_at) on public.message_jobs to loma_message_worker;
grant insert(tenant_id,message_id,state,detail) on public.message_events to loma_message_worker;
grant select(id,last_run),update(last_run) on communication_private.worker_health to loma_message_worker;
create policy technical_worker_read on public.message_jobs for select to loma_message_worker using(true);
create policy technical_worker_start on public.message_jobs for update to loma_message_worker using(status in ('queued','uncertain')) with check(status='uncertain' and reason in ('dispatching','worker'));
create policy technical_worker_event on public.message_events for insert to loma_message_worker with check(state='uncertain' and detail->>'reason'='worker' and exists(select 1 from public.message_jobs where id=message_id and tenant_id=message_events.tenant_id));
