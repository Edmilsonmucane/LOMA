insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('client-documents','client-documents',false,5242880,array['application/pdf','image/jpeg','image/png','image/webp']);
create function public.client_object_allowed(object_path text,p text,upload boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.client_documents d where d.path=object_path and public.client_allowed(d.tenant_id,d.client_id,p) and (not upload or d.status='pending'));
$$;
create policy client_files_read on storage.objects for select to authenticated using(bucket_id='client-documents' and public.client_object_allowed(name,'clients.read'));
create policy client_files_insert on storage.objects for insert to authenticated with check(bucket_id='client-documents' and public.client_object_allowed(name,'clients.manage',true));
create policy client_files_pending_delete on storage.objects for delete to authenticated using(bucket_id='client-documents' and public.client_object_allowed(name,'clients.manage',true));
create function public.reserve_client_document(t uuid,c uuid,document_data jsonb) returns public.client_documents language plpgsql security definer set search_path='' as $$
declare d public.client_documents;did uuid:=gen_random_uuid();begin
 if not public.client_allowed(t,c,'clients.manage') then raise exception 'Access denied' using errcode='42501';end if;
 if document_data->>'kind'='photo' and document_data->>'mime_type'='application/pdf' then raise exception 'Photo must be image' using errcode='23514';end if;
 insert into public.client_documents(id,tenant_id,client_id,kind,title,filename,path,mime_type,size,expires_on)
 values(did,t,c,document_data->>'kind',document_data->>'title',document_data->>'filename',t::text||'/'||c::text||'/'||did::text,document_data->>'mime_type',(document_data->>'size')::integer,nullif(document_data->>'expires_on','')::date) returning * into d;return d;
end;$$;
create function public.complete_client_document(t uuid,did uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare d public.client_documents;begin
 select * into d from public.client_documents where id=did and tenant_id=t for update;
 if d.id is null or not public.client_allowed(t,d.client_id,'clients.manage') then raise exception 'Access denied' using errcode='42501';end if;
 if d.status='ready' then return true;end if;
 if not exists(select 1 from storage.objects where bucket_id='client-documents' and name=d.path and (metadata->>'size')::bigint=d.size and metadata->>'mimetype'=d.mime_type) then raise exception 'Upload incomplete' using errcode='23514';end if;
 update public.client_documents set status='ready' where id=did;
 insert into public.client_events(tenant_id,client_id,actor_id,kind,detail) values(t,d.client_id,auth.uid(),'document',jsonb_build_object('document_id',d.id,'title',d.title));return true;
end;$$;
revoke all on function public.client_object_allowed(text,text,boolean),public.reserve_client_document(uuid,uuid,jsonb),public.complete_client_document(uuid,uuid) from public,anon;
grant execute on function public.client_object_allowed(text,text,boolean),public.reserve_client_document(uuid,uuid,jsonb),public.complete_client_document(uuid,uuid) to authenticated;
