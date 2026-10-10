-- Financial variables need an explicit credit/event; never send a placeholder amount.
do $$declare b text;f text;begin
 foreach f in array array['public.queue_message(uuid,uuid,text,text,uuid,uuid)','public.preview_message(uuid,uuid,text,text,uuid)'] loop
 b:=pg_get_functiondef(f::regprocedure);b:=replace(b,' if loan is not null then',$new$ if loan is null and exists(select 1 from public.tenant_configuration where tenant_id=t and category='message_template' and key=template and value->>'body' ~ '\{(valor|numero)\}') then raise exception 'Template requires a credit' using errcode='PT422';end if;
 if loan is not null then$new$);execute b;
 end loop;
 b:=pg_get_functiondef('public.preview_campaign(uuid,uuid,text,text,jsonb)'::regprocedure);b:=replace(b,'select count(*) into n',$new$if tpl->>'body' ~ '\{(valor|numero)\}' then raise exception 'Template requires a credit' using errcode='PT422';end if;
 select count(*) into n$new$);execute b;
end;$$;
