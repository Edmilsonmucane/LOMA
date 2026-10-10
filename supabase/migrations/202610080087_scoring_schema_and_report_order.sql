-- RPC validation matches the shared strict JSON schema, including value types and unknown keys.
alter function scoring_private.valid(jsonb) rename to ranges_valid;
create function scoring_private.valid(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare c jsonb;b jsonb;g jsonb;begin
 if not scoring_private.ranges_valid(v) or not v ?& array['criteria','classes','provisions','provisionBasis'] or exists(select 1 from jsonb_object_keys(v) k where k not in ('criteria','classes','provisions','provisionBasis')) then return false;end if;
 for c in select value from jsonb_array_elements(v->'criteria') loop
 if jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(c->'missingScore') is distinct from 'number' or exists(select 1 from jsonb_object_keys(c) k where k not in ('key','weight','missingScore','bands')) then return false;end if;
 for b in select value from jsonb_array_elements(c->'bands') loop
 if not b ?& array['until','score'] or jsonb_typeof(b->'score') is distinct from 'number' or exists(select 1 from jsonb_object_keys(b) k where k not in ('until','score')) or (b->'until'<>'null'::jsonb and (jsonb_typeof(b->'until') is distinct from 'string' or b->>'until' !~ '^\d+(\.\d{1,12})?$')) then return false;end if;end loop;end loop;
 for g in select value from jsonb_array_elements(v->'classes') loop
 if not g ?& array['key','minScore','suggestedLimit'] or jsonb_typeof(g->'minScore') is distinct from 'number' or jsonb_typeof(g->'suggestedLimit') is distinct from 'string' or g->>'suggestedLimit' !~ '^\d{1,19}$' or exists(select 1 from jsonb_object_keys(g) k where k not in ('key','minScore','suggestedLimit')) then return false;end if;end loop;
 for g in select value from jsonb_array_elements(v->'provisions') loop
 if not g ?& array['name','fromDays','percentage'] or jsonb_typeof(g->'name') is distinct from 'string' or length(trim(g->>'name')) not between 2 and 80 or jsonb_typeof(g->'fromDays') is distinct from 'number' or jsonb_typeof(g->'percentage') is distinct from 'string' or g->>'percentage' !~ '^\d+(\.\d{1,12})?$' or exists(select 1 from jsonb_object_keys(g) k where k not in ('name','fromDays','percentage')) then return false;end if;end loop;
 return true;exception when others then return false;end;$$;
revoke all on function scoring_private.valid(jsonb),scoring_private.ranges_valid(jsonb) from public,anon,authenticated;
do $$declare body text;begin
 body:=pg_get_functiondef('public.operational_report(uuid,text,date,date,uuid,uuid,uuid,uuid,text)'::regprocedure);
 body:=replace(body,'if kind not in', 'if kind is null or kind not in');
 body:=replace(body,'(bucket->>''fromDays'')::int::text ordering', 'lpad((bucket->>''fromDays'')::int::text,10,''0'') ordering');execute body;
end;$$;
