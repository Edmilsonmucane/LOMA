-- Attention rows expose only the selected contact, not the full private client profile.
do $$declare body text;begin
 body:=pg_get_functiondef('public.today_summary(uuid)'::regprocedure);
 body:=replace(body,'as name,min(i.due_date)', $new$as name,(select x->>'value' from jsonb_array_elements(coalesce(c.snapshot->'client'->'profile'->'contacts','[]')) x where x->>'kind'='phone' limit 1) as phone,min(i.due_date)$new$);
 execute body;
end;$$;
