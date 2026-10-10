create or replace function public.log_receipt_access(t uuid,p uuid) returns void language plpgsql security definer set search_path='' as $$declare b uuid;begin
 if not public.has_permission(t,'loans.read') and not public.has_permission(t,'payments.manage') then raise exception 'Access denied' using errcode='42501';end if;
 select branch_id into b from public.payments where tenant_id=t and id=p;
 if b is null or not public.branch_allowed(t,b) then raise exception 'Access denied' using errcode='42501';end if;
 insert into public.audit_events(tenant_id,branch_id,actor_id,action,entity,entity_id,current) values(t,b,auth.uid(),'access','payments',p::text,jsonb_build_object('receipt',true));
end;$$;
