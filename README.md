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
- **`server/`** — the WebSocket relay: in-memory only, zero message persistence.
- **`supabase/migrations/`** — the metadata schema: exactly four tables
  (`users`, `contact_requests`, `blocked_users`, `device_keys`). No message
  content ever touches Postgres.
- **`docs/SETUP.md`** — credential setup (Supabase, Firebase Phone Auth,
  relay deployment) — **start here** to actually run this.
- **`project/`, `chats/`** — the original Claude Design handoff bundle
  (design source of truth for the visual language).

## Architecture at a glance

- **Auth**: dual-mandatory — Supabase email OTP *and* Firebase phone OTP.
  Neither alone creates a usable account (`app/app/(auth)/`).
- **Messaging**: E2E-encrypted (NaCl box / libsodium-equivalent primitives,
  `app/src/lib/crypto.ts`) over a raw WebSocket relay (`server/src/index.ts`).
  No forward secrecy/ratcheting in this pass — simple per-message encryption.
- **Contacts**: request/approve flow gates all message routing, enforced
  server-side (`server/src/supabaseAdmin.ts`).
- **Groups**: live-only, held in the relay's process memory
  (`server/src/state.ts`) — never in Postgres, never on disk.
- **Calls**: real ring/accept/decline signaling over the relay; no WebRTC
  audio/video transport (that's a separate large subsystem, not built).
- **Long-tail features** (AR filters, mini-games, voice changer, doodle,
  co-watching, business profiles, bots, widget presence, topics): UI shells
  only, reachable from Profile → Lab (`app/app/lab/`).

See `docs/SETUP.md` for exactly what to configure before any of this talks to
real infrastructure — the code is complete but the credentials are yours to
provide.
