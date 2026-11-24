-- ============================================================================
-- OFKOSSEC — Migration 010: drop the unused INSERT grant on profiles.
--
-- public.profiles rows are created by the on_auth_user_created trigger, which
-- runs as the table owner, so the browser never needs to insert here. Leaving
-- the grant in place would let a signed-in student insert a row for their own
-- id carrying role = 'admin' if their profile row were ever missing — the same
-- escalation migration 009 closed off for UPDATE.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

revoke insert on public.profiles from authenticated;
