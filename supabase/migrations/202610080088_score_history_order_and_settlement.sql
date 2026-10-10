-- Multiple financial events in one transaction retain a deterministic assessment order.
alter table public.client_risk_assessments add column sequence bigint generated always as identity;
create index on public.client_risk_assessments(tenant_id,client_id,sequence desc);
do $$declare body text;begin
 body:=pg_get_functiondef('scoring_private.refresh(uuid,uuid)'::regprocedure);
 body:=replace(body,'order by assessed_at desc,id desc limit 1','order by sequence desc limit 1');execute body;
end;$$;
-- Settlement/write-off/renegotiation changes previous-loan metrics after the account update.
create function scoring_private.loan_state_changed() returns trigger language plpgsql security definer set search_path='' as $$declare cid uuid;begin
 select a.client_id into strict cid from public.contracts c join public.applications a on a.id=c.application_id and a.tenant_id=new.tenant_id where c.tenant_id=new.tenant_id and c.id=new.contract_id;
 perform scoring_private.refresh(new.tenant_id,cid);return new;
end;$$;
create trigger loan_state_score after update of status on public.loans for each row when (old.status is distinct from new.status) execute function scoring_private.loan_state_changed();
revoke all on function scoring_private.loan_state_changed() from public,anon,authenticated;
