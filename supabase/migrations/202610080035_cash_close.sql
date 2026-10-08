-- Disambiguate the locally computed expected balance from the stored column.
do $$declare body text;begin
 body:=pg_get_functiondef('public.manage_cash(uuid,uuid,text,text,text,uuid)'::regprocedure);
 body:=replace(body,'expected bigint;','expected_cash bigint;');
 body:=replace(body,'expected:=financial_private.cash_expected(sid);','expected_cash:=financial_private.cash_expected(sid);');
 body:=replace(body,'a>expected then','a>expected_cash then');
 body:=replace(body,'diff:=a-expected;','diff:=a-expected_cash;');
 body:=replace(body,'expected=expected,','expected=expected_cash,');
 execute body;
end;$$;
