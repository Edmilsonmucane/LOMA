do $$declare body text;begin
 body:=pg_get_functiondef('public.operational_report(uuid,text,date,date,uuid,uuid,uuid,uuid,text)'::regprocedure);
 body:=replace(body,'from_movement_day','from_day');body:=replace(body,'to_movement_day','to_day');body:=replace(body,'''asOf'',to_day::text','''asOf'',today::text');
 body:=replace(body,'where l.tenant_id=t and public.branch_allowed(t,l.branch_id) and (b is null or l.branch_id=b)','where kind<>''cash'' and l.tenant_id=t and public.branch_allowed(t,l.branch_id) and (b is null or l.branch_id=b)');
 execute body;
end;$$;
