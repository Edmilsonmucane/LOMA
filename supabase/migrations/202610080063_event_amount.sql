-- Applications transport principal as exact text; convert only inside PostgreSQL.
do $$declare b text;begin b:=pg_get_functiondef('communication_private.schedule()'::regprocedure);b:=replace(b,'communication_private.money(x.principal)','communication_private.money(x.principal::bigint)');execute b;end;$$;
