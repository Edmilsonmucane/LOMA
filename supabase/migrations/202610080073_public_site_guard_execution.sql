-- Trigger validation runs with its owner's private-schema access, regardless of the category updated.
-- Table RLS still decides whether the session may write configuration.
alter function portal_private.site_guard() security definer;
revoke all on function portal_private.site_guard() from public,anon,authenticated;
