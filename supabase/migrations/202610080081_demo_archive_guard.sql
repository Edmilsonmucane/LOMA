-- Permit only the exact archive transition inside the signed demo RPC.
do $$declare body text;begin
 body:=pg_get_functiondef('public.guard_business_record()'::regprocedure);
 body:=replace(body,'if tg_op=''UPDATE'' and not public.is_platform_admin() and auth.uid() is not null and (new.plan_id<>old.plan_id or new.slug<>old.slug or new.active<>old.active) then',
 'if tg_op=''UPDATE'' and not public.is_platform_admin() and auth.uid() is not null and (new.plan_id<>old.plan_id or new.slug<>old.slug or new.active<>old.active) and not (current_setting(''loma.demo_config'',true)=''on'' and old.is_demo and old.active and not new.active and new.slug=''archive-''||replace(old.id::text,''-'','''') and new.plan_id=old.plan_id) then');execute body;
end;$$;
