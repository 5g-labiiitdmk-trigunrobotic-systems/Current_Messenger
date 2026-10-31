-- One push token PER DEVICE (issue 42).
--
-- Until now each account had a single `users.push_token`: whichever phone
-- registered last owned it, and a phone that signed out (or an account signed
-- in on two phones) kept getting — or stole — the notifications. This table
-- gives every device its own row. The relay (service role) sends to every
-- token of the account; the old `users.push_token` column stays in place and
-- is still honoured by the relay, so apps that predate this keep working.
--
-- A push token identifies a physical app install, so it is the primary key:
-- when someone signs in on a phone another account used before, the row simply
-- moves to the new account instead of leaving a stale copy behind.
--
-- Tokens are credentials for pushing to a device, so clients get NO direct
-- table access (row level security on, no policies). They go through the two
-- functions below, which can only ever act on the caller's own account.

create table if not exists public.device_push_tokens (
  token text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);

create index if not exists device_push_tokens_user_idx on public.device_push_tokens (user_id);

alter table public.device_push_tokens enable row level security;
-- (deliberately no policies: only the service role and the functions below)

-- Registers this device's token for the signed-in account. If the token was
-- registered to a different account (the phone changed hands / accounts), it
-- moves to the caller.
create or replace function public.register_push_token(p_token text, p_platform text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_token is null or length(p_token) < 10 or length(p_token) > 300 then
    raise exception 'invalid token';
  end if;
  insert into public.device_push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;

-- Removes this device's token, but only if it belongs to the caller.
create or replace function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from public.device_push_tokens where token = p_token and user_id = auth.uid();
end;
$$;

revoke all on function public.register_push_token(text, text) from public;
revoke all on function public.unregister_push_token(text) from public;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
