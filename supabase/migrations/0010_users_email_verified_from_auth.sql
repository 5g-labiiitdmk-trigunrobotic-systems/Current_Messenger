-- Issue 8 (email part): users can no longer claim their own email is verified.
--
-- Before: the app wrote `email_verified: true` into public.users itself after
-- checking the session, and the RLS rules (insert/update own row) accepted any
-- value, so anyone could create or edit their profile row with
-- email_verified = true without ever confirming an email address.
--
-- After: whatever the client sends, a trigger sets email_verified from the real
-- source of truth, auth.users.email_confirmed_at. The live Android app keeps
-- working unchanged: after a genuine confirmation it sends true and true is
-- what is stored; if the email is not confirmed, the value is forced to false.
--
-- phone_verified is deliberately NOT touched here (phone verification is not
-- part of the live sign-up flow).

create or replace function public.users_enforce_email_verified()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  new.email_verified := coalesce(
    (select u.email_confirmed_at is not null from auth.users u where u.id = new.id),
    false
  );
  return new;
end;
$$;

drop trigger if exists users_enforce_email_verified on public.users;
create trigger users_enforce_email_verified
  before insert or update on public.users
  for each row execute function public.users_enforce_email_verified();

-- Existing rows are left as they are. To see anyone who was marked verified
-- without a confirmed email (review by hand before changing anything):
--   select p.id, p.username, p.email, p.created_at
--   from public.users p
--   join auth.users a on a.id = p.id
--   where p.email_verified and a.email_confirmed_at is null;
