-- Harden the JSON boundary against direct RPC requests, including JSON nulls.
create function public.product_shape(c jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare x jsonb;begin
 if jsonb_typeof(c->'penalty'->'toleranceDays') is distinct from 'number' then return false;end if;
 if jsonb_typeof(c->'requirements'->'minAge') not in ('number','null') or jsonb_typeof(c->'requirements'->'minIncome') not in ('string','null') then return false;end if;
 if c->'requirements'->>'minAge' is not null and c->'requirements'->>'minAge' !~ '^[0-9]+$' then return false;end if;
 for x in select value from jsonb_array_elements(c->'taxes') loop
 if jsonb_typeof(x->'from') is distinct from 'string' or jsonb_typeof(x->'until') not in ('string','null') or jsonb_typeof(x->'basis') is distinct from 'string' then return false;end if;end loop;
 for x in select value from jsonb_array_elements(c->'calendar'->'holidays') loop if jsonb_typeof(x) is distinct from 'string' then return false;end if;end loop;
 for x in select value from jsonb_array_elements(c->'calendar'->'weekendDays') loop if jsonb_typeof(x) is distinct from 'number' or x#>>'{}' !~ '^[0-6]$' then return false;end if;end loop;
 return true;
exception when others then return false;
end;$$;
alter table public.product_versions add constraint complete_conditions check(public.product_shape(terms));
revoke all on function public.product_shape(jsonb) from public,anon;
grant execute on function public.product_shape(jsonb) to authenticated;
create function public.product_roles() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb;begin
 for r in select value from jsonb_array_elements(new.terms->'approvalLevels') loop
 if not exists(select 1 from public.tenant_roles where tenant_id=new.tenant_id and key=r->>'role') then raise exception 'Unknown approval role' using errcode='23514';end if;
 end loop;return new;
end;$$;
revoke all on function public.product_roles() from public,anon,authenticated;
create trigger require_approval_roles before insert on public.product_versions for each row execute function public.product_roles();
