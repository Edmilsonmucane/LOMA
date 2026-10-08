-- Keep the accrual loop record distinct from the payment reversal SQL alias.
do $$declare body text;begin
 body:=pg_get_functiondef('public.customer_dashboard(uuid)'::regprocedure);
 if position('declare c uuid;r record;begin' in body)=0 then
  raise exception 'Unexpected customer dashboard definition';
 end if;
 body:=replace(body,'declare c uuid;r record;begin','declare c uuid;owned_loan record;begin');
 body:=replace(body,'for r in select l.id','for owned_loan in select l.id');
 body:=replace(body,'financial_private.accrue(t,r.id,','financial_private.accrue(t,owned_loan.id,');
 execute body;
end;$$;
