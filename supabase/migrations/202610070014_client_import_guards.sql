create or replace function public.import_clients(t uuid,rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare x jsonb;results jsonb:='[]';cid uuid;begin
 if not public.has_permission(t,'clients.manage') then raise exception 'Access denied' using errcode='42501';end if;
 if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>1000 then raise exception 'Invalid batch' using errcode='23514';end if;
 for x in select value from jsonb_array_elements(rows) loop
  begin cid:=public.save_client(t,x->'data');results:=results||jsonb_build_array(jsonb_build_object('row',x->'row','id',cid,'error',null));
  exception when unique_violation then results:=results||jsonb_build_array(jsonb_build_object('row',x->'row','error','duplicate'));
  when insufficient_privilege then results:=results||jsonb_build_array(jsonb_build_object('row',x->'row','error','denied'));
  when check_violation or invalid_text_representation or datetime_field_overflow or foreign_key_violation or numeric_value_out_of_range or not_null_violation then results:=results||jsonb_build_array(jsonb_build_object('row',x->'row','error','invalid'));
  end;
 end loop;return results;
end;$$;
