alter table public.client_events add column actor_name text;
create function public.client_event_actor() returns trigger language plpgsql security definer set search_path='' as $$begin
 select display_name into new.actor_name from public.memberships where tenant_id=new.tenant_id and user_id=new.actor_id;return new;
end;$$;
create trigger client_event_actor before insert on public.client_events for each row execute function public.client_event_actor();
revoke all on function public.client_event_actor() from public,anon,authenticated;
