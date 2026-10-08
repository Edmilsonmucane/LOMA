create schema communication_private;
revoke all on schema communication_private from public,anon,authenticated;
create table communication_private.key(id boolean primary key default true check(id),secret text not null);
insert into communication_private.key(secret) values(encode(extensions.gen_random_bytes(32),'hex'));
create table communication_private.integrations(tenant_id uuid references public.tenants(id),channel text check(channel in ('sms','whatsapp','email')),cipher bytea not null,primary key(tenant_id,channel));
create table public.campaigns(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),branch_id uuid not null,name text not null check(length(name) between 2 and 150),channel text not null check(channel in ('sms','whatsapp','email')),template_key text not null,segment jsonb not null,scheduled_at timestamptz not null,status text not null default 'scheduled' check(status in ('scheduled','queued','cancelled')),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(id,tenant_id),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id));
create table public.message_jobs(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null,branch_id uuid not null,campaign_id uuid,channel text not null check(channel in ('sms','whatsapp','email')),template_key text not null,body text not null,variables jsonb not null,source_key text not null,available_at timestamptz not null default now(),status text not null default 'queued' check(status in ('queued','accepted','delivered','failed','suppressed','uncertain')),attempts integer not null default 0,cost bigint not null default 0 check(cost>=0),provider_id text,reason text,created_by uuid references auth.users(id),created_at timestamptz not null default now(),accepted_at timestamptz,unique(id,tenant_id),unique(tenant_id,source_key),foreign key(client_id,tenant_id) references public.clients(id,tenant_id),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id),foreign key(campaign_id,tenant_id) references public.campaigns(id,tenant_id));
create index on public.message_jobs(available_at) where status='queued';
create index on public.message_jobs(tenant_id,client_id,accepted_at);
create table public.message_events(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,message_id uuid not null,state text not null,detail jsonb not null default '{}',created_at timestamptz not null default now(),foreign key(message_id,tenant_id) references public.message_jobs(id,tenant_id));
create table public.collection_actions(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,loan_id uuid not null,branch_id uuid not null,kind text not null check(kind in ('contact','promise','visit','completed')),note text not null check(length(note) between 2 and 2000),due_on date,amount bigint check(amount>=0),actor_id uuid not null references auth.users(id),created_at timestamptz not null default now(),foreign key(loan_id,tenant_id) references public.loans(id,tenant_id),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id),check(kind not in ('promise','visit') or due_on is not null),check(kind<>'promise' or amount>0));
create table public.collection_assignments(tenant_id uuid not null,loan_id uuid not null,branch_id uuid not null,user_id uuid not null,target bigint not null check(target>=0),primary key(tenant_id,loan_id),foreign key(loan_id,tenant_id) references public.loans(id,tenant_id),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id),foreign key(tenant_id,user_id) references public.memberships(tenant_id,user_id));
create table public.leads(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),branch_id uuid not null,name text not null check(length(name) between 2 and 150),phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'),origin text not null check(length(origin) between 2 and 150),status text not null check(status in ('new','contacted','simulated','submitted','approved')),consent jsonb not null default '{"sms":false,"whatsapp":false,"email":false,"source":""}',client_id uuid,revision integer not null default 1,created_at timestamptz not null default now(),unique(tenant_id,phone),foreign key(branch_id,tenant_id) references public.branches(id,tenant_id),foreign key(client_id,tenant_id) references public.clients(id,tenant_id));
-- An explicit opt-out survives ordinary client edits; only a separately audited new authorisation clears it.
alter table public.clients add column communication_blocks jsonb not null default '{}';
alter table public.clients add column risk_class text check(risk_class in ('A','B','C','D','E'));
create function communication_private.protect_blocks() returns trigger language plpgsql set search_path='' as $$begin
 if current_user='authenticated' or (auth.uid() is not null and current_setting('loma.consent_override',true) is distinct from 'on') then new.communication_blocks:=old.communication_blocks;new.risk_class:=old.risk_class;end if;return new;
end;$$;
create trigger protect_communication_blocks before update on public.clients for each row execute function communication_private.protect_blocks();
do $$declare tab text;begin
 foreach tab in array array['campaigns','message_jobs','collection_actions','collection_assignments','leads'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('grant select on public.%I to authenticated',tab);
 execute format('create policy scoped_read on public.%I for select to authenticated using(public.has_permission(tenant_id,%L) and public.branch_allowed(tenant_id,branch_id))',tab,case when tab like 'collection_%' then 'collections.manage' else 'messages.manage' end);
 end loop;
end;$$;
alter table public.message_events enable row level security;
grant select on public.message_events to authenticated;
create policy events_read on public.message_events for select to authenticated using(exists(select 1 from public.message_jobs j where j.id=message_id and j.tenant_id=message_events.tenant_id));
create trigger message_events_immutable before update or delete on public.message_events for each row execute function public.audit_immutable();
create trigger message_events_no_truncate before truncate on public.message_events execute function public.audit_immutable();
create trigger collection_actions_immutable before update or delete on public.collection_actions for each row execute function public.audit_immutable();
create trigger collection_actions_no_truncate before truncate on public.collection_actions execute function public.audit_immutable();
create trigger audit_campaigns after insert or update on public.campaigns for each row execute function public.record_audit();
create trigger audit_leads after insert or update on public.leads for each row execute function public.record_audit();
create trigger audit_collection_actions after insert on public.collection_actions for each row execute function public.record_audit();
create trigger audit_collection_assignments after insert or update on public.collection_assignments for each row execute function public.record_audit();
create function communication_private.defaults(t uuid) returns void language plpgsql security definer set search_path='' as $$begin
 insert into public.tenant_configuration(tenant_id,category,key,value) values(t,'communication','rules','{"timezone":"Africa/Maputo","startHour":8,"endHour":19,"maxPerDay":3,"maxAttempts":3,"retrySeconds":60,"optOutText":"Responda SAIR para deixar de receber.","buckets":[7,15,30,60]}'::jsonb) on conflict do nothing;
 insert into public.tenant_configuration(tenant_id,category,key,value)
 select t,'message_template',x.key,jsonb_build_object('name',x.name,'body',x.body,'channel','sms','active',true,'whatsappName','','whatsappLanguage','pt_PT') from (values
 ('reminder','Lembrete de prestação','Olá {nome}. A prestação de {valor} vence a {data}. Contacte a sua agência se precisar de ajuda.'),
 ('received','Pedido recebido','Olá {nome}. Recebemos o seu pedido {numero}. A equipa irá contactá-lo.'),
 ('approved','Pedido aprovado','Olá {nome}. O seu pedido {numero} foi aprovado. Contacte a sua agência para os próximos passos.'),
 ('declined','Pedido recusado','Olá {nome}. Terminámos a análise do pedido {numero}. Contacte a agência para conhecer a decisão.'),
 ('disbursed','Desembolso efectuado','Olá {nome}. Registámos o desembolso de {valor} do seu crédito {numero}.'),
 ('receipt','Recibo de pagamento','Olá {nome}. Recebemos {valor}. Recibo {numero}, em {data}. Obrigado.'),
 ('campaign','Contacto da agência','Olá {nome}. Se precisar de crédito, contacte {microcredito}.')) x(key,name,body) on conflict do nothing;
 insert into public.tenant_configuration(tenant_id,category,key,value)
 select t,'automation',x.key,jsonb_build_object('enabled',false,'activatedAt',now(),'event',x.event,'offsetDays',x.days,'template',x.template,'channel','sms') from (values
 ('before','due',-3,'reminder'),('today','due',0,'reminder'),('late1','due',1,'reminder'),('late7','due',7,'reminder'),('late15','due',15,'reminder'),
 ('received','submitted',0,'received'),('approved','approved',0,'approved'),('declined','declined',0,'declined'),('disbursed','disbursed',0,'disbursed'),('receipt','payment',0,'receipt')) x(key,event,days,template) on conflict do nothing;
end;$$;
select communication_private.defaults(id) from public.tenants;
create function communication_private.new_tenant() returns trigger language plpgsql security definer set search_path='' as $$begin perform communication_private.defaults(new.id);return new;end;$$;
create trigger communication_new_tenant after insert on public.tenants for each row execute function communication_private.new_tenant();
create function communication_private.rules(t uuid) returns jsonb language sql stable security definer set search_path='' as $$select value from public.tenant_configuration where tenant_id=t and category='communication' and key='rules'$$;
create function communication_private.allowed(t uuid,c uuid,ch text) returns boolean language sql stable security definer set search_path='' as $$select coalesce((consent->>ch)::boolean,false) and not coalesce((communication_blocks->>ch)::boolean,false) from public.clients where id=c and tenant_id=t$$;
create function communication_private.variables(t uuid,c uuid,extra jsonb default '{}') returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('nome',cl.name,'microcredito',te.name,'valor','0,00 MT','data',to_char((now() at time zone 'Africa/Maputo')::date,'DD/MM/YYYY'),'numero','')||extra from public.clients cl join public.tenants te on te.id=cl.tenant_id where cl.id=c and cl.tenant_id=t$$;
create function communication_private.money(n bigint) returns text language sql immutable set search_path='' as $$select replace(to_char(n::numeric/100,'FM999G999G999G999G999G990D00'),',',' ')||' MT'$$;
create function communication_private.enqueue(t uuid,c uuid,ch text,tk text,source text,extra jsonb default '{}',scheduled timestamptz default now(),campaign uuid default null) returns uuid language plpgsql security definer set search_path='' as $$declare cl public.clients;v jsonb;tpl jsonb;b text;k text;j uuid;begin
 select * into cl from public.clients where id=c and tenant_id=t;
 if cl.id is null or ch not in ('sms','whatsapp','email') or not coalesce(communication_private.allowed(t,c,ch),false) then return null;end if;
 select value into tpl from public.tenant_configuration where tenant_id=t and category='message_template' and key=tk;
 if tpl is null or not coalesce((tpl->>'active')::boolean,false) then return null;end if;
 v:=communication_private.variables(t,c,extra);b:=tpl->>'body';
 for k in select jsonb_object_keys(v) loop b:=replace(b,'{'||k||'}',v->>k);end loop;
 if b ~ '\{[^}]+\}' then raise exception 'Unknown template variable' using errcode='23514';end if;
 b:=b||E'\n'||(communication_private.rules(t)->>'optOutText');
 insert into public.message_jobs(tenant_id,client_id,branch_id,campaign_id,channel,template_key,body,variables,source_key,available_at,created_by)
 values(t,c,cl.branch_id,campaign,ch,tk,b,v,source,greatest(now(),scheduled),auth.uid()) on conflict(tenant_id,source_key) do nothing returning id into j;
 if j is not null then insert into public.message_events(tenant_id,message_id,state) values(t,j,'queued');end if;return j;
end;$$;
create function public.queue_message(t uuid,c uuid,ch text,template text,request_id uuid,loan uuid default null) returns uuid language plpgsql security definer set search_path='' as $$declare extra jsonb:='{}';begin
 if not public.client_allowed(t,c,'messages.manage') and not (loan is not null and public.client_allowed(t,c,'collections.manage')) then raise exception 'Access denied' using errcode='42501';end if;
 if loan is not null then
 select jsonb_build_object('valor',communication_private.money(coalesce(sum(i.principal+i.interest+i.fine+i.late_interest),0)::bigint),'data',to_char(min(i.due_date),'DD/MM/YYYY'),'numero',left(l.id::text,8)) into extra from public.loans l join public.contracts ct on ct.id=l.contract_id and ct.tenant_id=t join public.applications a on a.id=ct.application_id and a.tenant_id=t join public.loan_instalments i on i.loan_id=l.id and i.tenant_id=t where l.id=loan and l.tenant_id=t and a.client_id=c and public.branch_allowed(t,l.branch_id) and i.due_date<=(now() at time zone 'Africa/Maputo')::date having count(*)>0;
 if extra is null then raise exception 'Invalid loan' using errcode='23514';end if;end if;
 return communication_private.enqueue(t,c,ch,template,'manual:'||request_id::text,coalesce(extra,'{}'));
end;$$;
create function public.set_communication_consent(t uuid,c uuid,ch text,enabled boolean,source text) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.client_allowed(t,c,'clients.manage') or ch not in ('sms','whatsapp','email') or length(trim(source)) not between 2 and 500 then raise exception 'Access denied or invalid consent' using errcode='42501';end if;
 perform set_config('loma.consent_override','on',true);
 update public.clients set communication_blocks=jsonb_set(communication_blocks,array[ch],to_jsonb(not enabled)),consent=jsonb_set(jsonb_set(consent,array[ch],to_jsonb(enabled)),'{source}',to_jsonb(source)),revision=revision+1 where id=c and tenant_id=t;
 insert into public.client_events(tenant_id,client_id,actor_id,kind,detail) values(t,c,auth.uid(),'consent',jsonb_build_object('channel',ch,'enabled',enabled,'source',source));
 perform set_config('loma.consent_override','off',true);
end;$$;
create function public.save_integration(t uuid,ch text,settings jsonb) returns void language plpgsql security definer set search_path='' as $$declare key text;begin
 if not public.has_permission(t,'tenant.manage') then raise exception 'Access denied' using errcode='42501';end if;
 if ch not in ('sms','whatsapp','email') or settings->>'provider' not in ('console','http','whatsapp') or length(settings::text)>8000 or (settings->>'provider'='whatsapp' and ch<>'whatsapp') or (settings->>'provider'='http' and coalesce(settings->>'url','') !~ '^https://') then raise exception 'Invalid integration' using errcode='23514';end if;
 if coalesce(settings->>'cost','') !~ '^\d{1,18}$' then raise exception 'Invalid cost' using errcode='23514';end if;
 select secret into key from communication_private.key where id;
 insert into communication_private.integrations values(t,ch,extensions.pgp_sym_encrypt(settings::text,key,'cipher-algo=aes256')) on conflict(tenant_id,channel) do update set cipher=excluded.cipher;
 insert into public.tenant_configuration(tenant_id,category,key,value) values(t,'integration',ch,jsonb_build_object('provider',settings->>'provider','cost',settings->>'cost','configured',true)) on conflict(tenant_id,category,key) do update set value=excluded.value;
 insert into public.audit_events(tenant_id,actor_id,entity,entity_id,action,previous,current) values(t,auth.uid(),'integration',t::text,'UPDATE',null,jsonb_build_object('channel',ch,'provider',settings->>'provider'));
end;$$;
-- Only explicitly granted RPCs are exposed; technical functions have no API grants.
revoke all on all functions in schema communication_private from public,anon,authenticated;
revoke all on function public.queue_message(uuid,uuid,text,text,uuid,uuid),public.set_communication_consent(uuid,uuid,text,boolean,text),public.save_integration(uuid,text,jsonb) from public,anon;
grant execute on function public.queue_message(uuid,uuid,text,text,uuid,uuid),public.set_communication_consent(uuid,uuid,text,boolean,text),public.save_integration(uuid,text,jsonb) to authenticated;
