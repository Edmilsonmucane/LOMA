alter table public.plans add constraint valid_plan_limits check(limits ?& array['users','active_loans','messages'] and (limits->>'users')::int>0 and (limits->>'active_loans')::int>0 and (limits->>'messages')::int>=0);
create function public.link_existing_member(t uuid,member_email text,member_name text,selected_role uuid,selected_branch uuid default null) returns boolean language plpgsql security definer set search_path='' as $$
declare existing_user uuid;
begin
 if not public.has_permission(t,'users.manage') or not public.branch_allowed(t,selected_branch) then raise exception 'Access denied' using errcode='42501';end if;
 select id into existing_user from auth.users where lower(email)=lower(member_email);
 if existing_user is null then return false;end if;
 insert into public.memberships(tenant_id,user_id,role_id,branch_id,display_name,email) values(t,existing_user,selected_role,selected_branch,member_name,member_email);
 return true;
end;$$;
revoke all on function public.link_existing_member(uuid,text,text,uuid,uuid) from public,anon;
grant execute on function public.link_existing_member(uuid,text,text,uuid,uuid) to authenticated;
