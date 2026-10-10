alter table public.clients add column income bigint generated always as ((profile->>'income')::bigint) stored;
alter table public.clients add column expenses bigint generated always as ((profile->>'expenses')::bigint) stored;
alter table public.clients add constraint nonnegative_client_money check(income>=0 and expenses>=0);
create function public.guard_client() returns trigger language plpgsql set search_path='' as $$begin
 if new.birth_date>current_date then raise exception 'Invalid birth date' using errcode='23514';end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.tenant_id<>old.tenant_id) then raise exception 'Identity immutable' using errcode='42501';end if;
 return new;end;$$;
create trigger clients_guard before insert or update on public.clients for each row execute function public.guard_client();
revoke all on function public.guard_client() from public,anon,authenticated;
