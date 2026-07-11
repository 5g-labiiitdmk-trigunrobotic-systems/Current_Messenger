-- TOTP-based 2FA was removed — phone verification (Firebase Phone Auth) is
-- the sole second factor again. This drops the backup-codes table added for
-- TOTP (migration 0004_totp_backup_codes.sql, now deleted from the repo).
-- Safe to run whether or not that migration was ever applied — `if exists`
-- makes this a no-op on a database that never had the table.
--
-- Nothing else needs cleanup: TOTP itself lived entirely in Supabase Auth's
-- own internal schema (auth.mfa_factors etc.), never in a table this app
-- created — if you'd like those enrolled factors gone too, that's a
-- separate step in the Supabase dashboard (Authentication > Users > each
-- user > remove MFA factors), not a SQL migration.

drop table if exists public.totp_backup_codes;
