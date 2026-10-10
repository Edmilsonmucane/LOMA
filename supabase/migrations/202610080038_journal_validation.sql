-- CHECK constraints must reject absent fields rather than passing SQL NULL.
create or replace function financial_private.balanced(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p)='array' and jsonb_array_length(p)>=2
 and coalesce(sum((x->>'debit')::numeric-(x->>'credit')::numeric),1)=0
 and bool_and(coalesce(jsonb_typeof(x->'debit')='string' and jsonb_typeof(x->'credit')='string' and jsonb_typeof(x->'account')='string' and (x->>'debit') ~ '^[0-9]+$' and (x->>'credit') ~ '^[0-9]+$' and ((x->>'debit')::numeric=0 or (x->>'credit')::numeric=0) and length(x->>'account')>0,false)),false)
 from jsonb_array_elements(p) x;
$$;
