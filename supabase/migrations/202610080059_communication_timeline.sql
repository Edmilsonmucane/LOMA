alter table public.client_events drop constraint client_events_kind_check;
alter table public.client_events add constraint client_events_kind_check check(kind in ('created','updated','consent','note','document','application','payment','reversal','collection','message'));
create function communication_private.collection_timeline() returns trigger language plpgsql security definer set search_path='' as $$declare c uuid;begin
 select a.client_id into c from public.loans l join public.contracts ct on ct.id=l.contract_id and ct.tenant_id=new.tenant_id join public.applications a on a.id=ct.application_id and a.tenant_id=new.tenant_id where l.id=new.loan_id and l.tenant_id=new.tenant_id;
 insert into public.client_events(tenant_id,client_id,actor_id,kind,detail) values(new.tenant_id,c,new.actor_id,'collection',jsonb_build_object('loan_id',new.loan_id,'note',new.note,'activity',new.kind,'due',new.due_on,'amount',new.amount::text));return new;
end;$$;
create trigger collection_timeline after insert on public.collection_actions for each row execute function communication_private.collection_timeline();
create function communication_private.message_timeline() returns trigger language plpgsql security definer set search_path='' as $$declare j public.message_jobs;begin
 if new.state not in ('accepted','delivered','failed','suppressed','uncertain') then return new;end if;
 select * into j from public.message_jobs where id=new.message_id and tenant_id=new.tenant_id;
 insert into public.client_events(tenant_id,client_id,actor_id,kind,detail) values(j.tenant_id,j.client_id,j.created_by,'message',jsonb_build_object('channel',j.channel,'message_state',new.state,'message_id',j.id));return new;
end;$$;
create trigger message_timeline after insert on public.message_events for each row execute function communication_private.message_timeline();
create trigger message_jobs_no_delete before delete on public.message_jobs for each row execute function public.audit_immutable();
create trigger message_jobs_no_truncate before truncate on public.message_jobs execute function public.audit_immutable();
-- Preview counts only customers with a destination for the chosen channel.
do $$declare body text;begin
 body:=pg_get_functiondef('communication_private.segment(uuid,uuid,jsonb,text)'::regprocedure);
 body:=replace(body,'and communication_private.allowed(t,c.id,ch)','and communication_private.allowed(t,c.id,ch) and exists(select 1 from jsonb_array_elements(c.profile->''contacts'') x where x->>''kind''=case when ch=''email'' then ''email'' else ''phone'' end)');execute body;
 body:=pg_get_functiondef('public.save_lead(uuid,jsonb,uuid,integer)'::regprocedure);
 body:=replace(body,$old$if jsonb_typeof(data->'consent')$old$,$new$if jsonb_typeof(data->'consent'->'source') is distinct from 'string' or length(data->'consent'->>'source')>500 then raise exception 'Invalid consent source' using errcode='23514';end if;
 if jsonb_typeof(data->'consent')$new$);execute body;
end;$$;
revoke all on all functions in schema communication_private from public,anon,authenticated;
