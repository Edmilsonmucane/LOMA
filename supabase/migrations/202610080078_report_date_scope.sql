do $$declare body text;begin
 body:=pg_get_functiondef('public.operational_report(uuid,text,date,date,uuid,uuid,uuid,uuid,text)'::regprocedure);
 body:=replace(body,'tomovement_day','to_day');execute body;
end;$$;
