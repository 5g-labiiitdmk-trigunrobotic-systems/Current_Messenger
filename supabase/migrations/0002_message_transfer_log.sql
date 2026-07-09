-- message_transfer_log: METADATA ONLY, one row per successfully delivered
-- message (per recipient for group fan-out). Extends the original four-table
-- scope by explicit product decision.
--
-- Zero-persistence clarification: message BODIES still never touch Postgres —
-- the relay holds ciphertext in memory only and this table records nothing
-- but who -> who, when, and the ciphertext envelope's byte size. There is no
-- content column on purpose; do not add one.

create table if not exists public.message_transfer_log (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users (id) on delete cascade,
  recipient_id uuid not null references public.users (id) on delete cascade,
  byte_size integer not null check (byte_size >= 0),
  created_at timestamptz not null default now()
);

create index if not exists message_transfer_log_sender_idx on public.message_transfer_log (sender_id, created_at desc);
create index if not exists message_transfer_log_recipient_idx on public.message_transfer_log (recipient_id, created_at desc);

alter table public.message_transfer_log enable row level security;

-- Written exclusively by the relay server's service-role client (which
-- bypasses RLS). Clients may read only rows they participated in; no client
-- may ever insert/update/delete.
create policy message_transfer_log_select_own on public.message_transfer_log
  for select using (auth.uid() in (sender_id, recipient_id));
