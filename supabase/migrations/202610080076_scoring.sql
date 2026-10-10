create schema scoring_private;
revoke all on schema scoring_private from public,anon,authenticated;
create table public.scoring_evidence(tenant_id uuid not null,client_id uuid primary key,branch_id uuid not null,employment_months int check(employment_months between 0 and 1200),verified_references int check(verified_references between 0 and 100),note text not null check(length(note) between 2 and 1000),updated_by uuid references auth.users(id),updated_at timestamptz not null default now(),foreign key(client_id,tenant_id) references public.clients(id,tenant_id),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id));
create table public.client_risk_assessments(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,client_id uuid not null,branch_id uuid not null,configuration jsonb not null,metrics jsonb not null,result jsonb not null,assessed_by uuid references auth.users(id),assessed_at timestamptz not null default now(),foreign key(client_id,tenant_id) references public.clients(id,tenant_id),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id));
create index on public.client_risk_assessments(tenant_id,client_id,assessed_at desc);
alter table public.scoring_evidence enable row level security;
alter table public.client_risk_assessments enable row level security;
grant select on public.scoring_evidence,public.client_risk_assessments to authenticated;
create policy client_scope on public.scoring_evidence for select to authenticated using(public.client_allowed(tenant_id,client_id,'clients.read'));
create policy client_scope on public.client_risk_assessments for select to authenticated using(public.client_allowed(tenant_id,client_id,'clients.read'));
create trigger evidence_audit after insert or update on public.scoring_evidence for each row execute function public.record_audit();
create trigger score_audit after insert on public.client_risk_assessments for each row execute function public.record_audit();
create trigger score_immutable before update or delete on public.client_risk_assessments for each row execute function public.audit_immutable();
create trigger score_no_truncate before truncate on public.client_risk_assessments for each statement execute function public.audit_immutable();
create function scoring_private.defaults() returns jsonb language sql immutable set search_path='' as $$select $cfg${"criteria":[{"key":"punctuality","weight":30,"missingScore":50,"bands":[{"until":"60","score":10},{"until":"80","score":40},{"until":"95","score":70},{"until":null,"score":100}]},{"key":"averageDelay","weight":20,"missingScore":50,"bands":[{"until":"0","score":100},{"until":"7","score":70},{"until":"30","score":35},{"until":null,"score":0}]},{"key":"previousLoans","weight":10,"missingScore":50,"bands":[{"until":"0","score":30},{"until":"2","score":60},{"until":null,"score":100}]},{"key":"tenureDays","weight":10,"missingScore":50,"bands":[{"until":"90","score":30},{"until":"365","score":60},{"until":null,"score":100}]},{"key":"paymentRatio","weight":20,"missingScore":50,"bands":[{"until":"20","score":100},{"until":"35","score":70},{"until":"50","score":30},{"until":null,"score":0}]},{"key":"employmentMonths","weight":5,"missingScore":50,"bands":[{"until":"6","score":30},{"until":"24","score":60},{"until":null,"score":100}]},{"key":"verifiedReferences","weight":5,"missingScore":50,"bands":[{"until":"0","score":20},{"until":"1","score":60},{"until":null,"score":100}]}],"classes":[{"key":"A","minScore":80,"suggestedLimit":"5000000"},{"key":"B","minScore":65,"suggestedLimit":"3000000"},{"key":"C","minScore":50,"suggestedLimit":"1500000"},{"key":"D","minScore":35,"suggestedLimit":"500000"},{"key":"E","minScore":0,"suggestedLimit":"0"}],"provisions":[{"name":"Em dia","fromDays":0,"percentage":"0"},{"name":"1–30 dias","fromDays":1,"percentage":"1"},{"name":"31–60 dias","fromDays":31,"percentage":"5"},{"name":"61–90 dias","fromDays":61,"percentage":"20"},{"name":"Mais de 90 dias","fromDays":91,"percentage":"50"}]}$cfg$::jsonb$$;
insert into public.tenant_configuration(tenant_id,category,key,value) select id,'scoring','main',scoring_private.defaults() from public.tenants on conflict do nothing;
create function scoring_private.new_tenant() returns trigger language plpgsql security definer set search_path='' as $$begin perform set_config('loma.scoring_config','on',true);insert into public.tenant_configuration(tenant_id,category,key,value) values(new.id,'scoring','main',scoring_private.defaults());return new;end;$$;
create trigger scoring_defaults after insert on public.tenants for each row execute function scoring_private.new_tenant();
create function scoring_private.valid(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare c jsonb;b jsonb;g jsonb;prev numeric;weight numeric:=0;keys text[]:='{}';n int:=0;begin
 if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'criteria') is distinct from 'array' or jsonb_array_length(v->'criteria')<>7 or jsonb_typeof(v->'classes') is distinct from 'array' or jsonb_array_length(v->'classes')<>5 or jsonb_typeof(v->'provisions') is distinct from 'array' or jsonb_array_length(v->'provisions') not between 1 and 12 then return false;end if;
 for c in select value from jsonb_array_elements(v->'criteria') loop
 if not c ?& array['key','weight','missingScore','bands'] or c->>'key' not in ('punctuality','averageDelay','previousLoans','tenureDays','paymentRatio','employmentMonths','verifiedReferences') or c->>'key'=any(keys) or jsonb_typeof(c->'weight')<>'number' or (c->>'weight')::numeric not between 0 and 100 or (c->>'weight')::numeric<>trunc((c->>'weight')::numeric) or (c->>'missingScore')::numeric not between 0 and 100 or (c->>'missingScore')::numeric<>trunc((c->>'missingScore')::numeric) or jsonb_typeof(c->'bands')<>'array' or jsonb_array_length(c->'bands') not between 1 and 12 or c->'bands'->-1->'until'<>'null'::jsonb then return false;end if;
 keys:=array_append(keys,c->>'key');weight:=weight+(c->>'weight')::numeric;prev:=-1;n:=0;
 for b in select value from jsonb_array_elements(c->'bands') loop n:=n+1;if not b ?& array['until','score'] or jsonb_typeof(b->'score')<>'number' or (b->>'score')::numeric not between 0 and 100 or (b->>'score')::numeric<>trunc((b->>'score')::numeric) then return false;end if;
 if n<jsonb_array_length(c->'bands') then if jsonb_typeof(b->'until')<>'string' or b->>'until' !~ '^[0-9]+(\.[0-9]{1,12})?$' or (b->>'until')::numeric<=prev then return false;end if;prev:=(b->>'until')::numeric;end if;end loop;end loop;
 if weight=0 then return false;end if;prev:=101;n:=0;
 for g in select value from jsonb_array_elements(v->'classes') loop n:=n+1;if not g ?& array['key','minScore','suggestedLimit'] or g->>'key'<>substr('ABCDE',n,1) or jsonb_typeof(g->'minScore')<>'number' or (g->>'minScore')::numeric not between 0 and 100 or (g->>'minScore')::numeric<>trunc((g->>'minScore')::numeric) or (g->>'minScore')::numeric>=prev or jsonb_typeof(g->'suggestedLimit')<>'string' or g->>'suggestedLimit' !~ '^[0-9]{1,19}$' or (g->>'suggestedLimit')::numeric>9223372036854775807 then return false;end if;prev:=(g->>'minScore')::numeric;end loop;if prev<>0 then return false;end if;
 prev:=-1;for g in select value from jsonb_array_elements(v->'provisions') loop if not g ?& array['name','fromDays','percentage'] or jsonb_typeof(g->'name')<>'string' or length(trim(g->>'name')) not between 2 and 80 or jsonb_typeof(g->'fromDays')<>'number' or (g->>'fromDays')::numeric<>trunc((g->>'fromDays')::numeric) or (g->>'fromDays')::numeric not between 0 and 36500 or (g->>'fromDays')::numeric<=prev or (prev=-1 and (g->>'fromDays')::int<>0) or jsonb_typeof(g->'percentage')<>'string' or g->>'percentage' !~ '^[0-9]+(\.[0-9]{1,12})?$' or (g->>'percentage')::numeric not between 0 and 100 then return false;end if;prev:=(g->>'fromDays')::numeric;end loop;return true;
 exception when others then return false;end;$$;
create function scoring_private.evaluate(cfg jsonb,m jsonb) returns jsonb language plpgsql immutable set search_path='' as $$declare c jsonb;b jsonb;g jsonb;metric_value numeric;points int;total numeric:=0;weights numeric:=0;score numeric;details jsonb:='[]';begin
 if not scoring_private.valid(cfg) then raise exception 'Invalid scoring configuration' using errcode='23514';end if;
 for c in select value from jsonb_array_elements(cfg->'criteria') loop
 metric_value:=(m->> (c->>'key'))::numeric;points:=(c->>'missingScore')::int;
 if metric_value is not null then for b in select value from jsonb_array_elements(c->'bands') loop if b->>'until' is null or metric_value<=(b->>'until')::numeric then points:=(b->>'score')::int;exit;end if;end loop;end if;
 total:=total+points*(c->>'weight')::int;weights:=weights+(c->>'weight')::int;
 details:=details||jsonb_build_object('key',c->>'key','metric',m->(c->>'key'),'points',points,'weight',(c->>'weight')::int,'missing',metric_value is null);
 end loop;score:=round(total/weights,2);
 select value into g from jsonb_array_elements(cfg->'classes') where score>=(value->>'minScore')::numeric order by (value->>'minScore')::numeric desc limit 1;
 return jsonb_build_object('score',score::text,'class',g->>'key','suggestedLimit',g->>'suggestedLimit','details',details);
end;$$;
create function scoring_private.metrics(t uuid,cid uuid,payment text default null) returns jsonb language plpgsql stable set search_path='' as $$declare c public.clients;e public.scoring_evidence;punctual numeric;delay numeric;previous int;due bigint;today date:=(now() at time zone 'Africa/Maputo')::date;begin
 select * into strict c from public.clients where id=cid and tenant_id=t;
 select * into e from public.scoring_evidence where tenant_id=t and client_id=cid;
 select count(*) into previous from public.loans l join public.contracts co on co.id=l.contract_id and co.tenant_id=t join public.applications a on a.id=co.application_id and a.tenant_id=t where l.tenant_id=t and a.client_id=cid and l.status='settled';
 with evidence as(select i.due_date,i.principal+i.interest remaining,max(p.paid_on) filter(where x->>'component' in ('principal','interest')) paid_on from public.loan_instalments i join public.loans l on l.id=i.loan_id and l.tenant_id=t join public.contracts co on co.id=l.contract_id and co.tenant_id=t join public.applications a on a.id=co.application_id and a.tenant_id=t left join public.payments p on p.loan_id=l.id and p.tenant_id=t and not exists(select 1 from public.payment_reversals r where r.tenant_id=t and r.payment_id=p.id) left join lateral jsonb_array_elements(p.allocations) x on (x->>'number')::int=i.number where i.tenant_id=t and a.client_id=cid and i.number>0 and (i.due_date<=today or i.principal+i.interest=0) group by i.loan_id,i.number,i.due_date,i.principal,i.interest)
 select round(100.0*count(*) filter(where remaining=0 and paid_on<=due_date)/nullif(count(*),0),6),round(avg(greatest(0,case when remaining>0 then today-due_date else coalesce(paid_on,due_date)-due_date end)),6) into punctual,delay from evidence;
 if payment is not null then due:=payment::bigint;else
 select coalesce(max(i.principal+i.interest),0) into due from public.loan_instalments i join public.loans l on l.id=i.loan_id and l.tenant_id=t join public.contracts co on co.id=l.contract_id and co.tenant_id=t join public.applications a on a.id=co.application_id and a.tenant_id=t where i.tenant_id=t and a.client_id=cid and i.principal+i.interest>0;
 end if;
 return jsonb_build_object('punctuality',punctual::text,'averageDelay',delay::text,'previousLoans',previous::text,'tenureDays',greatest(0,today-c.created_at::date)::text,'paymentRatio',case when (c.profile->>'income')::numeric>0 and due>0 then round(due*100.0/(c.profile->>'income')::numeric,6)::text else null end,'employmentMonths',e.employment_months::text,'verifiedReferences',e.verified_references::text);
end;$$;
create function scoring_private.refresh(t uuid,cid uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare cfg jsonb;m jsonb;r jsonb;old public.client_risk_assessments;b uuid;e public.scoring_evidence;begin
 select value into strict cfg from public.tenant_configuration where tenant_id=t and category='scoring' and key='main';
 select branch_id into strict b from public.clients where tenant_id=t and id=cid for update;
 m:=scoring_private.metrics(t,cid);r:=scoring_private.evaluate(cfg,m);
 select * into old from public.client_risk_assessments where tenant_id=t and client_id=cid order by assessed_at desc,id desc limit 1;
 if old.id is null or old.configuration is distinct from cfg or old.metrics is distinct from m or old.result is distinct from r then
 insert into public.client_risk_assessments(tenant_id,client_id,branch_id,configuration,metrics,result,assessed_by) values(t,cid,b,cfg,m,r,auth.uid());
 perform set_config('loma.consent_override','on',true);update public.clients set risk_class=r->>'class' where tenant_id=t and id=cid and risk_class is distinct from r->>'class';
 end if;select * into e from public.scoring_evidence where tenant_id=t and client_id=cid;
 return r||jsonb_build_object('metrics',m,'config',cfg,'evidence',case when e.client_id is null then null else jsonb_build_object('employmentMonths',e.employment_months,'verifiedReferences',e.verified_references,'note',e.note) end);
end;$$;
create function public.client_score(t uuid,cid uuid,payment text default null) returns jsonb language plpgsql security definer set search_path='' as $$declare r jsonb;begin
 if not public.client_allowed(t,cid,'clients.read') then raise exception 'Access denied' using errcode='42501';end if;
 if payment is not null and (payment !~ '^[0-9]{1,19}$' or payment::numeric>9223372036854775807) then raise exception 'Invalid payment' using errcode='23514';end if;
 r:=scoring_private.refresh(t,cid);
 if payment is not null then r:=scoring_private.evaluate(r->'config',scoring_private.metrics(t,cid,payment))||jsonb_build_object('metrics',scoring_private.metrics(t,cid,payment),'config',r->'config','evidence',r->'evidence');end if;return r;
end;$$;
create function public.save_scoring_evidence(t uuid,cid uuid,input jsonb) returns void language plpgsql security definer set search_path='' as $$declare b uuid;begin
 if not public.client_allowed(t,cid,'clients.manage') then raise exception 'Access denied' using errcode='42501';end if;
 if not input ?& array['employmentMonths','verifiedReferences','note'] or jsonb_typeof(input->'note')<>'string' or length(trim(input->>'note')) not between 2 and 1000 or (input->>'employmentMonths')::numeric is distinct from trunc((input->>'employmentMonths')::numeric) or (input->>'verifiedReferences')::numeric is distinct from trunc((input->>'verifiedReferences')::numeric) then raise exception 'Invalid evidence' using errcode='23514';end if;
 select branch_id into strict b from public.clients where tenant_id=t and id=cid;
 insert into public.scoring_evidence(tenant_id,client_id,branch_id,employment_months,verified_references,note,updated_by) values(t,cid,b,(input->>'employmentMonths')::int,(input->>'verifiedReferences')::int,trim(input->>'note'),auth.uid()) on conflict(client_id) do update set branch_id=excluded.branch_id,employment_months=excluded.employment_months,verified_references=excluded.verified_references,note=excluded.note,updated_by=excluded.updated_by,updated_at=now();
 perform scoring_private.refresh(t,cid);
end;$$;
create function scoring_private.guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='DELETE' then if old.category='scoring' then raise exception 'Cannot delete scoring' using errcode='42501';end if;return old;end if;
 if new.category='scoring' then if new.key<>'main' or not scoring_private.valid(new.value) then raise exception 'Invalid scoring' using errcode='23514';end if;
 if auth.uid() is not null and current_setting('loma.scoring_config',true) is distinct from 'on' then raise exception 'Use scoring RPC' using errcode='42501';end if;end if;return new;end;$$;
create trigger scoring_config_guard before insert or update or delete on public.tenant_configuration for each row execute function scoring_private.guard();
create function public.save_scoring_configuration(t uuid,settings jsonb,expected jsonb) returns void language plpgsql security definer set search_path='' as $$declare current jsonb;c record;begin
 if not public.has_permission(t,'tenant.manage') then raise exception 'Access denied' using errcode='42501';end if;
 if not scoring_private.valid(settings) then raise exception 'Invalid scoring' using errcode='23514';end if;
 perform 1 from public.tenants where id=t for update;
 select value into strict current from public.tenant_configuration where tenant_id=t and category='scoring' and key='main' for update;
 if current is distinct from expected then raise exception 'Settings changed' using errcode='PT409';end if;
 perform set_config('loma.scoring_config','on',true);update public.tenant_configuration set value=settings where tenant_id=t and category='scoring' and key='main';
 for c in select id from public.clients where tenant_id=t order by id loop perform scoring_private.refresh(t,c.id);end loop;
end;$$;
-- Changed profile, payments and accruals refresh cached campaign class; history stays append-only.
create function scoring_private.changed() returns trigger language plpgsql security definer set search_path='' as $$declare cid uuid;begin
 if tg_table_name='clients' then if tg_op='UPDATE' and new.profile is not distinct from old.profile and new.created_at is not distinct from old.created_at then return new;end if;cid:=new.id;
 else select a.client_id into cid from public.loans l join public.contracts co on co.id=l.contract_id and co.tenant_id=l.tenant_id join public.applications a on a.id=co.application_id and a.tenant_id=co.tenant_id where l.tenant_id=new.tenant_id and l.id=new.loan_id;end if;
 if cid is not null then perform scoring_private.refresh(new.tenant_id,cid);end if;return new;end;$$;
create trigger client_score_changed after insert or update on public.clients for each row execute function scoring_private.changed();
create trigger loan_score_changed after update on public.loan_accounts for each row execute function scoring_private.changed();
revoke all on all functions in schema scoring_private from public,anon,authenticated;
revoke all on function public.client_score(uuid,uuid,text),public.save_scoring_evidence(uuid,uuid,jsonb),public.save_scoring_configuration(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.client_score(uuid,uuid,text),public.save_scoring_evidence(uuid,uuid,jsonb),public.save_scoring_configuration(uuid,jsonb,jsonb) to authenticated;
