# Current

A privacy-focused messenger where messages are never stored anywhere, ever —
not in a database, not temporarily, not encrypted-at-rest. Every message is a
live relay: if the recipient isn't online, the send hard-fails instead of
queueing. Contacts must approve each other before either side can message.

Design: iOS Liquid Glass aesthetic, ported from the `project/` Claude Design
export (`Current.dc.html`) into a real React Native app — see `project/` for
the original prototype and `chats/chat1.md` for the design brief.

## Structure

- **`app/`** — the React Native + Expo (TypeScript, Expo Router) mobile app.
- **`server/`** — the WebSocket relay: no message content is ever stored; it keeps only live connection state and group membership (names, owner, member ids).
- **`supabase/migrations/`** — the metadata schema: exactly four tables
  (`users`, `contact_requests`, `blocked_users`, `device_keys`). No message
  content ever touches Postgres.
- **`docs/SETUP.md`** — credential setup (Supabase, Firebase Phone Auth,
  relay deployment) — **start here** to actually run this.
- **`project/`, `chats/`** — the original Claude Design handoff bundle
  (design source of truth for the visual language).

## Architecture at a glance

- **Auth**: Supabase email sign-up with email confirmation
  (`app/app/(auth)/`). Phone verification (Firebase) exists in the code but is
  not part of the live sign-up flow.
- **Messaging**: E2E-encrypted with NaCl box (X25519 key agreement +
  XSalsa20-Poly1305), implemented by the TweetNaCl library
  (`app/src/lib/crypto.ts`; libsodium is not used), over a raw WebSocket relay
  (`server/src/index.ts`).
  No forward secrecy/ratcheting in this pass — simple per-message encryption.
- **Contacts**: request/approve flow gates all message routing, enforced
  server-side (`server/src/supabaseAdmin.ts`).
- **Groups**: held in the relay's memory while it runs
  (`server/src/state.ts`) and saved to Postgres as names, owner and member ids
  only (`server/src/groupStore.ts`, tables `relay_groups` and
  `relay_group_members`) so they survive a relay restart. Message content is
  never stored anywhere on the server.
- **Calls**: voice and video over WebRTC (peer to peer, with a TURN relay as
  fallback), with ring/accept/decline signaling over the relay
  (`app/src/lib/webrtc.ts`, `server/src/index.ts`).
- **Long-tail features** (AR filters, mini-games, voice changer, doodle,
  co-watching, business profiles, bots, widget presence, topics): UI shells
  only, reachable from Profile → Lab (`app/app/lab/`).

See `docs/SETUP.md` for exactly what to configure before any of this talks to
real infrastructure — the code is complete but the credentials are yours to
provide.
