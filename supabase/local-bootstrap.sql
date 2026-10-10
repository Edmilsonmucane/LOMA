\set local_password `echo "$POSTGRES_PASSWORD"`
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator noinherit login password :'local_password';
create role supabase_auth_admin noinherit login password :'local_password';
grant anon,authenticated,service_role to authenticator;
grant all on database postgres to supabase_auth_admin;
create schema auth authorization supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth,public,extensions;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema public,auth,extensions to anon,authenticated,service_role;
alter default privileges for role postgres in schema public grant all on tables to service_role;
alter default privileges for role postgres in schema public grant all on sequences to service_role;
