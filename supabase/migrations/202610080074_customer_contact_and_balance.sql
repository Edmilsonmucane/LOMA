-- Email ordering does not change which phone is principal; secondary phones never establish ownership.
do $$declare body text;begin
 body:=pg_get_functiondef('public.customer_enter(uuid)'::regprocedure);
 body:=replace(body,'profile->''contacts''->0->>''kind''=''phone'' and profile->''contacts''->0->>''value''=ph','(select contact.value->>''value'' from jsonb_array_elements(profile->''contacts'') with ordinality contact(value,position) where contact.value->>''kind''=''phone'' order by contact.position limit 1)=ph');execute body;
 body:=pg_get_functiondef('public.customer_dashboard(uuid)'::regprocedure);
 body:=replace(body,'declare c uuid;begin','declare c uuid;r record;begin');
 body:=replace(body,'c:=public.customer_enter(t);',$new$c:=public.customer_enter(t);
 if c is not null then
 perform 1 from public.tenants where id=t for update;
 for r in select l.id from public.loans l join public.contracts co on co.id=l.contract_id and co.tenant_id=t join public.applications a on a.id=co.application_id and a.tenant_id=t join public.loan_accounts ac on ac.loan_id=l.id and ac.tenant_id=t where l.tenant_id=t and a.client_id=c order by l.id loop
 perform financial_private.accrue(t,r.id,(now() at time zone 'Africa/Maputo')::date);
 end loop;end if;
 $new$);execute body;
end;$$;
