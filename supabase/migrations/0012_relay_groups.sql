-- Issue 16: groups were lost whenever the relay restarted (they lived only in
-- the relay's memory), so every deploy or Render restart silently emptied all
-- group chats until someone re-created them.
--
-- These two tables hold ONLY who is in which group and its name/owner, the
-- same facts the relay already keeps in memory. No message content is ever
-- stored here. Row level security is on with no policies, so the app (anon /
-- signed-in keys) can neither read nor write them; only the relay, which uses
-- the service-role key, can.

create table if not exists public.relay_groups (
  id text primary key check (char_length(id) between 1 and 128),
  name text not null default '' check (char_length(name) <= 200),
  -- No foreign key on purpose: when the owner deletes their account the group
  -- must live on for the remaining members (a cascade would delete it).
  owner_id uuid not null,
  is_broadcast boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.relay_group_members (
  group_id text not null references public.relay_groups (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  is_admin boolean not null default false,
  primary key (group_id, user_id)
);

create index if not exists relay_group_members_user_idx
  on public.relay_group_members (user_id);

alter table public.relay_groups enable row level security;
alter table public.relay_group_members enable row level security;
-- (no policies on purpose: service role only)
revoke all on public.relay_groups, public.relay_group_members from anon, authenticated;
