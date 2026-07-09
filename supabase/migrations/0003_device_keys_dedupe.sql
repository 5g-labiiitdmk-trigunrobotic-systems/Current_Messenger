-- device_keys was getting a new row inserted on every app launch/foreground
-- (auth state change), not just on an actual new device — the client always
-- returns the same public key for a given device, but publishPublicKey()
-- inserted unconditionally, so "Active devices" on the Privacy Dashboard was
-- really counting sessions, not devices. Fixed client-side (keystore.ts now
-- skips the insert if this exact key is already on record); this migration
-- (1) removes the duplicates that already accumulated, keeping the newest
-- row per (user_id, public_key), and (2) adds a unique constraint so this
-- can't silently recur even if a client-side check races or gets skipped.

delete from public.device_keys a using public.device_keys b
where a.user_id = b.user_id
  and a.public_key = b.public_key
  and a.created_at < b.created_at;

alter table public.device_keys
  add constraint device_keys_user_key_unique unique (user_id, public_key);
