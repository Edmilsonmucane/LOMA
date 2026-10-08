-- Tenant credentials and callback deduplication are private business data too.
-- No direct user policies/grants: authorised definer helpers and migration owner only.
alter table communication_private.integrations enable row level security;
alter table communication_private.callback_receipts enable row level security;
