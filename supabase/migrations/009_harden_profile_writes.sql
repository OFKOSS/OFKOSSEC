-- ============================================================================
-- OFKOSSEC — Migration 009: close a privilege-escalation hole on profiles.
--
-- public.is_admin() decides every officer-only action by reading
-- public.profiles.role. Migration 001 granted the `authenticated` role a
-- table-wide UPDATE on public.profiles, and the profiles_update_self policy
-- only checks that the row belongs to the caller. Together those let any
-- signed-in student run:
--
--     update public.profiles set role = 'admin' where id = auth.uid();
--
-- and hand themselves the whole Electoral Officer panel (read every ballot,
-- open/close elections, add or delete voters).
--
-- The app never edits a profile from the browser, so we drop the table-wide
-- UPDATE grant and re-grant only the harmless display columns. Officers still
-- edit voters through the SECURITY DEFINER RPCs, which run as the table owner
-- and are not affected by these grants.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

revoke update on public.profiles from authenticated;
grant update (full_name, class_name, avatar_url) on public.profiles to authenticated;
