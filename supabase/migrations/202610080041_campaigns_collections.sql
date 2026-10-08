create function public.save_communication_configuration(t uuid,category_name text,key_name text,settings jsonb) returns void language plpgsql security definer set search_path='' as $$declare old jsonb;x jsonb;begin
 if not public.has_permission(t,'tenant.manage') then raise exception 'Access denied' using errcode='42501';end if;
 if settings is null or jsonb_typeof(settings)<>'object' then raise exception 'Invalid configuration' using errcode='23514';end if;
 if key_name !~ '^[a-z][a-z0-9_]{1,39}$' then raise exception 'Invalid key' using errcode='23514';end if;
 if category_name='communication' and key_name='rules' then
 if not settings ?& array['timezone','startHour','endHour','maxPerDay','maxAttempts','retrySeconds','optOutText','buckets'] or settings->>'timezone' not in (select name from pg_catalog.pg_timezone_names) or (settings->>'startHour')::int not between 0 and 23 or (settings->>'endHour')::int not between 1 and 24 or (settings->>'startHour')::int>=(settings->>'endHour')::int or (settings->>'maxPerDay')::int not between 1 and 100 or (settings->>'maxAttempts')::int not between 1 and 10 or (settings->>'retrySeconds')::int not between 1 and 86400 or length(settings->>'optOutText') not between 2 and 300 or jsonb_array_length(settings->'buckets') not between 1 and 10 then raise exception 'Invalid rules' using errcode='23514';end if;
 for x in select value from jsonb_array_elements(settings->'buckets') loop if x::text !~ '^\d{1,4}$' or x::text::int<1 then raise exception 'Invalid bucket' using errcode='23514';end if;end loop;
 elsif category_name='message_template' then
 if not settings ?& array['name','body','active','channel','whatsappName','whatsappLanguage'] or length(settings->>'name') not between 2 and 150 or length(settings->>'body') not between 2 and 4000 or jsonb_typeof(settings->'active') is distinct from 'boolean' or settings->>'channel' not in ('sms','whatsapp','email') or settings->>'whatsappName' !~ '^[a-z0-9_]*$' or settings->>'whatsappLanguage' !~ '^[a-z]{2}(_[A-Z]{2})?$' then raise exception 'Invalid template' using errcode='23514';end if;
 for x in select to_jsonb(m[1]) from regexp_matches(settings->>'body','\{([^}]+)\}','g') m loop if x#>>'{}' not in ('nome','valor','data','numero','microcredito') then raise exception 'Unknown variable' using errcode='23514';end if;end loop;
 elsif category_name='automation' then
 if not settings ?& array['enabled','event','offsetDays','channel','template'] or jsonb_typeof(settings->'enabled') is distinct from 'boolean' or settings->>'event' not in ('due','submitted','approved','declined','disbursed','payment') or (settings->>'offsetDays')::int not between -365 and 365 or settings->>'channel' not in ('sms','whatsapp','email') or not exists(select 1 from public.tenant_configuration where tenant_id=t and category='message_template' and key=settings->>'template') then raise exception 'Invalid automation' using errcode='23514';end if;
 select value into old from public.tenant_configuration where tenant_id=t and category=category_name and key=key_name;
 settings:=settings||jsonb_build_object('activatedAt',case when not coalesce((old->>'enabled')::boolean,false) and (settings->>'enabled')::boolean then to_jsonb(now()) else coalesce(old->'activatedAt',to_jsonb(now())) end);
 else raise exception 'Invalid category' using errcode='23514';end if;
 insert into public.tenant_configuration(tenant_id,category,key,value) values(t,category_name,key_name,settings) on conflict(tenant_id,category,key) do update set value=excluded.value;
end;$$;
-- Validate direct configuration writes too, including stale clients bypassing the form.
create function communication_private.configuration_guard() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' then if old.category in ('communication','automation','message_template','integration') then raise exception 'Configuration cannot be deleted' using errcode='42501';end if;return old;end if;
 if new.category in ('communication','automation','message_template','integration') and auth.uid() is not null and current_setting('loma.communication_config',true) is distinct from 'on' then raise exception 'Use configuration RPC' using errcode='42501';end if;return new;end;$$;
create trigger communication_config_guard before insert or update or delete on public.tenant_configuration for each row execute function communication_private.configuration_guard();
-- The authorised RPC sets a transaction-local guard; provisioning and workers have no user JWT.
do $$declare b text;begin b:=pg_get_functiondef('public.save_communication_configuration(uuid,text,text,jsonb)'::regprocedure);b:=replace(b,'insert into public.tenant_configuration','perform set_config(''loma.communication_config'',''on'',true);'||chr(10)||' insert into public.tenant_configuration');execute b;
b:=pg_get_functiondef('public.save_integration(uuid,text,jsonb)'::regprocedure);b:=replace(b,'insert into public.tenant_configuration','perform set_config(''loma.communication_config'',''on'',true);'||chr(10)||' insert into public.tenant_configuration');execute b;end;$$;
create function communication_private.segment(t uuid,b uuid,s jsonb,ch text) returns setof public.clients language sql stable security definer set search_path='' as $$
 select c.* from public.clients c where c.tenant_id=t and c.branch_id=b and communication_private.allowed(t,c.id,ch)
 and (coalesce(s->>'province','')='' or c.profile->>'province'=s->>'province')
 and (coalesce(s->>'risk','')='' or c.risk_class=s->>'risk')
 and (not coalesce((s->>'birthday')::boolean,false) or to_char(c.birth_date,'MM-DD')=to_char(now() at time zone 'Africa/Maputo','MM-DD'))
 and (not coalesce((s->>'noActive')::boolean,false) or not exists(select 1 from public.applications a join public.contracts ct on ct.application_id=a.id and ct.tenant_id=t join public.loans l on l.contract_id=ct.id and l.tenant_id=t where a.client_id=c.id and a.tenant_id=t and l.status in ('active','overdue')))
 and (coalesce(s->>'product','')='' or exists(select 1 from public.applications a join public.product_versions v on v.id=a.product_version_id and v.tenant_id=t where a.client_id=c.id and a.tenant_id=t and v.product_id::text=s->>'product'))
 and (coalesce(s->>'settledMonths','')='' or exists(select 1 from public.applications a join public.contracts ct on ct.application_id=a.id and ct.tenant_id=t join public.loans l on l.contract_id=ct.id and l.tenant_id=t where a.client_id=c.id and a.tenant_id=t and l.status='settled' and (select max(p.paid_on) from public.payments p where p.loan_id=l.id and p.tenant_id=t and not exists(select 1 from public.payment_reversals r where r.payment_id=p.id and r.tenant_id=t))<=((now() at time zone 'Africa/Maputo')::date-make_interval(months=>greatest(0,least(120,(s->>'settledMonths')::int))))::date));
$$;
create function public.preview_campaign(t uuid,b uuid,ch text,template text,segment jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare tpl jsonb;n int;sample jsonb;begin
 if not public.has_permission(t,'messages.manage') or not public.branch_allowed(t,b) or ch not in ('sms','whatsapp','email') then raise exception 'Access denied' using errcode='42501';end if;
 select value into tpl from public.tenant_configuration where tenant_id=t and category='message_template' and key=template;
 if tpl is null then raise exception 'Invalid template' using errcode='23514';end if;
 select count(*) into n from communication_private.segment(t,b,segment,ch);
 select communication_private.variables(t,id) into sample from communication_private.segment(t,b,segment,ch) order by name limit 1;
 return jsonb_build_object('count',n,'body',tpl->>'body','sample',sample,'active',coalesce((tpl->>'active')::boolean,false));
end;$$;
create function public.create_campaign(t uuid,b uuid,name text,ch text,template text,segment jsonb,scheduled timestamptz,request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$declare p jsonb;begin
 p:=public.preview_campaign(t,b,ch,template,segment);
 if not exists(select 1 from public.tenants te join public.plans pl on pl.id=te.plan_id where te.id=t and coalesce((pl.features->>'campaigns')::boolean,false)) then raise exception 'Campaign unavailable' using errcode='42501';end if;
 if length(trim(name)) not between 2 and 150 or scheduled is null or not (p->>'active')::boolean then raise exception 'Invalid campaign' using errcode='23514';end if;
 insert into public.campaigns(id,tenant_id,branch_id,name,channel,template_key,segment,scheduled_at,created_by) values(request_id,t,b,trim(name),ch,template,segment,greatest(now(),scheduled),auth.uid()) on conflict(id) do nothing;
 if not exists(select 1 from public.campaigns where id=request_id and tenant_id=t and branch_id=b and created_by=auth.uid() and campaigns.name=trim(create_campaign.name) and channel=ch and template_key=template and campaigns.segment=create_campaign.segment) then raise exception 'Conflicting request' using errcode='PT409';end if;return request_id;
end;$$;
create function public.cancel_campaign(t uuid,c uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.has_permission(t,'messages.manage') or not exists(select 1 from public.campaigns where id=c and tenant_id=t and public.branch_allowed(t,branch_id)) then raise exception 'Access denied' using errcode='42501';end if;
 update public.campaigns set status='cancelled' where id=c and tenant_id=t;
 update public.message_jobs set status='suppressed',reason='cancelled' where campaign_id=c and tenant_id=t and status='queued';
end;$$;
create function public.record_collection(t uuid,l uuid,kind text,note text,due date default null,amount text default null,request_id uuid default gen_random_uuid()) returns uuid language plpgsql security definer set search_path='' as $$declare b uuid;begin
 select branch_id into b from public.loans where id=l and tenant_id=t;
 if b is null or not public.has_permission(t,'collections.manage') or not public.branch_allowed(t,b) then raise exception 'Access denied' using errcode='42501';end if;
 if due is not null and due<(now() at time zone 'Africa/Maputo')::date or amount is not null and amount !~ '^\d{1,18}$' then raise exception 'Invalid promise' using errcode='23514';end if;
 insert into public.collection_actions(id,tenant_id,loan_id,branch_id,kind,note,due_on,amount,actor_id) values(request_id,t,l,b,kind,trim(note),due,amount::bigint,auth.uid()) on conflict(id) do nothing;
 if not exists(select 1 from public.collection_actions a where a.id=request_id and a.tenant_id=t and a.loan_id=l and a.actor_id=auth.uid() and a.kind=record_collection.kind and a.note=trim(record_collection.note) and a.due_on is not distinct from due and a.amount is not distinct from amount::bigint) then raise exception 'Conflicting request' using errcode='PT409';end if;return request_id;
end;$$;
create function public.assign_collection(t uuid,l uuid,u uuid,target text) returns void language plpgsql security definer set search_path='' as $$declare b uuid;begin
 select branch_id into b from public.loans where id=l and tenant_id=t;
 if not public.has_permission(t,'tenant.manage') or b is null or not public.branch_allowed(t,b) or target !~ '^\d{1,18}$' or not exists(select 1 from public.memberships where tenant_id=t and user_id=u and active and (branch_id is null or branch_id=b)) then raise exception 'Access denied or invalid assignment' using errcode='42501';end if;
 insert into public.collection_assignments values(t,l,b,u,target::bigint) on conflict(tenant_id,loan_id) do update set user_id=excluded.user_id,target=excluded.target;
end;$$;
create function public.collections_summary(t uuid,query text default '',min_days int default 1,max_days int default 100000,only_mine boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$declare rows jsonb;begin
 if not public.has_permission(t,'collections.manage') then raise exception 'Access denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(z)),'[]') into rows from (
 select l.id,c.id client_id,c.name,c.branch_id,(select x->>'value' from jsonb_array_elements(c.profile->'contacts') x where x->>'kind'='phone' limit 1) phone,
 ((now() at time zone 'Africa/Maputo')::date-min(i.due_date)) days,sum(i.principal+i.interest+i.fine+i.late_interest)::text amount,
 ca.user_id assigned_to,coalesce(ca.target,0)::text target,
 coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'kind',a.kind,'note',a.note,'due',a.due_on,'amount',a.amount::text,'at',a.created_at) order by a.created_at desc) from (select * from public.collection_actions where loan_id=l.id and tenant_id=t order by created_at desc limit 10) a),'[]') activities
 from public.loans l join public.contracts ct on ct.id=l.contract_id and ct.tenant_id=t join public.applications ap on ap.id=ct.application_id and ap.tenant_id=t join public.clients c on c.id=ap.client_id and c.tenant_id=t join public.loan_instalments i on i.loan_id=l.id and i.tenant_id=t left join public.collection_assignments ca on ca.loan_id=l.id and ca.tenant_id=t
 where l.tenant_id=t and l.status in ('active','overdue') and public.branch_allowed(t,l.branch_id) and i.due_date<(now() at time zone 'Africa/Maputo')::date and i.principal+i.interest+i.fine+i.late_interest>0 and (query='' or c.name ilike '%'||query||'%' or exists(select 1 from public.client_keys k where k.client_id=c.id and k.tenant_id=t and k.value ilike '%'||query||'%')) and (not only_mine or ca.user_id=auth.uid())
 group by l.id,c.id,ca.user_id,ca.target having ((now() at time zone 'Africa/Maputo')::date-min(i.due_date)) between min_days and max_days order by min(i.due_date),sum(i.principal+i.interest+i.fine+i.late_interest) desc limit 100) z;
 return rows;
end;$$;
create function public.save_lead(t uuid,data jsonb,selected uuid default null,expected_revision int default 0) returns uuid language plpgsql security definer set search_path='' as $$declare old public.leads;id uuid:=coalesce(selected,gen_random_uuid());b uuid:=(data->>'branch')::uuid;begin
 if not public.has_permission(t,'messages.manage') or not public.branch_allowed(t,b) then raise exception 'Access denied' using errcode='42501';end if;
 if selected is not null then select * into old from public.leads where leads.id=selected and tenant_id=t for update;if old.id is null or not public.branch_allowed(t,old.branch_id) then raise exception 'Access denied' using errcode='42501';end if;if old.revision<>expected_revision then raise exception 'Stale lead' using errcode='PT409';end if;end if;
 if data->>'status' in ('submitted','approved') and not exists(select 1 from public.applications where client_id=(data->>'client')::uuid and tenant_id=t and public.branch_allowed(t,branch_id) and (data->>'status'='submitted' and status<>'draft' or data->>'status'='approved' and status in ('approved','disbursed'))) then raise exception 'Conversion requires an actual application' using errcode='23514';end if;
 if coalesce(data->>'client','')<>'' and not public.client_allowed(t,(data->>'client')::uuid,'messages.manage') then raise exception 'Access denied' using errcode='42501';end if;
 if jsonb_typeof(data->'consent') is distinct from 'object' or jsonb_typeof(data->'consent'->'sms') is distinct from 'boolean' or jsonb_typeof(data->'consent'->'whatsapp') is distinct from 'boolean' or jsonb_typeof(data->'consent'->'email') is distinct from 'boolean' or ((data->'consent'->>'sms')::boolean or (data->'consent'->>'whatsapp')::boolean or (data->'consent'->>'email')::boolean) and length(trim(data->'consent'->>'source'))<2 then raise exception 'Invalid consent' using errcode='23514';end if;
 insert into public.leads(id,tenant_id,branch_id,name,phone,origin,status,consent,client_id,revision) values(id,t,b,data->>'name',data->>'phone',data->>'origin',data->>'status',data->'consent',nullif(data->>'client','')::uuid,coalesce(old.revision,0)+1) on conflict on constraint leads_pkey do update set branch_id=excluded.branch_id,name=excluded.name,phone=excluded.phone,origin=excluded.origin,status=excluded.status,consent=excluded.consent,client_id=excluded.client_id,revision=excluded.revision;
 return id;
end;$$;
revoke all on all functions in schema communication_private from public,anon,authenticated;
revoke all on function public.save_communication_configuration(uuid,text,text,jsonb),public.preview_campaign(uuid,uuid,text,text,jsonb),public.create_campaign(uuid,uuid,text,text,text,jsonb,timestamptz,uuid),public.cancel_campaign(uuid,uuid),public.record_collection(uuid,uuid,text,text,date,text,uuid),public.assign_collection(uuid,uuid,uuid,text),public.collections_summary(uuid,text,int,int,boolean),public.save_lead(uuid,jsonb,uuid,int) from public,anon;
grant execute on function public.save_communication_configuration(uuid,text,text,jsonb),public.preview_campaign(uuid,uuid,text,text,jsonb),public.create_campaign(uuid,uuid,text,text,text,jsonb,timestamptz,uuid),public.cancel_campaign(uuid,uuid),public.record_collection(uuid,uuid,text,text,date,text,uuid),public.assign_collection(uuid,uuid,uuid,text),public.collections_summary(uuid,text,int,int,boolean),public.save_lead(uuid,jsonb,uuid,int) to authenticated;
