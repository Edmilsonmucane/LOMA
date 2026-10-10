do $$declare b text;begin b:=pg_get_functiondef('public.queue_message(uuid,uuid,text,text,uuid,uuid)'::regprocedure);b:=replace(b,'left(l.id::text,8)','left(loan::text,8)');execute b;end;$$;
