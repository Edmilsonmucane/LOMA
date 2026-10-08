create table public.portal_documents(tenant_id uuid not null,draft_id uuid not null,document_id uuid primary key,user_id uuid not null references auth.users(id),foreign key(draft_id,tenant_id) references public.portal_drafts(id,tenant_id),foreign key(document_id,tenant_id) references public.client_documents(id,tenant_id));
alter table public.portal_documents enable row level security;
grant select on public.portal_documents to authenticated;
create policy portal_documents_read on public.portal_documents for select to authenticated using(exists(select 1 from public.portal_drafts d where d.id=draft_id and d.tenant_id=portal_documents.tenant_id and ((d.user_id=auth.uid() and public.customer_owns(d.tenant_id,d.client_id)) or (d.application_id is not null and public.has_permission(d.tenant_id,'applications.read') and public.branch_allowed(d.tenant_id,d.branch_id)))));
do $$declare body text;begin
 body:=pg_get_functiondef('public.customer_reserve_document(uuid,uuid,jsonb)'::regprocedure);
 body:=replace(body,'return jsonb_build_object(''id'',doc.id,''path'',doc.path);','insert into public.portal_documents(tenant_id,draft_id,document_id,user_id) values(t,d_id,doc.id,auth.uid());return jsonb_build_object(''id'',doc.id,''path'',doc.path);');execute body;
 body:=pg_get_functiondef('public.customer_object_allowed(text,boolean)'::regprocedure);
 body:=replace(body,'cd.status=''pending'' and exists(select 1 from public.portal_drafts d where d.tenant_id=cd.tenant_id and d.client_id=cd.client_id and d.user_id=auth.uid() and d.application_id is null)','cd.status=''pending'' and exists(select 1 from public.portal_documents pd join public.portal_drafts d on d.id=pd.draft_id and d.tenant_id=pd.tenant_id where pd.document_id=cd.id and pd.tenant_id=cd.tenant_id and pd.user_id=auth.uid() and d.user_id=auth.uid() and d.application_id is null)');execute body;
end;$$;
revoke all on all functions in schema portal_private from public,anon,authenticated;
notify pgrst,'reload schema';
