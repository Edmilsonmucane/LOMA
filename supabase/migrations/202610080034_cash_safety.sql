-- Prevent physical cash outflows exceeding the agency's available cash.
do $$declare body text;begin
 body:=pg_get_functiondef('public.disburse_application(uuid,uuid,integer,text,text,date,date,text,text)'::regprocedure);
 body:=replace(body,$old$if payment_method='cash' then sid:=financial_private.cash_session(t,c.branch_id);end if;$old$,$new$if payment_method='cash' then sid:=financial_private.cash_session(t,c.branch_id); if financial_private.cash_expected(sid)<(p->>'disbursed')::bigint then raise exception 'Insufficient cash' using errcode='PT413';end if;end if;$new$);
 execute body;
 body:=pg_get_functiondef('public.reverse_payment(uuid,uuid,text)'::regprocedure);
 body:=replace(body,$old$if p.method='cash' then sid:=financial_private.cash_session(t,p.branch_id);end if;$old$,$new$if p.method='cash' then sid:=financial_private.cash_session(t,p.branch_id);if financial_private.cash_expected(sid)<p.amount then raise exception 'Insufficient cash' using errcode='PT413';end if;end if;$new$);
 execute body;
 body:=pg_get_functiondef('public.manage_cash(uuid,uuid,text,text,text,uuid)'::regprocedure);
 body:=replace(body,$old$raise exception 'Insufficient cash' using errcode='PT412'$old$,$new$raise exception 'Insufficient cash' using errcode='PT413'$new$);
 execute body;
end;$$;
