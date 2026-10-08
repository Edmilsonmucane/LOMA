-- Minimal filter labels use reports.read, independent of staff-management/client-edit permissions.
create function public.report_filter_options(t uuid,q text default '',selected uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.has_permission(t,'reports.read') then raise exception 'Access denied' using errcode='42501';end if;
 if q is null or length(q)>100 then raise exception 'Invalid search' using errcode='23514';end if;
 return jsonb_build_object(
 'branches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name) order by b.name) from public.branches b where b.tenant_id=t and public.branch_allowed(t,b.id)),'[]'),
 'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name) from public.products p where p.tenant_id=t),'[]'),
 'agents',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',m.display_name) order by m.display_name) from public.memberships m where m.tenant_id=t and m.active and (m.branch_id is null or public.branch_allowed(t,m.branch_id))),'[]'),
 'clients',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name) from (select id,name from public.clients where tenant_id=t and public.branch_allowed(t,branch_id) and (id=selected or name ilike '%'||replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_')||'%') order by name,id limit 1000) c),'[]'));
end;$$;
revoke all on function public.report_filter_options(uuid,text,uuid) from public,anon;
grant execute on function public.report_filter_options(uuid,text,uuid) to authenticated;
