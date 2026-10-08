-- The historical engine attests immutable plans; all mutable accounting is authoritative SQL.
create schema if not exists financial_private;
revoke all on schema financial_private from public,anon,authenticated;
create table financial_private.signing_key (id boolean primary key default true check(id), secret text not null);
insert into financial_private.signing_key(secret) values(encode(extensions.gen_random_bytes(32),'hex'));
create function financial_private.verify_plan(payload text,signature text,t uuid,c uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb; k text;begin
 select secret into strict k from financial_private.signing_key where id;
 if signature is null or signature<>encode(extensions.hmac(convert_to(payload,'UTF8'),convert_to(k,'UTF8'),'sha256'),'hex') then raise exception 'Invalid financial attestation' using errcode='42501';end if;
 p:=payload::jsonb;
 if p->>'tenant'<>t::text or p->>'contract'<>c::text or p->>'actor'<>auth.uid()::text or (p->>'expires')::timestamptz<now() then raise exception 'Invalid financial attestation' using errcode='42501';end if;
 return p->'plan';
end;$$;
revoke all on all functions in schema financial_private from public,anon,authenticated;

create table public.loan_accounts (
 tenant_id uuid not null,loan_id uuid primary key,branch_id uuid not null,revision integer not null default 1,credit bigint not null default 0 check(credit>=0),
 foreign key(loan_id,tenant_id) references public.loans(id,tenant_id),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id),unique(loan_id,tenant_id)
);
create table public.loan_instalments (
 tenant_id uuid not null,loan_id uuid not null,branch_id uuid not null,number integer not null,from_date date not null,due_date date not null,
 principal bigint not null check(principal>=0),interest bigint not null check(interest>=0),fine bigint not null default 0 check(fine>=0),late_interest bigint not null default 0 check(late_interest>=0),
 late_raw numeric not null default 0,late_assessed bigint not null default 0,fine_assessed boolean not null default false,accrued_on date not null,
 primary key(loan_id,number),foreign key(loan_id,tenant_id) references public.loans(id,tenant_id),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id)
);
create table public.receipt_counters (tenant_id uuid primary key references public.tenants(id),last_number bigint not null default 0);
create table public.cash_sessions (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,day date not null,opening bigint not null check(opening>=0),
 opened_by uuid not null references auth.users(id),opened_at timestamptz not null default now(),closed_at timestamptz,closed_by uuid references auth.users(id),counted bigint check(counted>=0),expected bigint,difference_reason text not null default '',
 unique(tenant_id,branch_id,day),unique(id,tenant_id),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id)
);
create table public.payments (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,loan_id uuid not null,branch_id uuid not null,request_id uuid not null,
 amount bigint not null check(amount>0),method text not null check(method in ('cash','mpesa','emola','mkesh','transfer','deposit')),reference text not null check(length(reference) between 1 and 200),paid_on date not null,
 receipt_number bigint not null,receipt_snapshot jsonb not null,allocations jsonb not null,credit bigint not null check(credit>=0),cash_session_id uuid,
 recorded_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(id,tenant_id),unique(tenant_id,request_id),unique(tenant_id,receipt_number),
 foreign key(loan_id,tenant_id) references public.loans(id,tenant_id),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id),foreign key(cash_session_id,tenant_id) references public.cash_sessions(id,tenant_id)
);
create table public.payment_reversals (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,payment_id uuid not null,loan_id uuid not null,branch_id uuid not null,reason text not null check(length(trim(reason)) between 2 and 2000),cash_session_id uuid,
 recorded_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(tenant_id,payment_id),
 foreign key(payment_id,tenant_id) references public.payments(id,tenant_id),foreign key(loan_id,tenant_id) references public.loans(id,tenant_id),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id),foreign key(cash_session_id,tenant_id) references public.cash_sessions(id,tenant_id)
);
create table public.cash_deposits (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,cash_session_id uuid not null,request_id uuid not null,amount bigint not null check(amount>0),reference text not null check(length(trim(reference)) between 1 and 200),recorded_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(tenant_id,request_id),
 foreign key(cash_session_id,tenant_id) references public.cash_sessions(id,tenant_id),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id)
);
create function financial_private.balanced(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(p)='array' and jsonb_array_length(p)>=2 and coalesce(sum((x->>'debit')::numeric-(x->>'credit')::numeric),1)=0 and bool_and((x->>'debit') ~ '^[0-9]+$' and (x->>'credit') ~ '^[0-9]+$' and ((x->>'debit')::numeric=0 or (x->>'credit')::numeric=0) and length(x->>'account')>0) from jsonb_array_elements(p) x
$$;
create table public.journal_transactions (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,loan_id uuid,payment_id uuid,cash_session_id uuid,source text not null,source_key text not null,postings jsonb not null check(financial_private.balanced(postings)),created_at timestamptz not null default now(),unique(tenant_id,source,source_key),
 foreign key(branch_id,tenant_id) references public.branches(id,tenant_id),foreign key(loan_id,tenant_id) references public.loans(id,tenant_id),foreign key(payment_id,tenant_id) references public.payments(id,tenant_id),foreign key(cash_session_id,tenant_id) references public.cash_sessions(id,tenant_id)
);
create index on public.loan_instalments(tenant_id,branch_id,due_date);
create index on public.payments(tenant_id,branch_id,paid_on);
create index on public.journal_transactions(tenant_id,branch_id,loan_id);
do $$declare tbl text;begin
 foreach tbl in array array['loan_accounts','loan_instalments','receipt_counters','cash_sessions','payments','payment_reversals','cash_deposits','journal_transactions'] loop
 execute format('alter table public.%I enable row level security',tbl);
 execute format('create trigger audit_record after insert or update on public.%I for each row execute function public.record_audit()',tbl);
 if tbl<>'receipt_counters' then
 execute format('grant select on public.%I to authenticated',tbl);
 execute format('create policy scoped_read on public.%I for select to authenticated using ((public.has_permission(tenant_id,''loans.read'') or public.has_permission(tenant_id,''payments.manage'')) and public.branch_allowed(tenant_id,branch_id))',tbl);
 end if;
 end loop;
 foreach tbl in array array['payments','payment_reversals','cash_deposits','journal_transactions'] loop
 execute format('create trigger immutable_record before update or delete on public.%I for each row execute function public.audit_immutable()',tbl);
 execute format('create trigger no_truncate before truncate on public.%I for each statement execute function public.audit_immutable()',tbl);
 end loop;
end;$$;
alter table public.client_events drop constraint client_events_kind_check;
alter table public.client_events add constraint client_events_kind_check check(kind in ('created','updated','consent','note','document','application','payment','reversal'));

create function financial_private.posting(account text,debit bigint,credit bigint) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('account',account,'debit',debit::text,'credit',credit::text)$$;
create function financial_private.cash_session(t uuid,b uuid) returns uuid language plpgsql set search_path='' as $$declare s public.cash_sessions;begin
 select * into s from public.cash_sessions where tenant_id=t and branch_id=b and day=(now() at time zone 'Africa/Maputo')::date for update;
 if s.id is null or s.closed_at is not null then raise exception 'Open cash required' using errcode='PT412';end if;
 return s.id;
end;$$;
create function financial_private.status(l uuid) returns void language sql set search_path='' as $$
 update public.loans set status=case when not exists(select 1 from public.loan_instalments where loan_id=l and principal+interest+fine+late_interest>0) then 'settled' when exists(select 1 from public.loan_instalments where loan_id=l and due_date<(now() at time zone 'Africa/Maputo')::date and principal+interest+fine+late_interest>0) then 'overdue' else 'active' end where id=l and status in ('active','overdue','settled');
$$;
create function financial_private.initialise(t uuid,l uuid,p jsonb,session_id uuid default null) returns void language plpgsql set search_path='' as $$
declare ln public.loans;r jsonb;pr bigint:=0;it bigint:=0;sep bigint;net bigint;begin
 select * into strict ln from public.loans where id=l and tenant_id=t for update;
 if exists(select 1 from public.loan_accounts where loan_id=l) then return;end if;
 insert into public.loan_accounts(tenant_id,loan_id,branch_id) values(t,l,ln.branch_id);
 for r in select value from jsonb_array_elements(p->'instalments') loop
 insert into public.loan_instalments(tenant_id,loan_id,branch_id,number,from_date,due_date,principal,interest,accrued_on) values(t,l,ln.branch_id,(r->>'number')::integer,(r->>'from')::date,(r->>'dueDate')::date,(r->>'principal')::bigint,(r->>'interest')::bigint,ln.disbursed_on);
 pr:=pr+(r->>'principal')::bigint;it:=it+(r->>'interest')::bigint;
 end loop;
 sep:=(p->>'separate')::bigint;net:=(p->>'disbursed')::bigint;
 if sep>0 then insert into public.loan_instalments(tenant_id,loan_id,branch_id,number,from_date,due_date,principal,interest,accrued_on) values(t,l,ln.branch_id,0,ln.disbursed_on,ln.disbursed_on,0,sep,ln.disbursed_on);end if;
 insert into public.journal_transactions(tenant_id,branch_id,loan_id,cash_session_id,source,source_key,postings) values(t,ln.branch_id,l,session_id,'disbursement',l::text,jsonb_build_array(financial_private.posting('receivable_principal',pr,0),financial_private.posting('receivable_interest',it+sep,0),financial_private.posting('funds_'||ln.method,0,net),financial_private.posting('deferred_income',0,pr+it+sep-net)));
end;$$;
-- Replace the old public boundary; preserve all M4 approval/date/limit guards internally.
alter function public.disburse_application(uuid,uuid,integer,text,text,date,date) rename to disburse_application_v4;
revoke all on function public.disburse_application_v4(uuid,uuid,integer,text,text,date,date) from public,anon,authenticated;
create function public.disburse_application(t uuid,a_id uuid,expected_revision integer,payment_method text,payment_reference text,disbursement_date date,signature_date date,plan_payload text,plan_signature text) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contracts;p jsonb;l uuid;sid uuid;begin
 if not public.has_permission(t,'loans.disburse') then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.tenants where id=t for update;
 select * into c from public.contracts where tenant_id=t and application_id=a_id;
 if c.id is null or not public.branch_allowed(t,c.branch_id) then raise exception 'Access denied' using errcode='42501';end if;
 p:=financial_private.verify_plan(plan_payload,plan_signature,t,c.id);
 if payment_method='cash' then sid:=financial_private.cash_session(t,c.branch_id);end if;
 l:=public.disburse_application_v4(t,a_id,expected_revision,payment_method,payment_reference,disbursement_date,signature_date);
 perform financial_private.initialise(t,l,p,sid);
 return l;
end;$$;
create function public.initialise_loan(t uuid,l uuid,plan_payload text,plan_signature text) returns void language plpgsql security definer set search_path='' as $$
declare ln public.loans;p jsonb;begin
 if not public.has_permission(t,'loans.read') then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.tenants where id=t for update;
 select * into ln from public.loans where id=l and tenant_id=t for update;
 if ln.id is null or not public.branch_allowed(t,ln.branch_id) then raise exception 'Access denied' using errcode='42501';end if;
 p:=financial_private.verify_plan(plan_payload,plan_signature,t,ln.contract_id);
 perform financial_private.initialise(t,l,p);
end;$$;

create function financial_private.accrue(t uuid,l uuid,as_of date) returns void language plpgsql set search_path='' as $$
declare ln public.loans;pol jsonb;r public.loan_instalments;raw numeric;delta bigint;f bigint;days integer;changed boolean:=false;begin
 select * into strict ln from public.loans where id=l and tenant_id=t for update;
 select snapshot->'terms'->'penalty' into strict pol from public.contracts where id=ln.contract_id and tenant_id=t;
 for r in select * from public.loan_instalments where loan_id=l order by number for update loop
 if as_of<r.accrued_on then raise exception 'Cannot backdate accrual' using errcode='23514';end if;
 if as_of=r.accrued_on then continue;end if;
 days:=greatest(0,as_of-greatest(r.accrued_on,r.due_date+(pol->>'toleranceDays')::integer));
 raw:=r.late_raw+(r.principal+r.interest)::numeric*(pol->>'dailyRate')::numeric*days;
 delta:=round(raw)::bigint-r.late_assessed;f:=0;
 if days>0 and r.principal+r.interest>0 and not r.fine_assessed then
 f:=case when pol->'fine'->>'kind'='fixed' then (pol->'fine'->>'value')::bigint else round((r.principal+r.interest)::numeric*(pol->'fine'->>'value')::numeric)::bigint end;
 end if;
 update public.loan_instalments set late_raw=raw,late_assessed=round(raw)::bigint,late_interest=late_interest+delta,fine=fine+f,fine_assessed=fine_assessed or (days>0 and r.principal+r.interest>0),accrued_on=as_of where loan_id=l and number=r.number;
 if delta+f>0 then
 insert into public.journal_transactions(tenant_id,branch_id,loan_id,source,source_key,postings) values(t,ln.branch_id,l,'accrual',l||':'||r.number||':'||as_of,jsonb_build_array(financial_private.posting('receivable_lateInterest',delta,0),financial_private.posting('receivable_fine',f,0),financial_private.posting('penalty_income',0,delta+f)));
 end if;
 changed:=true;
 end loop;
 if changed then update public.loan_accounts set revision=revision+1 where loan_id=l;end if;
 perform financial_private.status(l);
end;$$;
create function public.refresh_loan(t uuid,l uuid) returns void language plpgsql security definer set search_path='' as $$declare ln public.loans;begin
 if not public.has_permission(t,'loans.read') and not public.has_permission(t,'payments.manage') then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.tenants where id=t for update;
 select * into ln from public.loans where id=l and tenant_id=t for update;
 if ln.id is null or not public.branch_allowed(t,ln.branch_id) then raise exception 'Access denied' using errcode='42501';end if;
 if not exists(select 1 from public.loan_accounts where loan_id=l) then raise exception 'Plan required' using errcode='23514';end if;
 perform financial_private.accrue(t,l,(now() at time zone 'Africa/Maputo')::date);
end;$$;
-- Scheduler only has an owner-level entry point, never callable by anon/authenticated.
create function financial_private.daily() returns void language plpgsql set search_path='' as $$declare r record;begin
 for r in select tenant_id,loan_id from public.loan_accounts order by tenant_id,loan_id loop
 perform 1 from public.tenants where id=r.tenant_id for update;
 perform financial_private.accrue(r.tenant_id,r.loan_id,(now() at time zone 'Africa/Maputo')::date);
 end loop;
end;$$;

create function financial_private.allocation(t uuid,l uuid,amount bigint) returns jsonb language plpgsql set search_path='' as $$
declare r public.loan_instalments;terms jsonb;k text;avail bigint;v bigint;leftover bigint:=amount;a jsonb:='[]';begin
 if amount<=0 then raise exception 'Invalid amount' using errcode='23514';end if;
 select c.snapshot->'terms' into strict terms from public.loans ln join public.contracts c on c.id=ln.contract_id and c.tenant_id=ln.tenant_id where ln.id=l and ln.tenant_id=t;
 for r in select * from public.loan_instalments where loan_id=l order by due_date,number loop
 if terms->>'excess'='credit' and r.due_date>(now() at time zone 'Africa/Maputo')::date then continue;end if;
 for k in select jsonb_array_elements_text(terms->'allocation') loop
 avail:=case k when 'principal' then r.principal when 'interest' then r.interest when 'fine' then r.fine when 'lateInterest' then r.late_interest end;
 v:=least(leftover,avail);
 if v>0 then a:=a||jsonb_build_object('number',r.number,'component',k,'amount',v::text);leftover:=leftover-v;end if;
 end loop;
 end loop;
 return jsonb_build_object('allocations',a,'credit',leftover::text);
end;$$;
create function public.preview_payment(t uuid,l uuid,amount text) returns jsonb language plpgsql security definer set search_path='' as $$declare ln public.loans;rev integer;p jsonb;begin
 if not public.has_permission(t,'payments.manage') then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.tenants where id=t for update;
 select * into ln from public.loans where id=l and tenant_id=t for update;
 if ln.id is null or not public.branch_allowed(t,ln.branch_id) then raise exception 'Access denied' using errcode='42501';end if;
 if not exists(select 1 from public.loan_accounts where loan_id=l) then raise exception 'Plan required' using errcode='23514';end if;
 perform financial_private.accrue(t,l,(now() at time zone 'Africa/Maputo')::date);
 select revision into rev from public.loan_accounts where loan_id=l;
 p:=financial_private.allocation(t,l,amount::bigint);
 return p||jsonb_build_object('revision',rev,'day',(now() at time zone 'Africa/Maputo')::date);
end;$$;
create function public.record_payment(t uuid,l uuid,amount text,payment_method text,payment_reference text,expected_revision integer,expected_day date,request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare ln public.loans;existing public.payments;p jsonb;r jsonb;v bigint;pid uuid:=gen_random_uuid();n bigint;sid uuid;snap jsonb;postings jsonb;today date:=(now() at time zone 'Africa/Maputo')::date;begin
 if not public.has_permission(t,'payments.manage') then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.tenants where id=t for update;
 select * into ln from public.loans where id=l and tenant_id=t for update;
 if ln.id is null or not public.branch_allowed(t,ln.branch_id) then raise exception 'Access denied' using errcode='42501';end if;
 select * into existing from public.payments where tenant_id=t and payments.request_id=record_payment.request_id;
 if existing.id is not null then
 if existing.loan_id<>l or existing.amount<>amount::bigint or existing.method<>payment_method or existing.reference<>trim(payment_reference) then raise exception 'Idempotency conflict' using errcode='PT409';end if;
 return existing.id;end if;
 if expected_day is distinct from today then raise exception 'Preview expired' using errcode='PT409';end if;
 if not exists(select 1 from public.loan_accounts where loan_id=l) then raise exception 'Plan required' using errcode='23514';end if;
 perform financial_private.accrue(t,l,today);
 if (select revision from public.loan_accounts where loan_id=l)<>expected_revision then raise exception 'Loan changed' using errcode='PT409';end if;
 if ln.status in ('renegotiated','written_off') then raise exception 'Loan is not payable' using errcode='23514';end if;
 if payment_method='cash' then sid:=financial_private.cash_session(t,ln.branch_id);end if;
 p:=financial_private.allocation(t,l,amount::bigint);
 select snapshot into strict snap from public.contracts where id=ln.contract_id and tenant_id=t;
 snap:=jsonb_build_object('brand',snap->'brand','client',snap->'client'->>'name','contract',ln.contract_id,'template',coalesce((select value from public.tenant_configuration where tenant_id=t and category='document' and key='receipt'),jsonb_build_object('title','Recibo de pagamento','body','Recebemos de {nome} o valor de {valor}. Recibo {numero}.')));
 insert into public.receipt_counters(tenant_id,last_number) values(t,1) on conflict(tenant_id) do update set last_number=public.receipt_counters.last_number+1 returning last_number into n;
 insert into public.payments(id,tenant_id,loan_id,branch_id,request_id,amount,method,reference,paid_on,receipt_number,receipt_snapshot,allocations,credit,cash_session_id,recorded_by) values(pid,t,l,ln.branch_id,request_id,amount::bigint,payment_method,trim(payment_reference),today,n,snap,p->'allocations',(p->>'credit')::bigint,sid,auth.uid());
 postings:=jsonb_build_array(financial_private.posting('funds_'||payment_method,amount::bigint,0));
 for r in select value from jsonb_array_elements(p->'allocations') loop
 v:=(r->>'amount')::bigint;
 update public.loan_instalments set principal=principal-case when r->>'component'='principal' then v else 0 end,interest=interest-case when r->>'component'='interest' then v else 0 end,fine=fine-case when r->>'component'='fine' then v else 0 end,late_interest=late_interest-case when r->>'component'='lateInterest' then v else 0 end where loan_id=l and number=(r->>'number')::integer;
 postings:=postings||financial_private.posting('receivable_'||(r->>'component'),0,v);
 end loop;
 postings:=postings||financial_private.posting('client_credit',0,(p->>'credit')::bigint);
 insert into public.journal_transactions(tenant_id,branch_id,loan_id,payment_id,cash_session_id,source,source_key,postings) values(t,ln.branch_id,l,pid,sid,'payment',pid::text,postings);
 update public.loan_accounts set revision=revision+1,credit=credit+(p->>'credit')::bigint where loan_id=l;
 perform financial_private.status(l);
 insert into public.client_events(tenant_id,client_id,kind,detail,actor_id,actor_name) select t,a.client_id,'payment',jsonb_build_object('payment_id',pid,'loan_id',l,'amount',amount,'receipt',n::text),auth.uid(),coalesce((select display_name from public.memberships where tenant_id=t and user_id=auth.uid()),'Administração') from public.contracts c join public.applications a on a.id=c.application_id and a.tenant_id=c.tenant_id where c.id=ln.contract_id;
 return pid;
end;$$;
create function public.reverse_payment(t uuid,p_id uuid,reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.payments;r jsonb;v bigint;rid uuid:=gen_random_uuid();sid uuid;postings jsonb;begin
 if not public.has_permission(t,'tenant.manage') then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.tenants where id=t for update;
 select * into p from public.payments where id=p_id and tenant_id=t;
 if p.id is null or not public.branch_allowed(t,p.branch_id) then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.loans where id=p.loan_id for update;
 if exists(select 1 from public.payment_reversals where tenant_id=t and payment_id=p_id) then raise exception 'Already reversed' using errcode='PT409';end if;
 perform financial_private.accrue(t,p.loan_id,(now() at time zone 'Africa/Maputo')::date);
 if p.method='cash' then sid:=financial_private.cash_session(t,p.branch_id);end if;
 insert into public.payment_reversals(id,tenant_id,payment_id,loan_id,branch_id,reason,cash_session_id,recorded_by) values(rid,t,p_id,p.loan_id,p.branch_id,trim(reason),sid,auth.uid());
 for r in select value from jsonb_array_elements(p.allocations) loop
 v:=(r->>'amount')::bigint;
 update public.loan_instalments set principal=principal+case when r->>'component'='principal' then v else 0 end,interest=interest+case when r->>'component'='interest' then v else 0 end,fine=fine+case when r->>'component'='fine' then v else 0 end,late_interest=late_interest+case when r->>'component'='lateInterest' then v else 0 end where loan_id=p.loan_id and number=(r->>'number')::integer;
 end loop;
 select jsonb_agg(jsonb_build_object('account',x->>'account','debit',x->>'credit','credit',x->>'debit')) into postings from public.journal_transactions j cross join lateral jsonb_array_elements(j.postings) x where j.tenant_id=t and j.payment_id=p_id and j.source='payment';
 insert into public.journal_transactions(tenant_id,branch_id,loan_id,payment_id,cash_session_id,source,source_key,postings) values(t,p.branch_id,p.loan_id,p_id,sid,'reversal',rid::text,postings);
 update public.loan_accounts set revision=revision+1,credit=credit-p.credit where loan_id=p.loan_id;
 perform financial_private.status(p.loan_id);
 insert into public.client_events(tenant_id,client_id,kind,detail,actor_id,actor_name) select t,a.client_id,'reversal',jsonb_build_object('payment_id',p_id,'loan_id',p.loan_id,'reason',trim(reason)),auth.uid(),coalesce((select display_name from public.memberships where tenant_id=t and user_id=auth.uid()),'Administração') from public.loans ln join public.contracts c on c.id=ln.contract_id and c.tenant_id=ln.tenant_id join public.applications a on a.id=c.application_id and a.tenant_id=c.tenant_id where ln.id=p.loan_id;
 return rid;
end;$$;
create function financial_private.cash_expected(s uuid) returns bigint language sql stable set search_path='' as $$
 select cs.opening+coalesce((select sum((x->>'debit')::bigint-(x->>'credit')::bigint) from public.journal_transactions j cross join lateral jsonb_array_elements(j.postings) x where j.cash_session_id=s and x->>'account'='funds_cash' and j.source<>'cash_difference'),0)::bigint from public.cash_sessions cs where cs.id=s;
$$;
create function public.manage_cash(t uuid,b uuid,operation text,amount text,reference text default '',request_id uuid default gen_random_uuid()) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid;s public.cash_sessions;id uuid:=gen_random_uuid();a bigint:=amount::bigint;expected bigint;diff bigint;existing public.cash_deposits;begin
 if not public.has_permission(t,'loans.disburse') then raise exception 'Access denied' using errcode='42501';end if;
 if not public.branch_allowed(t,b) then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.tenants where id=t for update;
 if a<0 then raise exception 'Invalid amount' using errcode='23514';end if;
 if operation='open' then
 insert into public.cash_sessions(tenant_id,branch_id,day,opening,opened_by) values(t,b,(now() at time zone 'Africa/Maputo')::date,a,auth.uid()) returning id into sid;return sid;
 end if;
 sid:=financial_private.cash_session(t,b);
 expected:=financial_private.cash_expected(sid);
 if operation='deposit' then
 select * into existing from public.cash_deposits where tenant_id=t and cash_deposits.request_id=manage_cash.request_id;
 if existing.id is not null then
 if existing.amount<>a or existing.reference<>trim(reference) or existing.branch_id<>b then raise exception 'Idempotency conflict' using errcode='PT409';end if;
 return existing.id;end if;
 if a>expected then raise exception 'Insufficient cash' using errcode='PT412';end if;
 insert into public.cash_deposits(id,tenant_id,branch_id,cash_session_id,request_id,amount,reference,recorded_by) values(id,t,b,sid,request_id,a,trim(reference),auth.uid());
 insert into public.journal_transactions(tenant_id,branch_id,cash_session_id,source,source_key,postings) values(t,b,sid,'deposit',id::text,jsonb_build_array(financial_private.posting('funds_transfer',a,0),financial_private.posting('funds_cash',0,a)));
 return id;
 elsif operation='close' then
 diff:=a-expected;
 if diff<>0 and length(trim(reference))<2 then raise exception 'Difference reason required' using errcode='23514';end if;
 update public.cash_sessions set closed_at=now(),closed_by=auth.uid(),counted=a,expected=expected,difference_reason=trim(reference) where cash_sessions.id=sid;
 if diff<>0 then insert into public.journal_transactions(tenant_id,branch_id,cash_session_id,source,source_key,postings) values(t,b,sid,'cash_difference',sid::text,jsonb_build_array(financial_private.posting('funds_cash',greatest(diff,0),greatest(-diff,0)),financial_private.posting('cash_difference',greatest(-diff,0),greatest(diff,0))));end if;
 return sid;
 else raise exception 'Invalid cash operation' using errcode='23514';end if;
end;$$;
create function public.cash_summary(t uuid,b uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare s public.cash_sessions;begin
 if not public.has_permission(t,'loans.disburse') and not public.has_permission(t,'reports.read') then raise exception 'Access denied' using errcode='42501';end if;
 if not public.branch_allowed(t,b) then raise exception 'Access denied' using errcode='42501';end if;
 select * into s from public.cash_sessions where tenant_id=t and branch_id=b and day=(now() at time zone 'Africa/Maputo')::date;
 if s.id is null then return null;end if;
 return jsonb_build_object('id',s.id,'day',s.day,'opening',s.opening::text,'expected',coalesce(s.expected,financial_private.cash_expected(s.id))::text,'counted',s.counted::text,'closed',s.closed_at is not null,'reason',s.difference_reason,
 'movements',coalesce((select jsonb_agg(jsonb_build_object('source',j.source,'reference',coalesce(p.reference,ln.reference,d.reference,''),'amount',coalesce(p.amount::text,(select (x->>'credit') from jsonb_array_elements(j.postings) x where x->>'account'='funds_'||ln.method),d.amount::text,'0'),'method',coalesce(p.method,ln.method,'cash'),'id',j.id,'time',j.created_at) order by j.created_at) from public.journal_transactions j left join public.payments p on p.id=j.payment_id and p.tenant_id=j.tenant_id left join public.loans ln on ln.id=j.loan_id and ln.tenant_id=j.tenant_id left join public.cash_deposits d on d.id::text=j.source_key and d.tenant_id=j.tenant_id where j.tenant_id=t and j.branch_id=b and (j.created_at at time zone 'Africa/Maputo')::date=(now() at time zone 'Africa/Maputo')::date and j.source in ('payment','disbursement','reversal','deposit')), '[]'::jsonb));
end;$$;
create function public.loan_balance(t uuid,l uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare ln public.loans;begin
 if not public.has_permission(t,'loans.read') and not public.has_permission(t,'payments.manage') then raise exception 'Access denied' using errcode='42501';end if;
 select * into ln from public.loans where tenant_id=t and id=l;
 if ln.id is null or not public.branch_allowed(t,ln.branch_id) then raise exception 'Access denied' using errcode='42501';end if;
 return jsonb_build_object('status',ln.status,'revision',(select revision from public.loan_accounts where loan_id=l),'credit',(select credit::text from public.loan_accounts where loan_id=l),
 'total',coalesce((select sum(principal+interest+fine+late_interest)::text from public.loan_instalments where loan_id=l),'0'),
 'rows',coalesce((select jsonb_agg(jsonb_build_object('number',number,'dueDate',due_date,'principal',principal::text,'interest',interest::text,'fine',fine::text,'lateInterest',late_interest::text,'total',(principal+interest+fine+late_interest)::text) order by due_date,number) from public.loan_instalments where loan_id=l),'[]'),
 'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'amount',p.amount::text,'number',p.receipt_number::text,'method',p.method,'reference',p.reference,'date',p.paid_on,'reversed',exists(select 1 from public.payment_reversals r where r.payment_id=p.id and r.tenant_id=t)) order by p.created_at desc) from public.payments p where p.loan_id=l and p.tenant_id=t),'[]'));
end;$$;
create function public.today_summary(t uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare scope uuid;today date:=(now() at time zone 'Africa/Maputo')::date;begin
 if not public.has_permission(t,'tenant.read') then raise exception 'Access denied' using errcode='42501';end if;
 select branch_id into scope from public.memberships where tenant_id=t and user_id=auth.uid() and active;
 return jsonb_build_object(
 'due',case when public.has_permission(t,'loans.read') then coalesce((select sum(principal+interest+fine+late_interest)::text from public.loan_instalments where tenant_id=t and (scope is null or branch_id=scope) and due_date=today),'0') else null end,
 'overdue',case when public.has_permission(t,'loans.read') then coalesce((select sum(principal+interest+fine+late_interest)::text from public.loan_instalments where tenant_id=t and (scope is null or branch_id=scope) and due_date<today),'0') else null end,
 'pending',case when public.has_permission(t,'applications.read') then (select count(*) from public.applications where tenant_id=t and (scope is null or branch_id=scope) and status in ('submitted','in_review')) else null end,
 'disbursed',case when public.has_permission(t,'loans.read') then coalesce((select sum((x->>'credit')::numeric)::text from public.journal_transactions j cross join lateral jsonb_array_elements(j.postings) x where j.tenant_id=t and (scope is null or j.branch_id=scope) and j.source='disbursement' and x->>'account' like 'funds_%' and j.loan_id in(select id from public.loans where tenant_id=t and disbursed_on>=date_trunc('month',today)::date)),'0') else null end,
 'attention',case when public.has_permission(t,'loans.read') then coalesce((select jsonb_agg(row_to_json(z)) from (select l.id,c.snapshot->'client'->>'name' as name,min(i.due_date) as due_date,sum(i.principal+i.interest+i.fine+i.late_interest)::text as amount from public.loan_instalments i join public.loans l on l.id=i.loan_id and l.tenant_id=i.tenant_id join public.contracts c on c.id=l.contract_id and c.tenant_id=l.tenant_id where i.tenant_id=t and (scope is null or i.branch_id=scope) and i.due_date<=today and i.principal+i.interest+i.fine+i.late_interest>0 group by l.id,c.id order by min(i.due_date),l.id limit 20) z),'[]') else '[]'::jsonb end);
end;$$;
create function public.log_receipt_access(t uuid,p uuid) returns void language plpgsql security definer set search_path='' as $$declare b uuid;begin
 if not public.has_permission(t,'loans.read') and not public.has_permission(t,'payments.manage') then raise exception 'Access denied' using errcode='42501';end if;
 select branch_id into b from public.payments where tenant_id=t and id=p;
 if b is null or not public.branch_allowed(t,b) then raise exception 'Access denied' using errcode='42501';end if;
 insert into public.audit_events(tenant_id,actor_id,action,entity,entity_id,new_value) values(t,auth.uid(),'access','payments',p,jsonb_build_object('receipt',true));
end;$$;
revoke all on all functions in schema financial_private from public,anon,authenticated;
revoke all on function public.disburse_application(uuid,uuid,integer,text,text,date,date,text,text),public.initialise_loan(uuid,uuid,text,text),public.refresh_loan(uuid,uuid),public.preview_payment(uuid,uuid,text),public.record_payment(uuid,uuid,text,text,text,integer,date,uuid),public.reverse_payment(uuid,uuid,text),public.manage_cash(uuid,uuid,text,text,text,uuid),public.cash_summary(uuid,uuid),public.loan_balance(uuid,uuid),public.today_summary(uuid),public.log_receipt_access(uuid,uuid) from public,anon;
grant execute on function public.disburse_application(uuid,uuid,integer,text,text,date,date,text,text),public.initialise_loan(uuid,uuid,text,text),public.refresh_loan(uuid,uuid),public.preview_payment(uuid,uuid,text),public.record_payment(uuid,uuid,text,text,text,integer,date,uuid),public.reverse_payment(uuid,uuid,text),public.manage_cash(uuid,uuid,text,text,text,uuid),public.cash_summary(uuid,uuid),public.loan_balance(uuid,uuid),public.today_summary(uuid),public.log_receipt_access(uuid,uuid) to authenticated;
