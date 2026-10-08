create function communication_private.valid_configuration(category text,v jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare k text;last int:=0;x jsonb;begin
 if jsonb_typeof(v) is distinct from 'object' then return false;end if;
 if category='communication' then
 foreach k in array array['startHour','endHour','maxPerDay','maxAttempts','retrySeconds'] loop if jsonb_typeof(v->k) is distinct from 'number' or v->>k !~ '^\d+$' then return false;end if;end loop;
 foreach k in array array['timezone','optOutText'] loop if jsonb_typeof(v->k) is distinct from 'string' then return false;end if;end loop;
 if jsonb_typeof(v->'buckets') is distinct from 'array' then return false;end if;
 for x in select value from jsonb_array_elements(v->'buckets') loop if jsonb_typeof(x) is distinct from 'number' or x::text !~ '^\d+$' or x::text::int<=last then return false;end if;last:=x::text::int;end loop;
 elsif category='message_template' then
 foreach k in array array['name','body','channel','whatsappName','whatsappLanguage'] loop if jsonb_typeof(v->k) is distinct from 'string' then return false;end if;end loop;
 if jsonb_typeof(v->'active') is distinct from 'boolean' then return false;end if;
 if v ? 'whatsappVariables' then if jsonb_typeof(v->'whatsappVariables') is distinct from 'array' or jsonb_array_length(v->'whatsappVariables')>10 then return false;end if;for x in select value from jsonb_array_elements(v->'whatsappVariables') loop if x#>>'{}' not in ('nome','valor','data','numero','microcredito') then return false;end if;end loop;end if;
 elsif category='automation' then
 if jsonb_typeof(v->'enabled') is distinct from 'boolean' or jsonb_typeof(v->'offsetDays') is distinct from 'number' or v->>'offsetDays' !~ '^-?\d+$' then return false;end if;
 foreach k in array array['event','template','channel'] loop if jsonb_typeof(v->k) is distinct from 'string' then return false;end if;end loop;
 else return false;end if;return true;
exception when others then return false;end;$$;
do $$declare b text;begin
 b:=pg_get_functiondef('public.save_communication_configuration(uuid,text,text,jsonb)'::regprocedure);b:=replace(b,'if settings is null','if not communication_private.valid_configuration(category_name,settings) then raise exception ''Invalid configuration'' using errcode=''23514'';end if;'||chr(10)||' if settings is null');execute b;
 b:=pg_get_functiondef('public.save_integration(uuid,text,jsonb)'::regprocedure);b:=replace(b,'if ch not in',$new$if jsonb_typeof(settings) is distinct from 'object' or jsonb_typeof(settings->'provider') is distinct from 'string' or jsonb_typeof(settings->'cost') is distinct from 'string' then raise exception 'Invalid integration' using errcode='23514';end if;
 if ch not in$new$);execute b;
end;$$;
revoke all on all functions in schema communication_private from public,anon,authenticated;
