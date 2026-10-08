-- Transactional profile/payment/config writes already refresh metrics. Ageing only needs one refresh per Maputo day.
create or replace function scoring_private.refresh_tenant(t uuid) returns void language plpgsql security definer set search_path='' as $$declare c record;begin
 perform 1 from public.tenants where id=t and active for update;if not found then return;end if;
 for c in select id from public.clients cl where cl.tenant_id=t and not exists(select 1 from public.client_risk_assessments a where a.tenant_id=t and a.client_id=cl.id and a.assessed_at>=((now() at time zone 'Africa/Maputo')::date::timestamp at time zone 'Africa/Maputo')) order by id loop perform scoring_private.refresh(t,c.id);end loop;
end;$$;
