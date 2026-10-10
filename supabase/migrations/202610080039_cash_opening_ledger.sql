-- Carry physical cash into the ledger without counting yesterday's balance twice.
do $$declare body text;begin
 body:=pg_get_functiondef('public.manage_cash(uuid,uuid,text,text,text,uuid)'::regprocedure);
 body:=replace(body,'diff bigint;','diff bigint;ledger_cash bigint;');
 body:=replace(body,'returning cash_sessions.id into sid;return sid;', $open$returning cash_sessions.id into sid;
 select coalesce(sum((x->>'debit')::numeric-(x->>'credit')::numeric),0)::bigint into ledger_cash from public.journal_transactions j cross join lateral jsonb_array_elements(j.postings) x where j.tenant_id=t and j.branch_id=b and x->>'account'='funds_cash';
 diff:=a-ledger_cash;
 insert into public.journal_transactions(tenant_id,branch_id,cash_session_id,source,source_key,postings) values(t,b,sid,'cash_opening',sid::text,jsonb_build_array(financial_private.posting('funds_cash',greatest(diff,0),greatest(-diff,0)),financial_private.posting('cash_opening_balance',greatest(-diff,0),greatest(diff,0))));
 return sid;$open$);
 execute body;
 body:=pg_get_functiondef('financial_private.cash_expected(uuid)'::regprocedure);
 body:=replace(body,'j.source<>''cash_difference''','j.source not in (''cash_difference'',''cash_opening'')');
 execute body;
end;$$;
-- One-time reconciliation for cash sessions opened before this release's ledger entry.
-- Record a compensating entry; historical journal rows remain immutable.
insert into public.journal_transactions(tenant_id,branch_id,cash_session_id,source,source_key,postings)
select cs.tenant_id,cs.branch_id,cs.id,'cash_opening',cs.id::text,
 jsonb_build_array(financial_private.posting('funds_cash',greatest(cs.opening,0),0),financial_private.posting('cash_opening_balance',0,greatest(cs.opening,0)))
from public.cash_sessions cs where not exists(select 1 from public.journal_transactions j where j.tenant_id=cs.tenant_id and j.source='cash_opening' and j.source_key=cs.id::text);
