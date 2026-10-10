do $$declare body text;begin
 body:=pg_get_functiondef('public.manage_cash(uuid,uuid,text,text,text,uuid)'::regprocedure);
 body:=replace(body,'id uuid:=gen_random_uuid()','deposit_id uuid:=gen_random_uuid()');
 body:=replace(body,'values(id,t,b,sid','values(deposit_id,t,b,sid');
 body:=replace(body,'''deposit'',id::text','''deposit'',deposit_id::text');
 body:=replace(body,'return id;','return deposit_id;');
 execute body;
end;$$;
