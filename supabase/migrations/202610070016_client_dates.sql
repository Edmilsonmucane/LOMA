create or replace function public.guard_client() returns trigger language plpgsql set search_path='' as $$begin
 if new.birth_date>(now() at time zone 'Africa/Maputo')::date then raise exception 'Invalid birth date' using errcode='23514';end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.tenant_id<>old.tenant_id) then raise exception 'Identity immutable' using errcode='42501';end if;
 return new;end;$$;
