-- Prevents two PENDING contact_requests rows existing for the same pair of
-- users at once, regardless of direction. Without this, User A -> User B
-- and (before either responds) User B -> User A could both be inserted as
-- separate rows — contact_requests_unique_pair only blocks an exact repeat
-- of the same (sender_id, receiver_id) direction, not the reverse one. If
-- both later got approved independently, contactStore.ts's refresh() would
-- push the same otherUser onto `approved` twice (it iterates every row,
-- not deduplicated), showing as a duplicate contact/chat entry in the UI.
--
-- This is a *safety net* for the genuinely-simultaneous case — the primary
-- fix is client-side (contactStore.ts's sendRequest now checks for and
-- resolves an existing reverse-pending request instead of inserting a new
-- one), but two devices can both pass that check before either insert
-- lands, so the database needs to be the actual backstop.
--
-- Scoped to `where status = 'pending'` specifically (not a blanket
-- either-direction unique constraint) so it doesn't touch existing,
-- already-relied-on behavior: a user can still send a fresh request after
-- an earlier one (in either direction) was declined — those old rows are
-- 'declined', not 'pending', so they don't conflict with a new one.
create unique index if not exists contact_requests_unique_pending_pair
  on public.contact_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
  where status = 'pending';
