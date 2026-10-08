alter table public.tenants add column is_demo boolean not null default false;
alter table public.tenants add column demo_generation integer not null default 0 check(demo_generation>=0);
create schema demo_private;
revoke all on schema demo_private from public,anon,authenticated;
create function demo_private.guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (tg_op='INSERT' and new.is_demo) or (tg_op='UPDATE' and (new.is_demo is distinct from old.is_demo or new.demo_generation is distinct from old.demo_generation)) then
 if current_setting('loma.demo_config',true) is distinct from 'on' then raise exception 'Demo flags are protected' using errcode='42501';end if;end if;return new;end;$$;
create trigger demo_tenant_guard before insert or update on public.tenants for each row execute function demo_private.guard();
create function public.enable_demo(t uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_platform_admin() then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.tenants where id=t and active for update;
 if not found or exists(select 1 from public.clients where tenant_id=t) or exists(select 1 from public.applications where tenant_id=t) then raise exception 'Empty tenant required' using errcode='23514';end if;
 perform set_config('loma.demo_config','on',true);update public.tenants set is_demo=true where id=t;
end;$$;
create function public.demo_blueprint(t uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare g int;begin
 if not public.has_permission(t,'tenant.manage') then raise exception 'Access denied' using errcode='42501';end if;
 select demo_generation into g from public.tenants where id=t and is_demo and active;if not found then raise exception 'Demo required' using errcode='42501';end if;
 return jsonb_build_object('generation',g,'products',(select configuration->'products' from public.presets where id='20000000-0000-4000-8000-000000000001'));
end;$$;
create function public.reset_demo(t uuid,expected_generation integer,payload text,signature text) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.tenants;nt uuid:=gen_random_uuid();data jsonb;k text;owner uuid:=auth.uid();creator uuid;br uuid[]:='{}';cl uuid[]:='{}';pr uuid[]:='{}';pv uuid[]:='{}';r record;x jsonb;v jsonb;ln jsonb;payment jsonb;alloc jsonb;part jsonb;postings jsonb;cid uuid;aid uuid;coid uuid;lid uuid;pid uuid;n bigint:=0;amount bigint;idx int;template jsonb;brand jsonb;paid_date date;begin
 if not public.has_permission(t,'tenant.manage') then raise exception 'Access denied' using errcode='42501';end if;
 select * into strict old from public.tenants where id=t for update;
 if not old.is_demo then raise exception 'Demo required' using errcode='42501';end if;
 if not old.active or old.demo_generation<>expected_generation then raise exception 'Generation changed' using errcode='PT409';end if;
 select secret into strict k from financial_private.signing_key where id;
 if signature is null or signature<>encode(extensions.hmac(convert_to('demo:'||payload,'UTF8'),convert_to(k,'UTF8'),'sha256'),'hex') then raise exception 'Invalid demo attestation' using errcode='42501';end if;
 data:=payload::jsonb;
 if data->>'tenant'<>t::text or data->>'actor'<>owner::text or (data->>'expires')::timestamptz<now() or (data->>'generation')::int<>expected_generation or (data->'dataset'->>'today')::date<>(now() at time zone 'Africa/Maputo')::date or jsonb_array_length(data->'dataset'->'clients')<>120 or jsonb_array_length(data->'dataset'->'loans')<>60 or jsonb_array_length(data->'dataset'->'products')<>4 then raise exception 'Invalid demo payload' using errcode='23514';end if;
 data:=data->'dataset';
 perform set_config('loma.demo_config','on',true);perform set_config('loma.scoring_config','on',true);perform set_config('loma.communication_config','on',true);perform set_config('loma.website_config','on',true);
 update public.tenants set slug='archive-'||replace(id::text,'-',''),active=false where id=t;
 insert into public.tenants(id,slug,name,plan_id,accent,is_demo,demo_generation,legal_name,contact_phone,footer) values(nt,old.slug,'Demo Microcrédito',old.plan_id,old.accent,true,expected_generation+1,'Demo Microcrédito','+258 84 900 0000','Dados sintéticos para demonstração. Nenhum crédito representa uma operação real.');
 for x in select value from jsonb_array_elements(data->'branches') loop insert into public.branches(tenant_id,name) values(nt,x#>>'{}') returning id into cid;br:=array_append(br,cid);end loop;
 insert into public.tenant_roles(tenant_id,key,name,permissions) select nt,key,name,permissions from public.tenant_roles where tenant_id=t;
 insert into public.memberships(tenant_id,user_id,role_id,branch_id,display_name,email,active) select nt,m.user_id,nr.id,case when m.branch_id is null then null else br[1] end,m.display_name,m.email,m.active from public.memberships m join public.tenant_roles orl on orl.id=m.role_id and orl.tenant_id=t join public.tenant_roles nr on nr.tenant_id=nt and nr.key=orl.key where m.tenant_id=t;
 select user_id into creator from public.memberships where tenant_id=nt and user_id<>owner and active order by display_name limit 1;
 if creator is null then raise exception 'Second demo actor required' using errcode='23514';end if;
 -- Templates/defaults are editable data copied from the existing demonstration.
 insert into public.tenant_configuration(tenant_id,category,key,value) select nt,category,key,value from public.tenant_configuration where tenant_id=t and category in ('document','communication','message_template','automation') on conflict(tenant_id,category,key) do update set value=excluded.value;
 update public.tenant_configuration set value=jsonb_set(value,'{enabled}','false'::jsonb) where tenant_id=nt and category='automation';
 for x in select value from jsonb_array_elements(data->'products') loop
 insert into public.products(tenant_id,name,source_key,status,revision,active_version) values(nt,x->>'name',x->>'key','active',1,1) returning id into cid;pr:=array_append(pr,cid);
 insert into public.product_versions(tenant_id,product_id,version,name,terms,created_by) values(nt,cid,1,x->>'name',x->'terms',owner) returning id into cid;pv:=array_append(pv,cid);end loop;
 for x in select value from jsonb_array_elements(data->'clients') loop
 insert into public.clients(tenant_id,branch_id,name,birth_date,profile,consent,classification,created_at) values(nt,br[(x->>'branch')::int+1],x->>'name',(x->>'birth_date')::date,x->'profile',x->'consent',x->>'classification',(x->>'created_at')::date) returning id into cid;cl:=array_append(cl,cid);
 insert into public.client_keys(tenant_id,client_id,kind,value) select nt,cid,'bi',x->'profile'->'identities'->0->>'value' union all select nt,cid,'phone',x->'profile'->'contacts'->0->>'value';
 insert into public.client_events(tenant_id,client_id,actor_id,kind,detail,created_at) values(nt,cid,owner,'created','{"source":"synthetic_demo"}',(x->>'created_at')::date);
 insert into public.scoring_evidence(tenant_id,client_id,branch_id,employment_months,verified_references,note,updated_by) values(nt,cid,br[(x->>'branch')::int+1],(x->>'employmentMonths')::int,(x->>'verifiedReferences')::int,'Evidência sintética de demonstração.',owner);
 end loop;
 select value into template from public.tenant_configuration where tenant_id=nt and category='document' and key='contract';
 brand:=jsonb_build_object('name','Demo Microcrédito','legalName','Demo Microcrédito','license','','contact','+258 84 900 0000','footer','Dados sintéticos de demonstração.','currency','MZN');
 for ln in select value from jsonb_array_elements(data->'loans') loop
 idx:=(ln->>'client')::int;cid:=cl[idx+1];select branch_id into strict coid from public.clients where id=cid and tenant_id=nt;
 x:=data->'products'->(ln->>'product')::int;
 insert into public.applications(tenant_id,client_id,branch_id,product_version_id,principal,periods,start_date,purpose,status,created_by,decided_by,created_at) values(nt,cid,coid,pv[(ln->>'product')::int+1],ln->>'principal',(ln->>'periods')::int,(ln->>'startDate')::date,ln->>'purpose','disbursed',creator,owner,(ln->>'startDate')::date) returning id into aid;
 select profile into v from public.clients where tenant_id=nt and id=cid;
 insert into public.contracts(tenant_id,application_id,branch_id,approved_by,approved_at,snapshot) values(nt,aid,coid,owner,(ln->>'startDate')::date,jsonb_build_object('principal',ln->>'principal','periods',(ln->>'periods')::int,'startDate',ln->>'startDate','terms',x->'terms','productName',x->>'name','productVersion',1,'client',jsonb_build_object('name',data->'clients'->idx->>'name','birthDate',data->'clients'->idx->>'birth_date','profile',v),'brand',brand,'template',template,'purpose',ln->>'purpose','guarantees',x->'terms'->'requirements'->'guarantees')) returning id into coid;
 select branch_id into strict aid from public.clients where tenant_id=nt and id=cid;
 insert into public.loans(tenant_id,contract_id,branch_id,disbursed_on,method,reference,signed_on,recorded_by,created_at) values(nt,coid,aid,(ln->>'startDate')::date,'transfer','DEM-'||idx,(ln->>'startDate')::date,owner,(ln->>'startDate')::date) returning id into lid;
 perform financial_private.initialise(nt,lid,ln->'plan');
 for payment in select value from jsonb_array_elements(ln->'payments') loop
 paid_date:=(payment->>'date')::date;amount:=(payment->>'amount')::bigint;perform financial_private.accrue(nt,lid,paid_date);alloc:=financial_private.allocation(nt,lid,amount);n:=n+1;pid:=gen_random_uuid();
 insert into public.payments(id,tenant_id,loan_id,branch_id,request_id,amount,method,reference,paid_on,receipt_number,receipt_snapshot,allocations,credit,recorded_by,created_at) values(pid,nt,lid,aid,gen_random_uuid(),amount,'transfer','DEM-P-'||n,paid_date,n,jsonb_build_object('brand',brand,'client',data->'clients'->idx->>'name','contract',coid,'template',(select value from public.tenant_configuration where tenant_id=nt and category='document' and key='receipt')),alloc->'allocations',(alloc->>'credit')::bigint,owner,paid_date);
 postings:=jsonb_build_array(financial_private.posting('funds_transfer',amount,0));
 for part in select value from jsonb_array_elements(alloc->'allocations') loop
 update public.loan_instalments set principal=principal-case when part->>'component'='principal' then (part->>'amount')::bigint else 0 end,interest=interest-case when part->>'component'='interest' then (part->>'amount')::bigint else 0 end,fine=fine-case when part->>'component'='fine' then (part->>'amount')::bigint else 0 end,late_interest=late_interest-case when part->>'component'='lateInterest' then (part->>'amount')::bigint else 0 end where loan_id=lid and number=(part->>'number')::int;
 postings:=postings||financial_private.posting('receivable_'||(part->>'component'),0,(part->>'amount')::bigint);end loop;
 postings:=postings||financial_private.posting('client_credit',0,(alloc->>'credit')::bigint);
 insert into public.journal_transactions(tenant_id,branch_id,loan_id,payment_id,source,source_key,postings,created_at) values(nt,aid,lid,pid,'payment',pid::text,postings,paid_date);
 update public.loan_accounts set credit=credit+(alloc->>'credit')::bigint,revision=revision+1 where tenant_id=nt and loan_id=lid;
 insert into public.client_events(tenant_id,client_id,actor_id,kind,detail,created_at) values(nt,cid,owner,'payment',jsonb_build_object('payment_id',pid,'loan_id',lid,'amount',amount::text,'receipt',n::text),paid_date);
 end loop;
 perform financial_private.accrue(nt,lid,(data->>'today')::date);perform financial_private.status(lid);perform scoring_private.refresh(nt,cid);
 insert into public.collection_assignments(tenant_id,loan_id,branch_id,user_id,target) select nt,lid,aid,user_id,'1000000'::bigint from public.memberships m join public.tenant_roles tr on tr.id=m.role_id and tr.tenant_id=nt where m.tenant_id=nt and m.active and tr.key='collector' and (m.branch_id is null or m.branch_id=aid) limit 1;
 end loop;
 insert into public.receipt_counters(tenant_id,last_number) values(nt,n);
 -- Pending applications and accepted console history, never a queue of real recipients.
 for idx in 60..67 loop
 cid:=cl[idx+1];select branch_id into aid from public.clients where tenant_id=nt and id=cid;
 insert into public.applications(tenant_id,client_id,branch_id,product_version_id,principal,periods,start_date,purpose,status,created_by,created_at) values(nt,cid,aid,pv[1],'1000000',6,(data->>'today')::date,'Comprar mercadoria para a banca.',case when idx%2=0 then 'submitted' else 'in_review' end,creator,now()-interval '2 days');end loop;
 for idx in 0..29 loop
 cid:=cl[idx+1];select branch_id into aid from public.clients where tenant_id=nt and id=cid;
 insert into public.message_jobs(tenant_id,client_id,branch_id,channel,template_key,body,variables,source_key,status,attempts,cost,created_by,created_at,accepted_at,provider_id) values(nt,cid,aid,'sms','received','Olá '||(data->'clients'->idx->>'name')||'. Recebemos o seu pedido. A agência irá contactá-lo.','{}','demo-'||idx,'accepted',1,0,owner,now()-interval '3 days',now()-interval '3 days','console:demo-'||idx) returning id into pid;
 insert into public.message_events(tenant_id,message_id,state,detail) values(nt,pid,'accepted','{"provider":"console","synthetic":true}');end loop;
 insert into public.audit_events(tenant_id,actor_id,action,entity,entity_id,current) values(nt,owner,'reset','demo_generation',nt::text,jsonb_build_object('previousTenant',t,'generation',expected_generation+1,'clients',120,'loans',60));
 return nt;
end;$$;
-- No demonstration can acquire real communication credentials or dispatch externally.
create function demo_private.integration_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.category='integration' and new.value->>'provider'<>'console' and exists(select 1 from public.tenants where id=new.tenant_id and is_demo) then raise exception 'Demo uses console only' using errcode='42501';end if;return new;end;$$;
create trigger demo_integration_guard before insert or update on public.tenant_configuration for each row execute function demo_private.integration_guard();
do $$declare body text;begin
 body:=pg_get_functiondef('communication_private.prepare(uuid)'::regprocedure);
 body:=replace(body,'settings:=coalesce(settings,','if exists(select 1 from public.tenants where id=job.tenant_id and is_demo) then settings:='' {"provider":"console","cost":"0"}''::jsonb;end if;settings:=coalesce(settings,');execute body;
end;$$;
revoke all on all functions in schema demo_private from public,anon,authenticated;
revoke all on function public.enable_demo(uuid),public.demo_blueprint(uuid),public.reset_demo(uuid,integer,text,text) from public,anon;
grant execute on function public.enable_demo(uuid),public.demo_blueprint(uuid),public.reset_demo(uuid,integer,text,text) to authenticated;
