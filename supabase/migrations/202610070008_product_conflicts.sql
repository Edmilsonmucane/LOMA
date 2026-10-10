-- Conflicts are HTTP 409, not PostgreSQL serialization retries.
create or replace function public.save_product(t uuid,product_name text,conditions jsonb,expected_revision integer,product_status text,selected_product uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.products; next_version integer;
begin
 if not public.has_permission(t,'tenant.manage') then raise exception 'Access denied' using errcode='42501';end if;
 if product_status not in ('draft','active','archived') or not public.valid_product_terms(conditions) then raise exception 'Invalid conditions' using errcode='23514';end if;
 if selected_product is null then
  if expected_revision<>0 then raise exception 'Stale revision' using errcode='PT409';end if;
  insert into public.products(tenant_id,name) values(t,product_name) returning * into p;
 else
  select * into p from public.products where id=selected_product and tenant_id=t for update;
  if not found then raise exception 'Access denied' using errcode='42501';end if;
  if p.revision<>expected_revision then raise exception 'Stale revision' using errcode='PT409';end if;
 end if;
 next_version:=p.revision+1;
 insert into public.product_versions(product_id,tenant_id,version,name,terms,created_by) values(p.id,t,next_version,product_name,conditions,auth.uid());
 update public.products set name=product_name,revision=next_version,status=case when product_status='draft' and active_version is not null then status else product_status end,
 active_version=case when product_status='active' then next_version else active_version end where id=p.id;
 return p.id;
end;$$;
