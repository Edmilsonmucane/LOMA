do $$declare body text;begin
 body:=pg_get_functiondef('public.customer_save_draft(uuid,uuid,jsonb,integer)'::regprocedure);
 body:=replace(body,'jsonb_array_elements(p->''identities'') x join public.client_keys ck on ck.tenant_id=t and ck.kind=x->>''kind'' and ck.value=upper(regexp_replace(x->>''value'',''[^A-Za-z0-9]'','''',''g''))','jsonb_array_elements(p->''identities'') ident(value) join public.client_keys ck on ck.tenant_id=t and ck.kind=ident.value->>''kind'' and ck.value=upper(regexp_replace(ident.value->>''value'',''[^A-Za-z0-9]'','''',''g''))');
 body:=replace(body,'b:=(input->>''branch_id'')::uuid;', $new$
 if d.id is null then perform portal_private.rate(t,'draft',auth.uid()::text,(select (value->'limits'->>'requestsPerDay')::int*2 from public.tenant_configuration where tenant_id=t and category='website' and key='main'),86400);end if;
 b:=(input->>'branch_id')::uuid;
 $new$);execute body;
end;$$;
