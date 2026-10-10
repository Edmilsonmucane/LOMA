alter table public.message_jobs add column cost_text text generated always as(cost::text) stored;
alter table public.message_jobs add column template_snapshot jsonb not null default '{}';
update public.message_jobs j set template_snapshot=c.value from public.tenant_configuration c where c.tenant_id=j.tenant_id and c.category='message_template' and c.key=j.template_key;
do $$declare b text;begin
 b:=pg_get_functiondef('communication_private.enqueue(uuid,uuid,text,text,text,jsonb,timestamptz,uuid)'::regprocedure);b:=replace(b,'available_at,created_by)','available_at,created_by,template_snapshot)');b:=replace(b,'greatest(now(),scheduled),auth.uid())','greatest(now(),scheduled),auth.uid(),tpl)');execute b;
 b:=pg_get_functiondef('communication_private.prepare(uuid)'::regprocedure);b:=replace(b,$old$(select value from public.tenant_configuration where tenant_id=job.tenant_id and category='message_template' and key=job.template_key)$old$,'job.template_snapshot');execute b;
 b:=pg_get_functiondef('public.today_summary(uuid)'::regprocedure);b:=replace(b,'select l.id,c.snapshot','select l.id,(select a.client_id from public.applications a where a.id=c.application_id and a.tenant_id=t) client_id,c.snapshot');execute b;
end;$$;
create table communication_private.callback_receipts(tenant_id uuid not null,channel text not null,signature text not null,created_at timestamptz not null default now(),primary key(tenant_id,channel,signature));
create function public.provider_callback(t uuid,ch text,payload text,signature text) returns boolean language plpgsql security definer set search_path='' as $$declare cfg jsonb;secret text;data jsonb;e jsonb;v jsonb;j public.message_jobs;c uuid;phone text;state text;begin
 if ch not in ('sms','whatsapp','email') or length(payload)>100000 or signature !~ '^[a-f0-9]{64}$' then return false;end if;
 select extensions.pgp_sym_decrypt(cipher,(select k.secret from communication_private.key k where id))::jsonb into cfg from communication_private.integrations where tenant_id=t and channel=ch;
 secret:=cfg->>'webhookSecret';if length(secret)<16 or secret is null then return false;end if;
 if encode(extensions.hmac(convert_to(payload,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex')<>signature then return false;end if;
 insert into communication_private.callback_receipts values(t,ch,signature,now()) on conflict do nothing;if not found then return true;end if;
 data:=payload::jsonb;
 if ch='whatsapp' then
 for e in select value from jsonb_array_elements(coalesce(data->'entry','[]')) loop
 for v in select value->'value' from jsonb_array_elements(coalesce(e->'changes','[]')) loop
 for data in select value from jsonb_array_elements(coalesce(v->'statuses','[]')) loop
 select * into j from public.message_jobs where tenant_id=t and channel=ch and provider_id=data->>'id' for update;
 state:=case data->>'status' when 'delivered' then 'delivered' when 'read' then 'delivered' when 'failed' then 'failed' else null end;
 if j.id is not null and state is not null and j.status<>state then update public.message_jobs set status=state where id=j.id;insert into public.message_events(tenant_id,message_id,state,detail) values(t,j.id,state,'{"providerCallback":true}');end if;
 end loop;
 for data in select value from jsonb_array_elements(coalesce(v->'messages','[]')) loop
 if upper(trim(data->'text'->>'body'))='SAIR' then phone:='+'||ltrim(data->>'from','+');select client_id into c from public.client_keys where tenant_id=t and kind='phone' and value=phone;
 if c is not null then perform set_config('loma.consent_override','on',true);update public.clients set communication_blocks=jsonb_set(communication_blocks,array[ch],'true'),consent=jsonb_set(consent,array[ch],'false'),revision=revision+1 where id=c and tenant_id=t;insert into public.client_events(tenant_id,client_id,kind,detail) values(t,c,'consent',jsonb_build_object('channel',ch,'enabled',false,'source','provider_opt_out'));end if;end if;
 end loop;
 end loop;end loop;
 else
 if upper(trim(data->>'message'))='SAIR' then select client_id into c from public.client_keys where tenant_id=t and kind='phone' and value=data->>'from';
 if c is not null then perform set_config('loma.consent_override','on',true);update public.clients set communication_blocks=jsonb_set(communication_blocks,array[ch],'true'),consent=jsonb_set(consent,array[ch],'false'),revision=revision+1 where id=c and tenant_id=t;insert into public.client_events(tenant_id,client_id,kind,detail) values(t,c,'consent',jsonb_build_object('channel',ch,'enabled',false,'source','provider_opt_out'));end if;
 else
 select * into j from public.message_jobs where tenant_id=t and channel=ch and provider_id=data->>'id' for update;state:=data->>'status';
 if j.id is not null and state in ('delivered','failed') and j.status<>state then update public.message_jobs set status=state where id=j.id;insert into public.message_events(tenant_id,message_id,state,detail) values(t,j.id,state,'{"providerCallback":true}');end if;
 end if;end if;return true;
exception when invalid_text_representation then return false;end;$$;
create function public.provider_challenge(t uuid,token text,challenge text) returns text language plpgsql security definer set search_path='' as $$declare cfg jsonb;begin
 if length(challenge)>200 or length(token)>200 then return null;end if;
 select extensions.pgp_sym_decrypt(cipher,(select k.secret from communication_private.key k where id))::jsonb into cfg from communication_private.integrations where tenant_id=t and channel='whatsapp';
 if length(cfg->>'verifyToken')>=16 and cfg->>'verifyToken'=token then return challenge;end if;return null;
end;$$;
revoke all on function public.provider_callback(uuid,text,text,text),public.provider_challenge(uuid,text,text) from public;
grant execute on function public.provider_callback(uuid,text,text,text),public.provider_challenge(uuid,text,text) to anon,authenticated;
