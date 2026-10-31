-- Issue 1: nobody may approve their own contact request.
--
-- Before this migration:
--   * INSERT only checked "you are the sender", not the status, so a user could
--     insert a row that was already 'approved' (instant "contact" of anyone).
--   * UPDATE let EITHER side change the row, so the sender could flip their own
--     pending request to 'approved'; it also allowed rewriting sender_id /
--     receiver_id.
-- "Approved" is what the relay trusts to allow messages, calls and groups
-- between two people, so this was a way to message anyone without consent.
--
-- After:
--   * a new request must be 'pending' with no response time;
--   * only the RECEIVER may answer, and only while the request is still pending;
--   * a trigger freezes sender_id, receiver_id and created_at on every update.
-- The app already works this way (sender inserts 'pending', receiver updates),
-- so no app release is needed. The relay (service role) never writes this table.

drop policy if exists contact_requests_insert on public.contact_requests;
create policy contact_requests_insert on public.contact_requests
  for insert with check (
    auth.uid() = sender_id
    and status = 'pending'
    and responded_at is null
  );

drop policy if exists contact_requests_update on public.contact_requests;
create policy contact_requests_update on public.contact_requests
  for update
  using (auth.uid() = receiver_id and status = 'pending')
  with check (auth.uid() = receiver_id);

create or replace function public.contact_requests_freeze_parties()
returns trigger
language plpgsql
as $$
begin
  if new.sender_id is distinct from old.sender_id
     or new.receiver_id is distinct from old.receiver_id
     or new.created_at is distinct from old.created_at then
    raise exception 'contact request parties cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists contact_requests_freeze_parties on public.contact_requests;
create trigger contact_requests_freeze_parties
  before update on public.contact_requests
  for each row execute function public.contact_requests_freeze_parties();

-- Optional check for rows created through the old hole. The app always sets
-- responded_at when it answers a request, so an 'approved' row without it was
-- not made by the app. Review before deleting anything:
--   select id, sender_id, receiver_id, created_at
--   from public.contact_requests
--   where status = 'approved' and responded_at is null;
