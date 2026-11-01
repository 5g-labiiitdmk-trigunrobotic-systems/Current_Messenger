-- Issue 2, step 1 of 2: narrow lookup functions for the `users` table.
--
-- Today every row of public.users (including email and push token) is
-- readable by anyone holding the public app key, because the app needed
-- exact-username lookup, signup checks and contact search. These functions
-- do those jobs and return ONLY what each job needs, so the app can stop
-- reading the table directly (build 8). This migration only ADDS functions:
-- nothing existing changes, so the live app is unaffected.
--
-- Step 2 (supabase/pending/0014_users_restrict_read.sql) closes the table.
-- Do NOT run it until old app builds are gone.

-- Login by username: the email for exactly this username (lowercase match).
-- Needed before sign-in, so signed-out callers may use it. It never lists
-- or searches: one exact username in, one email (or null) out.
create or replace function public.login_email_for_username(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from public.users
  where username = lower(btrim(p_username))
  limit 1;
$$;

-- Is this username already used? (Signup and username change.)
create or replace function public.username_taken(p_username text, p_exclude uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where username = lower(btrim(p_username))
      and (p_exclude is null or id <> p_exclude)
  );
$$;

-- Public profile fields only: never email, phone, push token or last seen.
-- Contact search: signed-in users only, at least 2 characters, 20 results,
-- never the caller themselves. Plain substring match (no wildcard tricks).
create or replace function public.search_users(p_query text)
returns table (id uuid, username text, display_name text, avatar_hue smallint, avatar_url text, bio text, status_visibility text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.username, u.display_name, u.avatar_hue, u.avatar_url, u.bio, u.status_visibility, u.created_at
  from public.users u
  where auth.uid() is not null
    and char_length(btrim(p_query)) >= 2
    and u.id <> auth.uid()
    and position(lower(btrim(p_query)) in u.username) > 0
  order by u.username
  limit 20;
$$;

-- Profiles for specific ids (call log entries, blocked list). Up to 50 ids.
create or replace function public.get_profiles(p_ids uuid[])
returns table (id uuid, username text, display_name text, avatar_hue smallint, avatar_url text, bio text, status_visibility text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.username, u.display_name, u.avatar_hue, u.avatar_url, u.bio, u.status_visibility, u.created_at
  from public.users u
  where auth.uid() is not null
    and u.id = any (p_ids[1:50]);
$$;

revoke all on function public.login_email_for_username(text) from public;
revoke all on function public.username_taken(text, uuid) from public;
revoke all on function public.search_users(text) from public;
revoke all on function public.get_profiles(uuid[]) from public;
grant execute on function public.login_email_for_username(text) to anon, authenticated;
grant execute on function public.username_taken(text, uuid) to anon, authenticated;
grant execute on function public.search_users(text) to authenticated;
grant execute on function public.get_profiles(uuid[]) to authenticated;
