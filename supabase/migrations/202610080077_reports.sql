-- The provision basis is editable; no statutory thresholds or percentages are inferred.
do $$declare body text;begin
 perform set_config('loma.scoring_config','on',true);
 update public.tenant_configuration set value=value||'{"provisionBasis":"principal"}'::jsonb where category='scoring' and key='main';
 body:=pg_get_functiondef('scoring_private.defaults()'::regprocedure);
 body:=replace(body,'$cfg$::jsonb','$cfg$::jsonb||''{"provisionBasis":"principal"}''::jsonb');execute body;
 body:=pg_get_functiondef('scoring_private.valid(jsonb)'::regprocedure);
 body:=replace(body,'if weight=0 then','if not v ? ''provisionBasis'' or v->>''provisionBasis'' not in (''principal'',''balance'') then return false;end if; if weight=0 then');execute body;
end;$$;
create schema reporting_private;
revoke all on schema reporting_private from public,anon,authenticated;
create function public.operational_report(t uuid,kind text,from_day date,to_day date,b uuid default null,product uuid default null,agent uuid default null,cid uuid default null,export_format text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'Africa/Maputo')::date;r record;rows jsonb;total numeric:=0;count_rows int;cfg jsonb;begin
 if not public.has_permission(t,'reports.read') then raise exception 'Access denied' using errcode='42501';end if;
 if kind not in ('arrears','movements','forecast','portfolio','statement','cash') or from_day is null or to_day is null or from_day>to_day or to_day-from_day>3660 or (export_format is not null and export_format not in ('csv','pdf')) then raise exception 'Invalid report' using errcode='23514';end if;
 if b is not null and (not public.branch_allowed(t,b) or not exists(select 1 from public.branches where tenant_id=t and id=b)) then raise exception 'Access denied' using errcode='42501';end if;
 if product is not null and not exists(select 1 from public.products where tenant_id=t and id=product) then raise exception 'Access denied' using errcode='42501';end if;
 if agent is not null and not exists(select 1 from public.memberships where tenant_id=t and user_id=agent and active and (branch_id is null or public.branch_allowed(t,branch_id))) then raise exception 'Access denied' using errcode='42501';end if;
 if cid is not null and not exists(select 1 from public.clients where tenant_id=t and id=cid and public.branch_allowed(t,branch_id)) then raise exception 'Access denied' using errcode='42501';end if;
 if kind='statement' and cid is null then raise exception 'Client required' using errcode='23514';end if;
 if kind='cash' and (product is not null or agent is not null or cid is not null) then raise exception 'Invalid cash filters' using errcode='23514';end if;
 perform 1 from public.tenants where id=t for update;
 for r in select l.id from public.loans l join public.contracts co on co.id=l.contract_id and co.tenant_id=t join public.applications a on a.id=co.application_id and a.tenant_id=t join public.product_versions pv on pv.id=a.product_version_id and pv.tenant_id=t left join public.collection_assignments ca on ca.loan_id=l.id and ca.tenant_id=t where l.tenant_id=t and public.branch_allowed(t,l.branch_id) and (b is null or l.branch_id=b) and (product is null or pv.product_id=product) and (agent is null or ca.user_id=agent) and (cid is null or a.client_id=cid) order by l.id loop perform financial_private.accrue(t,r.id,today);end loop;
 select value into strict cfg from public.tenant_configuration where tenant_id=t and category='scoring' and key='main';
 -- Temporary relations are never created: one scoped CTE feeds each exact report.
 with scoped as (
 select l.id,l.branch_id,l.disbursed_on,l.status,l.contract_id,a.client_id,a.principal,pv.product_id,pv.name product_name,br.name branch_name,c.name client_name,ca.user_id agent_id,coalesce(m.display_name,'') agent_name
 from public.loans l join public.contracts co on co.id=l.contract_id and co.tenant_id=t join public.applications a on a.id=co.application_id and a.tenant_id=t join public.product_versions pv on pv.id=a.product_version_id and pv.tenant_id=t join public.clients c on c.id=a.client_id and c.tenant_id=t join public.branches br on br.id=l.branch_id and br.tenant_id=t left join public.collection_assignments ca on ca.loan_id=l.id and ca.tenant_id=t left join public.memberships m on m.user_id=ca.user_id and m.tenant_id=t
 where l.tenant_id=t and public.branch_allowed(t,l.branch_id) and (b is null or l.branch_id=b) and (product is null or pv.product_id=product) and (agent is null or ca.user_id=agent) and (cid is null or a.client_id=cid)
 ), balances as (
 select s.*,coalesce(sum(i.principal),0) principal_balance,coalesce(sum(i.principal+i.interest+i.fine+i.late_interest),0) balance,greatest(0,today-min(i.due_date) filter(where i.principal+i.interest+i.fine+i.late_interest>0)) days from scoped s left join public.loan_instalments i on i.loan_id=s.id and i.tenant_id=t group by s.id,s.branch_id,s.disbursed_on,s.status,s.contract_id,s.client_id,s.principal,s.product_id,s.product_name,s.branch_name,s.client_name,s.agent_id,s.agent_name
 ), provisioned as (
 select bl.*,bucket.value bucket,round((case when cfg->>'provisionBasis'='balance' then bl.balance else bl.principal_balance end)*(bucket.value->>'percentage')::numeric/100) provision from balances bl cross join lateral (select value from jsonb_array_elements(cfg->'provisions') where (value->>'fromDays')::int<=bl.days order by (value->>'fromDays')::int desc limit 1) bucket
 ), movement as (
 select s.*,s.disbursed_on as movement_day,'disbursement' source,coalesce((select sum((x->>'credit')::numeric) from public.journal_transactions j cross join lateral jsonb_array_elements(j.postings) x where j.tenant_id=t and j.loan_id=s.id and j.source='disbursement' and x->>'account' like 'funds_%'),s.principal::numeric) amount,s.id::text reference from scoped s
 union all select s.*,p.paid_on,'payment',p.amount::numeric,p.receipt_number::text from scoped s join public.payments p on p.loan_id=s.id and p.tenant_id=t
 union all select s.*,(rv.created_at at time zone 'Africa/Maputo')::date,'reversal',-p.amount::numeric,p.receipt_number::text from scoped s join public.payments p on p.loan_id=s.id and p.tenant_id=t join public.payment_reversals rv on rv.payment_id=p.id and rv.tenant_id=t
 ), output as (
 select jsonb_build_object('bucket',bucket->>'name','count',count(*)::text,'balance',sum(balance)::text,'principal',sum(principal_balance)::text,'provision',sum(provision)::text) row,(bucket->>'fromDays')::int::text ordering,sum(balance) amount from provisioned where kind='arrears' and balance>0 group by bucket
 union all select jsonb_build_object('date',movement_day::text,'source',source,'count',count(*)::text,'amount',sum(amount)::text),movement_day::text||source,sum(amount) from movement where kind='movements' and movement_day between from_day and to_day group by movement_day,source
 union all select jsonb_build_object('date',i.due_date::text,'client',s.client_name,'product',s.product_name,'branch',s.branch_name,'amount',(i.principal+i.interest+i.fine+i.late_interest)::text),i.due_date::text||s.client_name,i.principal+i.interest+i.fine+i.late_interest from scoped s join public.loan_instalments i on i.loan_id=s.id and i.tenant_id=t where kind='forecast' and i.due_date between from_day and to_day and i.principal+i.interest+i.fine+i.late_interest>0
 union all select jsonb_build_object('product',product_name,'branch',branch_name,'agent',agent_name,'count',count(*)::text,'principal',sum(principal_balance)::text,'balance',sum(balance)::text,'provision',sum(provision)::text),product_name||branch_name||agent_name,sum(balance) from provisioned where kind='portfolio' and balance>0 group by product_name,branch_name,agent_name
 union all select jsonb_build_object('date',movement_day::text,'source',source,'product',product_name,'reference',reference,'amount',amount::text),movement_day::text||reference,amount from movement where kind='statement' and movement_day between from_day and to_day
 union all select jsonb_build_object('date',cs.day::text,'branch',br.name,'state',case when cs.closed_at is null then 'open' else 'closed' end,'opening',cs.opening::text,'expected',coalesce(cs.expected,financial_private.cash_expected(cs.id))::text,'counted',coalesce(cs.counted::text,''),'difference',case when cs.counted is null then '' else (cs.counted-cs.expected)::text end,'reason',cs.difference_reason),cs.day::text||br.name,coalesce(cs.expected,financial_private.cash_expected(cs.id))::numeric from public.cash_sessions cs join public.branches br on br.id=cs.branch_id and br.tenant_id=t where kind='cash' and cs.tenant_id=t and public.branch_allowed(t,cs.branch_id) and (b is null or cs.branch_id=b) and cs.day between from_day and to_day
 ), limited as(select * from output order by ordering,row::text limit 5000)
 select coalesce((select jsonb_agg(row order by ordering,row::text) from limited),'[]'),coalesce((select sum(amount) from output),0),(select count(*) from output) into rows,total,count_rows;
 insert into public.audit_events(tenant_id,branch_id,actor_id,action,entity,entity_id,current) values(t,b,auth.uid(),case when export_format is null then 'read' else 'export' end,'operational_report',kind,jsonb_build_object('from',from_day,'to',to_day,'product',product,'agent',agent,'client',cid,'format',export_format,'rows',count_rows));
 return jsonb_build_object('kind',kind,'asOf',tomovement_day::text,'from',from_movement_day::text,'to',to_movement_day::text,'rows',rows,'count',count_rows,'truncated',count_rows>5000,'total',total::text,'provisionBasis',cfg->>'provisionBasis');
end;$$;
revoke all on function public.operational_report(uuid,text,date,date,uuid,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.operational_report(uuid,text,date,date,uuid,uuid,uuid,uuid,text) to authenticated;
