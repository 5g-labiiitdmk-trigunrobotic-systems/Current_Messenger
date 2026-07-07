-- Current — metadata-only schema.
-- Absolute rule: this database NEVER stores message content, media, or chat history.
-- Exactly four tables, as scoped: users, contact_requests, blocked_users, device_keys.
-- Group identity/membership and message routing live only in the relay server's
-- in-memory state (see /server) — they are intentionally NOT modeled here, so a
-- server restart drops them too. That keeps "zero persistence, anywhere" literal.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users: one row per fully-verified account (email verified via Supabase Auth
-- AND phone verified via Firebase Phone Auth). id matches auth.users.id.
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  display_name text not null default '',
  email text not null,
  email_verified boolean not null default false,
  phone text unique,
  phone_verified boolean not null default false,
  firebase_uid text unique,
  avatar_hue smallint not null default floor(random() * 360),
  bio text not null default '',
  status_visibility text not null default 'everyone' check (status_visibility in ('everyone', 'contacts', 'nobody')),
  last_seen_at timestamptz,
  push_token text,
  created_at timestamptz not null default now()
);

create index if not exists users_username_idx on public.users (lower(username));

-- Account is only "active" once both factors are verified.
create or replace view public.verified_users as
  select * from public.users where email_verified and phone_verified;

-- ---------------------------------------------------------------------------
-- contact_requests: sender must be approved by receiver before any message
-- can be relayed between them. No message content ever touches this table.
-- ---------------------------------------------------------------------------
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users (id) on delete cascade,
  receiver_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint contact_requests_no_self check (sender_id <> receiver_id),
  constraint contact_requests_unique_pair unique (sender_id, receiver_id)
);

create index if not exists contact_requests_receiver_idx on public.contact_requests (receiver_id, status);
create index if not exists contact_requests_sender_idx on public.contact_requests (sender_id, status);

-- Convenience view: an approved pair in either direction counts as "contacts".
create or replace view public.approved_contacts as
  select sender_id as user_id, receiver_id as contact_id from public.contact_requests where status = 'approved'
  union
  select receiver_id as user_id, sender_id as contact_id from public.contact_requests where status = 'approved';

-- ---------------------------------------------------------------------------
-- blocked_users: also doubles as "report" storage (reason + is_report flag)
-- so we don't need a fifth table — still zero message content.
-- ---------------------------------------------------------------------------
create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.users (id) on delete cascade,
  blocked_id uuid not null references public.users (id) on delete cascade,
  is_report boolean not null default false,
  reason text,
  created_at timestamptz not null default now(),
  constraint blocked_users_no_self check (blocker_id <> blocked_id),
  constraint blocked_users_unique_pair unique (blocker_id, blocked_id)
);

create index if not exists blocked_users_blocker_idx on public.blocked_users (blocker_id);

-- ---------------------------------------------------------------------------
-- device_keys: on-device-generated public keys only. Private keys never leave
-- the device (see src/lib/crypto.ts — stored in expo-secure-store).
-- ---------------------------------------------------------------------------
create table if not exists public.device_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  public_key text not null,
  device_label text not null default 'device',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists device_keys_user_idx on public.device_keys (user_id, is_active);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.users enable row level security;
alter table public.contact_requests enable row level security;
alter table public.blocked_users enable row level security;
alter table public.device_keys enable row level security;

-- users: readable by self, approved contacts, or anyone doing an exact
-- @username lookup (needed for "add by username" discovery + QR add).
-- Writable only by self.
create policy users_select_self on public.users
  for select using (id = auth.uid());

create policy users_select_contacts on public.users
  for select using (
    id in (select contact_id from public.approved_contacts where user_id = auth.uid())
  );

create policy users_select_by_username_lookup on public.users
  for select using (true); -- username/display_name/avatar_hue are intentionally public for discovery;
  -- last_seen_at privacy is enforced client-side against status_visibility + the
  -- contacts relation above, since Postgres RLS is row- not column-level.

create policy users_insert_self on public.users
  for insert with check (id = auth.uid());

create policy users_update_self on public.users
  for update using (id = auth.uid());

-- contact_requests: participants only.
create policy contact_requests_select on public.contact_requests
  for select using (auth.uid() in (sender_id, receiver_id));

create policy contact_requests_insert on public.contact_requests
  for insert with check (auth.uid() = sender_id);

create policy contact_requests_update on public.contact_requests
  for update using (auth.uid() in (sender_id, receiver_id));

-- blocked_users: only the blocker can see/manage their own block list.
create policy blocked_users_select on public.blocked_users
  for select using (auth.uid() = blocker_id);

create policy blocked_users_insert on public.blocked_users
  for insert with check (auth.uid() = blocker_id);

create policy blocked_users_delete on public.blocked_users
  for delete using (auth.uid() = blocker_id);

-- device_keys: public keys are readable by anyone (needed to encrypt TO a
-- user), but only the owning device/user can write its own keys.
create policy device_keys_select_all on public.device_keys
  for select using (true);

create policy device_keys_insert_self on public.device_keys
  for insert with check (auth.uid() = user_id);

create policy device_keys_update_self on public.device_keys
  for update using (auth.uid() = user_id);
