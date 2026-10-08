alter table public.message_jobs add column attempted_at timestamptz;
create table communication_private.worker_health(id boolean primary key default true check(id),last_run timestamptz not null);
insert into communication_private.worker_health values(true,now());
do $$declare b text;begin
 b:=pg_get_functiondef('communication_private.prepare(uuid)'::regprocedure);
 b:=replace(b,'accepted_at>=date_trunc','coalesce(accepted_at,attempted_at)>=date_trunc');
 b:=replace(b,'accepted_at is not null and (accepted_at at time zone','coalesce(accepted_at,attempted_at) is not null and (coalesce(accepted_at,attempted_at) at time zone');execute b;
end;$$;
-- Freeze sensitive identity and message facts even if future API grants change.
create function communication_private.job_guard() returns trigger language plpgsql set search_path='' as $$begin
 if new.tenant_id<>old.tenant_id or new.client_id<>old.client_id or new.branch_id<>old.branch_id or new.channel<>old.channel or new.body<>old.body or new.variables<>old.variables or new.source_key<>old.source_key or new.template_snapshot<>old.template_snapshot or new.campaign_id is distinct from old.campaign_id or new.created_by is distinct from old.created_by then raise exception 'Message facts are immutable' using errcode='23514';end if;return new;
end;$$;
create trigger message_job_facts before update on public.message_jobs for each row execute function communication_private.job_guard();
revoke all on all functions in schema communication_private from public,anon,authenticated;
