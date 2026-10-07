-- Disbursement authority is distinct from recording payments: collectors do not disburse by default.
update public.tenant_roles set permissions=array_append(permissions,'loans.disburse') where key in ('manager','cashier') and not 'loans.disburse'=any(permissions);
update public.presets set configuration=jsonb_set(configuration,'{roles}',(select jsonb_agg(case when r->>'key' in ('manager','cashier') and not (r->'permissions') ? 'loans.disburse' then jsonb_set(r,'{permissions}',(r->'permissions')||'"loans.disburse"'::jsonb) else r end) from jsonb_array_elements(configuration->'roles') r));
create or replace function public.disburse_application(t uuid,a_id uuid,expected_revision integer,payment_method text,payment_reference text,disbursement_date date,signature_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.applications;c public.contracts;lid uuid;begin
 if not public.has_permission(t,'loans.disburse') then raise exception 'Access denied' using errcode='42501';end if;
 select * into a from public.applications where id=a_id and tenant_id=t for update;
 if a.id is null or not public.branch_allowed(t,a.branch_id) then raise exception 'Access denied' using errcode='42501';end if;
 if a.revision<>expected_revision then raise exception 'Application changed' using errcode='PT409';end if;
 if a.status<>'approved' then raise exception 'Approval required' using errcode='23514';end if;
 select * into strict c from public.contracts where tenant_id=t and application_id=a.id;
 if disbursement_date is null or signature_date is null or disbursement_date<>(c.snapshot->>'startDate')::date or signature_date>disbursement_date or signature_date<(c.approved_at at time zone 'Africa/Maputo')::date or disbursement_date>(now() at time zone 'Africa/Maputo')::date then raise exception 'Contract date mismatch' using errcode='23514';end if;
 -- Serialize the limit check for concurrent disbursements.
 perform 1 from public.tenants where id=t for update;
 if (select count(*) from public.loans where tenant_id=t and status in ('active','overdue'))>=(select (p.limits->>'active_loans')::integer from public.plans p join public.tenants x on x.plan_id=p.id where x.id=t) then raise exception 'Loan limit reached' using errcode='23514';end if;
 insert into public.loans(tenant_id,contract_id,branch_id,disbursed_on,method,reference,signed_on,recorded_by) values(t,c.id,a.branch_id,disbursement_date,payment_method,trim(payment_reference),signature_date,auth.uid()) returning id into lid;
 update public.applications set status='disbursed',revision=revision+1,updated_at=now() where id=a.id;
 insert into public.application_events(tenant_id,application_id,branch_id,actor_id,actor_name,status,detail) values(t,a.id,a.branch_id,auth.uid(),coalesce((select display_name from public.memberships where tenant_id=t and user_id=auth.uid()),'Administração'),'disbursed',payment_reference);
 return lid;
end;$$;
