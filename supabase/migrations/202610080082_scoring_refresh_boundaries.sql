-- Refresh after the complete signed plan, rather than once per instalment.
do $$declare body text;begin
 body:=pg_get_functiondef('financial_private.initialise(uuid,uuid,jsonb,uuid)'::regprocedure);
 body:=replace(body,E'\nend;',E'\n perform scoring_private.refresh(t,(select a.client_id from public.loans l join public.contracts c on c.id=l.contract_id and c.tenant_id=t join public.applications a on a.id=c.application_id and a.tenant_id=t where l.id=ln.id and l.tenant_id=t));\nend;');execute body;
 body:=pg_get_functiondef('public.save_scoring_evidence(uuid,uuid,jsonb)'::regprocedure);
 body:=replace(body,'if not input ?&', 'if jsonb_typeof(input) is distinct from ''object'' or jsonb_typeof(input->''employmentMonths'') not in (''number'',''null'') or jsonb_typeof(input->''verifiedReferences'') not in (''number'',''null'') or not input ?&');execute body;
end;$$;
create function scoring_private.refresh_tenant(t uuid) returns void language plpgsql security definer set search_path='' as $$declare c record;begin
 perform 1 from public.tenants where id=t and active for update;if not found then return;end if;
 for c in select id from public.clients where tenant_id=t order by id loop perform scoring_private.refresh(t,c.id);end loop;
end;$$;
-- Recompute ageing metrics before campaign segmentation, without granting private helpers.
do $$declare body text;begin
 body:=pg_get_functiondef('public.preview_campaign(uuid,uuid,text,text,jsonb)'::regprocedure);
 body:=replace(body,'select value into tpl', 'perform scoring_private.refresh_tenant(t);select value into tpl');execute body;
 body:=pg_get_functiondef('communication_private.schedule()'::regprocedure);
 body:=replace(body,'for c in select * from public.campaigns', 'for c in select id from public.tenants where active order by id loop perform scoring_private.refresh_tenant(c.id);end loop;for c in select * from public.campaigns');execute body;
end;$$;
revoke all on function scoring_private.refresh_tenant(uuid) from public,anon,authenticated;
