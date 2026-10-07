create extension if not exists unaccent with schema extensions;
create function public.client_search_text(value text) returns text language sql immutable parallel safe set search_path='' as $$select lower(extensions.unaccent('extensions.unaccent'::regdictionary,value))$$;
create index clients_folded_name on public.clients using gin(public.client_search_text(name) extensions.gin_trgm_ops);
create index client_keys_search on public.client_keys using gin(lower(value) extensions.gin_trgm_ops);
create or replace function public.search_clients(t uuid,query text default '',selected_class text default '',selected_branch uuid default null,page_offset integer default 0,page_size integer default 50) returns setof public.clients language plpgsql stable security definer set search_path='' as $$
declare scoped_branch uuid;term text:=public.client_search_text(query);key_term text:=lower(regexp_replace(query,'[^A-Za-z0-9+]','','g'));begin
 if not public.has_permission(t,'clients.read') then raise exception 'Access denied' using errcode='42501';end if;
 if not public.is_platform_admin() then select branch_id into scoped_branch from public.memberships where tenant_id=t and user_id=auth.uid() and active;end if;
 return query select c.* from public.clients c where c.tenant_id=t and (scoped_branch is null or c.branch_id=scoped_branch) and (selected_class='' or c.classification=selected_class) and (selected_branch is null or c.branch_id=selected_branch)
 and (term='' or strpos(public.client_search_text(c.name),term)>0 or (key_term<>'' and exists(select 1 from public.client_keys k where k.client_id=c.id and k.tenant_id=t and strpos(lower(k.value),key_term)>0)))
 order by c.name,c.id limit greatest(1,least(page_size,100)) offset greatest(0,page_offset);
end;$$;
revoke all on function public.client_search_text(text) from public,anon;
grant execute on function public.client_search_text(text) to authenticated;
