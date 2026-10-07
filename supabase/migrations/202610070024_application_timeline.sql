-- Extend the existing customer timeline rather than losing the credit journey in another module.
alter table public.client_events drop constraint client_events_kind_check;
alter table public.client_events add constraint client_events_kind_check check(kind in ('created','updated','consent','note','document','application'));
create function public.application_customer_timeline() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.client_events(tenant_id,client_id,actor_id,kind,detail) select new.tenant_id,a.client_id,new.actor_id,'application',jsonb_build_object('application_id',a.id,'status',new.status) from public.applications a where a.id=new.application_id and a.tenant_id=new.tenant_id;
 return new;end;$$;
revoke all on function public.application_customer_timeline() from public,anon,authenticated;
create trigger customer_timeline after insert on public.application_events for each row execute function public.application_customer_timeline();
