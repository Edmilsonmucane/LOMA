-- Product heads change; their condition versions never change.
create table public.products (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),name text not null check(length(name) between 2 and 100),
 revision integer not null default 0,active_version integer,status text not null default 'draft' check(status in ('draft','active','archived')),
 source_key text,created_at timestamptz not null default now(),unique(id,tenant_id),unique(tenant_id,source_key)
);
create table public.product_versions (
 id uuid primary key default gen_random_uuid(),product_id uuid not null,tenant_id uuid not null,version integer not null check(version>0),name text not null,
 terms jsonb not null,created_by uuid references auth.users(id),created_at timestamptz not null default now(),
 foreign key(product_id,tenant_id) references public.products(id,tenant_id),unique(product_id,version,tenant_id)
);
alter table public.products add foreign key(id,active_version,tenant_id) references public.product_versions(product_id,version,tenant_id) deferrable initially deferred;
create index on public.products(tenant_id);
create index on public.product_versions(tenant_id,product_id);
alter table public.products enable row level security;
alter table public.product_versions enable row level security;
create policy products_read on public.products for select to authenticated using(public.has_permission(tenant_id,'tenant.read'));
create policy product_versions_read on public.product_versions for select to authenticated using(public.has_permission(tenant_id,'tenant.read'));
grant select on public.products,public.product_versions to authenticated;
revoke all on public.products,public.product_versions from anon;
create trigger immutable_product_version before update or delete on public.product_versions for each row execute function public.audit_immutable();
create trigger immutable_product_versions_truncate before truncate on public.product_versions for each statement execute function public.audit_immutable();
create trigger audit_product after insert or update on public.products for each row execute function public.record_audit();
create trigger audit_product_version after insert on public.product_versions for each row execute function public.record_audit();
create function public.valid_product_terms(c jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare x jsonb; last_threshold numeric:=0; k text;
begin
 if jsonb_typeof(c)<>'object' or not c ?& array['method','periodicity','rate','minPrincipal','maxPrincipal','minPeriods','maxPeriods','grace','fees','taxes','penalty','calendar','allocation','excess','settlement','yearDays','requirements','approvalLevels'] then return false;end if;
 for k in select unnest(array['method','periodicity','rate','minPrincipal','maxPrincipal','excess','settlement']) loop if jsonb_typeof(c->k) is distinct from 'string' then return false;end if;end loop;
 for k in select unnest(array['minPeriods','maxPeriods','yearDays']) loop if jsonb_typeof(c->k) is distinct from 'number' or c->>k !~ '^[0-9]+$' then return false;end if;end loop;
 for k in select unnest(array['grace','penalty','calendar','requirements']) loop if jsonb_typeof(c->k) is distinct from 'object' then return false;end if;end loop;
 for k in select unnest(array['fees','taxes','allocation','approvalLevels']) loop if jsonb_typeof(c->k) is distinct from 'array' then return false;end if;end loop;
 if jsonb_typeof(c->'grace'->'periods') is distinct from 'number' or c->'grace'->>'periods' !~ '^[0-9]+$' or jsonb_typeof(c->'grace'->'treatment') is distinct from 'string' then return false;end if;
 if not c->'penalty'->'fine' ?& array['kind','value'] or jsonb_typeof(c->'penalty'->'fine'->'value') is distinct from 'string' or jsonb_typeof(c->'penalty'->'fine'->'kind') is distinct from 'string' or jsonb_typeof(c->'penalty'->'dailyRate') is distinct from 'string' or c->'penalty'->>'toleranceDays' !~ '^[0-9]+$' then return false;end if;
 if jsonb_typeof(c->'calendar'->'holidays') is distinct from 'array' or jsonb_typeof(c->'calendar'->'weekendDays') is distinct from 'array' or jsonb_typeof(c->'calendar'->'adjustment') is distinct from 'string' then return false;end if;
 if jsonb_typeof(c->'requirements'->'documents') is distinct from 'array' or jsonb_typeof(c->'requirements'->'guarantees') is distinct from 'array' then return false;end if;
 if c->>'method' not in ('flat','annuity','sac','interest_only','bullet') or c->>'periodicity' not in ('daily','weekly','fortnightly','monthly') then return false;end if;
 if jsonb_typeof(c->'rate')<>'string' or c->>'rate' !~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then return false;end if;
 if c->>'minPrincipal' !~ '^[0-9]+$' or c->>'maxPrincipal' !~ '^[0-9]+$' or (c->>'minPrincipal')::numeric<1 or (c->>'maxPrincipal')::numeric<(c->>'minPrincipal')::numeric then return false;end if;
 if (c->>'minPeriods')::integer<1 or (c->>'maxPeriods')::integer<(c->>'minPeriods')::integer or (c->>'maxPeriods')::integer>1200 or (c->>'yearDays')::integer not between 1 and 1000 then return false;end if;
 if not c->'grace' ?& array['periods','treatment'] or (c->'grace'->>'periods')::integer not between 0 and 1200 or c->'grace'->>'treatment' not in ('free','interest_only','capitalise') then return false;end if;
 if jsonb_typeof(c->'fees')<>'array' or jsonb_typeof(c->'taxes')<>'array' then return false;end if;
 for x in select value from jsonb_array_elements((c->'fees')||(c->'taxes')) loop
  if jsonb_typeof(x->'key') is distinct from 'string' or jsonb_typeof(x->'kind') is distinct from 'string' or jsonb_typeof(x->'treatment') is distinct from 'string' or not x ?& array['key','kind','value','treatment'] or length(x->>'key')=0 or x->>'kind' not in ('fixed','percentage') or x->>'treatment' not in ('deducted','financed','separate') or jsonb_typeof(x->'value')<>'string' then return false;end if;
  if (x->>'kind'='fixed' and x->>'value' !~ '^[0-9]+$') or (x->>'kind'='percentage' and x->>'value' !~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$') then return false;end if;
 end loop;
 if (select count(*) from jsonb_array_elements((c->'fees')||(c->'taxes')))<>(select count(distinct value->>'key') from jsonb_array_elements((c->'fees')||(c->'taxes'))) then return false;end if;
 for x in select value from jsonb_array_elements(c->'taxes') loop
  if not x ?& array['from','until','basis'] or x->>'basis' not in ('principal','interest','fees') or (x->>'from')::date::text<>x->>'from' then return false;end if;
  if x->>'until' is not null and ((x->>'until')::date<(x->>'from')::date or (x->>'until')::date::text<>x->>'until') then return false;end if;
 end loop;
 if not c->'penalty' ?& array['toleranceDays','dailyRate','fine'] or (c->'penalty'->>'toleranceDays')::integer not between 0 and 36500 or c->'penalty'->>'dailyRate' !~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' or c->'penalty'->'fine'->>'kind' not in ('fixed','percentage') then return false;end if;
 if (c->'penalty'->'fine'->>'kind'='fixed' and c->'penalty'->'fine'->>'value' !~ '^[0-9]+$') or (c->'penalty'->'fine'->>'kind'='percentage' and c->'penalty'->'fine'->>'value' !~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$') then return false;end if;
 if not c->'calendar' ?& array['holidays','weekendDays','adjustment'] or c->'calendar'->>'adjustment' not in ('none','next_business_day') then return false;end if;
 for x in select value from jsonb_array_elements(c->'calendar'->'holidays') loop if (x#>>'{}')::date::text<>x#>>'{}' then return false;end if;end loop;
 for x in select value from jsonb_array_elements(c->'calendar'->'weekendDays') loop if (x#>>'{}')::integer not between 0 and 6 then return false;end if;end loop;
 if (select count(distinct value) from jsonb_array_elements(c->'calendar'->'weekendDays'))=7 then return false;end if;
 if jsonb_array_length(c->'allocation')<>4 or (select count(distinct value) from jsonb_array_elements(c->'allocation'))<>4 then return false;end if;
 for x in select value from jsonb_array_elements(c->'allocation') loop if x#>>'{}' not in ('fine','lateInterest','interest','principal') then return false;end if;end loop;
 if c->>'excess' not in ('advance','credit') or c->>'settlement' not in ('contract_interest','proportional_interest','due_interest') then return false;end if;
 if not c->'requirements' ?& array['documents','guarantees','minAge','minIncome'] then return false;end if;
 if c->'requirements'->>'minAge' is not null and (c->'requirements'->>'minAge')::integer not between 0 and 150 then return false;end if;
 if c->'requirements'->>'minIncome' is not null and c->'requirements'->>'minIncome' !~ '^[0-9]+$' then return false;end if;
 for x in select value from jsonb_array_elements((c->'requirements'->'documents')||(c->'requirements'->'guarantees')) loop if jsonb_typeof(x)<>'string' or length(x#>>'{}')=0 then return false;end if;end loop;
 for x in select value from jsonb_array_elements(c->'approvalLevels') loop
 if jsonb_typeof(x->'upTo') is distinct from 'string' or jsonb_typeof(x->'role') is distinct from 'string' or x->>'upTo' !~ '^[0-9]+$' or (x->>'upTo')::numeric<=last_threshold or length(x->>'role')=0 then return false;end if;last_threshold:=(x->>'upTo')::numeric;end loop;
 return last_threshold>=(c->>'maxPrincipal')::numeric;
exception when others then return false;
end;$$;
alter table public.product_versions add constraint valid_conditions check(public.valid_product_terms(terms));
revoke all on function public.valid_product_terms(jsonb) from public,anon;
grant execute on function public.valid_product_terms(jsonb) to authenticated;
create function public.save_product(t uuid,product_name text,conditions jsonb,expected_revision integer,product_status text,selected_product uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.products; next_version integer;
begin
 if not public.has_permission(t,'tenant.manage') then raise exception 'Access denied' using errcode='42501';end if;
 if product_status not in ('draft','active','archived') or not public.valid_product_terms(conditions) then raise exception 'Invalid conditions' using errcode='23514';end if;
 if selected_product is null then
  if expected_revision<>0 then raise exception 'Stale revision' using errcode='40001';end if;
  insert into public.products(tenant_id,name) values(t,product_name) returning * into p;
 else
  select * into p from public.products where id=selected_product and tenant_id=t for update;
  if not found then raise exception 'Access denied' using errcode='42501';end if;
  if p.revision<>expected_revision then raise exception 'Stale revision' using errcode='40001';end if;
 end if;
 next_version:=p.revision+1;
 insert into public.product_versions(product_id,tenant_id,version,name,terms,created_by) values(p.id,t,next_version,product_name,conditions,auth.uid());
 update public.products set name=product_name,revision=next_version,status=case when product_status='draft' and active_version is not null then status else product_status end,
 active_version=case when product_status='active' then next_version else active_version end where id=p.id;
 return p.id;
end;$$;
revoke all on function public.save_product(uuid,text,jsonb,integer,text,uuid) from public,anon;
grant execute on function public.save_product(uuid,text,jsonb,integer,text,uuid) to authenticated;
