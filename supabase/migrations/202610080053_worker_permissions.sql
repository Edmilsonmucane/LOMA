do $$declare b text;f text;begin
 foreach f in array array['communication_private.prepare(uuid)','communication_private.schedule()'] loop
 b:=pg_get_functiondef(f::regprocedure);b:=replace(b,$old$r.permissions ? 'messages.manage'$old$,$new$'messages.manage'=any(r.permissions)$new$);b:=replace(b,$old$r.permissions ? 'collections.manage'$old$,$new$'collections.manage'=any(r.permissions)$new$);execute b;
 end loop;
end;$$;
