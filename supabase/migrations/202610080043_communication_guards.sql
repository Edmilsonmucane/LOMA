-- Avoid collisions between PL/pgSQL variables and configuration column names.
do $$declare b text;begin
 b:=pg_get_functiondef('public.save_integration(uuid,text,jsonb)'::regprocedure);
 b:=replace(b,'declare key text','declare encryption_key text');b:=replace(b,'into key from','into encryption_key from');b:=replace(b,'settings::text,key,','settings::text,encryption_key,');execute b;
end;$$;
