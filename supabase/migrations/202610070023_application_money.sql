-- Lossless text travels through JSON/PostgREST; native generated bigint columns validate/store cents.
alter table public.applications add column principal_cents bigint generated always as (principal::bigint) stored;
alter table public.contracts add column principal_cents bigint generated always as ((snapshot->>'principal')::bigint) stored;
