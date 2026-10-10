create or replace function communication_private.money(n bigint) returns text language sql immutable set search_path='' as $$select replace(replace(to_char(n::numeric/100,'FM999G999G999G999G999G990D00'),',',' '),'.',',')||' MT'$$;
revoke all on function communication_private.money(bigint) from public,anon,authenticated;
