-- TOTP itself is handled entirely by Supabase Auth's native MFA
-- (auth.mfa.enroll/challenge/verify) — the secret lives in Supabase's own
-- auth schema, never in this table, never touched by this app's code.
-- Backup/recovery codes are NOT a Supabase-native concept, so they're
-- tracked here: only a one-way hash is ever stored (SHA-256), matching the
-- same never-plaintext-never-reversible rule as password storage. A code
-- is single-use — used_at is set the moment it's consumed and it can never
-- be used again.

create table if not exists public.totp_backup_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists totp_backup_codes_user_idx on public.totp_backup_codes (user_id);

alter table public.totp_backup_codes enable row level security;

-- Owner-only in every direction — nobody else may ever see or touch these,
-- not even to check whether a code exists.
create policy totp_backup_codes_owner on public.totp_backup_codes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
