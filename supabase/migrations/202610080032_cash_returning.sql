-- Qualify RETURNING so PL/pgSQL does not confuse the deposit identifier with the column.
do $$begin
 execute replace(pg_get_functiondef('public.manage_cash(uuid,uuid,text,text,text,uuid)'::regprocedure),'returning id into sid','returning cash_sessions.id into sid');
end;$$;
