-- Needed for "remove contact" (unfriend) — contactStore.ts's removeContact()
-- deletes the contact_requests row(s) between the two users so they go back
-- to being strangers (a fresh contact request + approval is required to
-- message again, same as areApprovedContacts() already enforces server-side
-- for both message:send and session:request). Without this policy, RLS
-- silently denies the delete (0 rows affected, no error) since only select/
-- insert/update policies existed on this table.
create policy contact_requests_delete on public.contact_requests
  for delete using (auth.uid() in (sender_id, receiver_id));
