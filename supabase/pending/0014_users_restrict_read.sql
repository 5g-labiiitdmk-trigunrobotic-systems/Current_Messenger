-- Issue 2, step 2 of 2: stop letting everyone read public.users.
--
-- DO NOT RUN THIS until app build 8 (which uses the functions from 0013
-- instead of reading the table) is what nearly everyone has. Builds before 8
-- read this table directly for login-by-username, the signup username check,
-- contact search and call-log names, and those stop working the moment this
-- runs. Email login, messaging and calls keep working.
--
-- After it runs a user can read only: their own row, their approved contacts,
-- and the people on a contact request with them (so a pending request still
-- shows who it is from). Everything else goes through the functions in 0013.

drop policy if exists users_select_by_username_lookup on public.users;

create policy users_select_request_parties on public.users
  for select using (
    id in (
      select sender_id from public.contact_requests where receiver_id = auth.uid()
      union
      select receiver_id from public.contact_requests where sender_id = auth.uid()
    )
  );
