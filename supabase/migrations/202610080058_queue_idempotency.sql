do $$declare b text;begin
 b:=pg_get_functiondef('public.queue_message(uuid,uuid,text,text,uuid,uuid)'::regprocedure);
 b:=replace(b,' if loan is not null then',$new$ if exists(select 1 from public.message_jobs where tenant_id=t and source_key='manual:'||request_id::text) then
 if not exists(select 1 from public.message_jobs where tenant_id=t and source_key='manual:'||request_id::text and client_id=c and channel=ch and template_key=template and (loan is null or variables->>'numero'=left(loan::text,8))) then raise exception 'Conflicting request' using errcode='PT409';end if;
 return (select id from public.message_jobs where tenant_id=t and source_key='manual:'||request_id::text);
 end if;
 if loan is not null then$new$);execute b;
end;$$;
