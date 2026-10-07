-- Required on the lightweight local PostgreSQL stack; hosted Supabase already grants this.
grant usage on schema storage to anon,authenticated,service_role;
