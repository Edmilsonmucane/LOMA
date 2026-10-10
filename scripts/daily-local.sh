#!/bin/sh
# Equivalent to the owner-only pg_cron job; retry is safe and no financial policy lives here.
while true; do
 psql -X -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
DO $$ begin
 if to_regprocedure('financial_private.daily()') is not null then
  perform financial_private.daily();
 end if;
end $$;
SQL
 sleep 30
done
