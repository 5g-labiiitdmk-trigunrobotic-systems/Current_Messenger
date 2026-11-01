-- Issue 8 (phone part): users can no longer mark their own phone verified.
--
-- Before: the app's own sign-in could write phone_verified = true on its own
-- row (the update/insert rules only check "it is your row"), so a phone could
-- be claimed as verified without any code being sent. Nothing in the live app
-- reads the column yet, so this closes the hole before phone verification is
-- ever relied on.
--
-- After: for app users (the anon and authenticated roles) phone_verified is
-- always false on insert, never changes on update, and goes back to false if
-- the phone number itself is changed. Only the server side (the relay or the
-- SQL editor, i.e. service_role / postgres) can set it to true, which is what
-- a future verified-by-code flow would do after checking the code.

create or replace function public.users_enforce_phone_verified()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.phone_verified := false;
    else
      if new.phone is distinct from old.phone then
        new.phone_verified := false;
      else
        new.phone_verified := old.phone_verified;
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.users_enforce_phone_verified() from public, anon, authenticated;

drop trigger if exists users_enforce_phone_verified on public.users;
create trigger users_enforce_phone_verified
  before insert or update on public.users
  for each row execute function public.users_enforce_phone_verified();
