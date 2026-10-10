create function public.log_contract_access(t uuid,c_id uuid) returns void language plpgsql security definer set search_path='' as $$declare c public.contracts;begin
 select * into c from public.contracts where id=c_id and tenant_id=t;
 if c.id is null or not (public.has_permission(t,'applications.read') or public.has_permission(t,'loans.read')) or not public.branch_allowed(t,c.branch_id) then raise exception 'Access denied' using errcode='42501';end if;
 insert into public.audit_events(tenant_id,branch_id,actor_id,action,entity,entity_id) values(t,c.branch_id,auth.uid(),'access','contracts',c.id::text);
end;$$;
revoke all on function public.log_contract_access(uuid,uuid) from public,anon;
grant execute on function public.log_contract_access(uuid,uuid) to authenticated;
