# Current: Messenger — Work Log

A running record of the pre-launch bug hunt and fixes. New entries are added at the
**bottom** after every piece of work (what changed, which commits, how it was tested,
what is still open). Times are IST.

**Working rules agreed with Krishna**
- Report first; fix only when told "fix <number>". One issue at a time, report after each.
- Show each change before moving on. Confirm before generating files.
- Demo-account passwords are typed by Krishna directly into App Store Connect, never shared.
- DB / relay fixes need no app release. App fixes need one new build (**build 8**) for both stores.

---

## 1. Where things stand (updated 2026-10-28)

| Area | State |
|---|---|
| Google Play | Live in India, v1.0.1 (does **not** have the app fixes below) |
| App Store | Build 7 in TestFlight, **not submitted**. Wait for build 8. |
| Relay (Render) | Live: `https://current-messenger-relay.onrender.com`. Has fix 3. |
| `main` branch | Fixes 3, 4, 5, 23/10, 11 merged. Nothing builds automatically. |
| Build 8 | Not made yet. Should include 4, 5, 11, 23/10, 22 and the rest of the app batch. |

---

## 2. Issue register

Severity: C = critical, H = high, M = medium, L = low. Where = DB / relay / app / hosting.

### Fixed

| # | Issue | Where | Fixed in | Status |
|---|---|---|---|---|
| 3 | A single `null` message (even before login), or `call:signal` / `group:create` with missing fields, crashed the whole relay | relay | `e9776d9` | **Live on Render** |
| 4 | "[unable to decrypt]": decrypt assumed sender's newest key, encrypt assumed one recipient device, key-creation race | app | `4249fff` | In `main`, needs build 8 |
| 5 | Chats, contacts, calls, groups leaked between accounts on the same phone; history never reloaded | app | `e0beba6` | In `main`, needs build 8 |
| 22 | Sign-out did not reset other stores or clear the push token (fixed together with 5) | app | `e0beba6` | In `main`, needs build 8 |
| 10 | Duplicate sockets / stale `onclose` in the relay client | app | `01e27fd` | In `main`, needs build 8 |
| 23 | No dead-connection detection, no foreground reconnect, stale token on reconnect | app | `01e27fd` | In `main`, needs build 8 |
| 11 | Messages stuck on "sending" forever when the relay is unreachable or the answer never arrives | app | `6b99d2d` | In `main`, needs build 8 |
| 13 | Relay accepted frames up to 100 MiB and had no rate limits | relay | branch `fix/issue-13-limits` | Tested, waiting for merge (deploys on merge) |

### Open (original 20)

| # | Issue | Sev | Where |
|---|---|---|---|
| 1 | `contact_requests` RLS lets a user approve their own request | C | DB |
| 2 | `users` table readable by everyone (login-by-username, signup check, contact search, QR depend on it) | C | DB + app |
| 6 | Filter injection in `areApprovedContacts` | H | relay |
| 7 | Edit / delete / poll vote not checked against the original sender | H | app |
| 8 | Users can set their own `email_verified` / `phone_verified` | H | DB |
| 9 | Public `/ice-servers` exposes TURN credentials | H | relay |
| 12 | Presence visibility setting is cosmetic | H | app + relay |
| 14 | Contact cache stale for 30s; `isBlocked` fails open | M | relay |
| 15 | A group id can be overwritten | M | relay |
| 16 | Groups lost when the relay restarts | M | relay |
| 17 | Transfer log kept forever | M | DB |
| 18 | Docs and encryption PDF say "libsodium"; the app uses TweetNaCl | M | docs |
| 19 | Decline / hangup clears another caller's ring | L | relay |
| 20 | `contact:request_sent` pushes without a real request | L | relay |

### Open (found in the broader audit)

| # | Issue | Sev | Where |
|---|---|---|---|
| 21 | Audio recording mode never switched off after a voice note | H | app |
| 24 | A failed contact refresh empties the lists | H | app |
| 25 | Setup failure silently replaces the chosen username | H | app |
| 26 | Local database deleted on any open failure | H | app |
| 27 | App lock not tied to backgrounding; starts unlocked until settings load | H | app |
| 28 | Incoming messages not de-duplicated | M | app |
| 29 | Message-ping notification taps do not open the chat | M | app |
| 30 | A declined contact request can never be re-sent (error swallowed) | M | app |
| 31 | Leaving a group only sends the leave message; group stays on screen | M | app |
| 32 | Group invite / forward lists cut at 6 people silently | M | app |
| 33 | Denied photo / camera permission gives no message | M | app |
| 34 | Reset-password screen spins forever without a valid session | M | app |
| 35 | Push token printed to the log | L | app |
| 36 | All chat history loaded at once at start-up | M | app |
| 37 | Group call silently capped | M | app |
| 38 | Test values left in phone-auth code | L | app |
| 39 | Over-broad Android permissions; `ITSAppUsesNonExemptEncryption` not set | L | app config |
| 40 | No calls to a closed app on iPhone (no CallKit / push-to-talk) | — | product limit |

### Suggested order
1. **Relay, no app release:** 6, 9, 14, 15.
2. **Database:** 1, 8, then 2 last (it breaks login-by-username until replaced, and the live Android app still reads `users` directly).
3. **App (build 8):** 26, 21, 24, 25, 27, and the medium items.

---

## 3. Before submitting iOS (Krishna's side, not code)

- Set price to Free; upload iPad screenshots; confirm age rating 16+.
- Encryption PDF: correct "libsodium" to TweetNaCl, fill the bracketed fields, sign.
- Add `ITSAppUsesNonExemptEncryption` in the app config (issue 39).
- Create the demo account, connect it to your own account, keep it online. Type its password into App Store Connect yourself.
- Do not promise calls to a closed app in the App Store text (issue 40).
- Real-phone checks: see section 5. Then Publish on App Privacy, Save, Add for Review.

---

## 4. Log

### 2026-10-27 to 28: Bug hunt (report only, no code changed)
- Read the app, relay and migrations; ran the relay locally with scripted clients against a fake Supabase.
- Confirmed by running: a `null` message crashes the relay (before and after login); `call:signal` and `group:create` with missing fields crash it; two sockets stay open for one user on reconnect; the relay accepts a 30 MB message. Session gate and normal delivery behave correctly.
- Result: 40 numbered issues (register above).

### 2026-10-28 01:30: Issue 3 — relay crash on malformed messages
- **Files:** `server/src/index.ts`.
- **Change:** shape-check every client event before any handler runs; catch handler errors per message; error listener on every socket; log (not die) on uncaught exceptions and unhandled rejections.
- **Tested:** typecheck clean; 10 malformed messages leave the relay running; 25/25 checks with real-shaped traffic of every event type; payload forwarded unchanged.
- **Shipped:** commit `e9776d9`, pushed to `main`, Render deploy confirmed "live" (01:43). `/health` returned `{"ok":true,"online":2,...}`.

### 2026-10-28 01:55: Diagnosis — "unable to decrypt" seen during the live test
- Not caused by the relay change (payload verified byte-for-byte). This is issue 4.

### 2026-10-28 02:01: Issue 4 — "[unable to decrypt]"
- **Root cause:** sender encrypts to the recipient's newest key; receiver assumed the sender's newest key. Any account with more than one `device_keys` row (second phone, reinstall) breaks one or both guesses. Also a race: 12 concurrent first calls created 12 keypairs.
- **Files:** `app/src/lib/crypto.ts`, `keystore.ts`, `app/src/state/chatStore.ts`, `authStore.ts`, `app/src/types/relay.ts`, `server/src/protocol.ts` (types only).
- **Change:** receiver tries all the sender's active keys (the one named in the message first); sender encrypts to up to 4 recipient keys (extra copies only for messages up to 64 KB); one in-flight promise for key creation; key publishing retries once and reports errors. Main ciphertext stays in the old format, so old apps keep working.
- **Tested:** 28/28 on the real code with stand-ins; the race test fails on the original code (12 distinct keypairs). Typecheck clean. Relay passes the new payload shape through unchanged.
- **Limits:** photos / video / voice over 64 KB only reach the recipient's newest device; messages already sent unreadable stay unreadable; the fix reaches users only with build 8.
- **Shipped:** `4249fff`.

### 2026-10-28 02:10: Issue 5 (+22) — chats leaking between accounts
- **Root cause:** stores kept the previous account's data after sign-out; the "load history once" flags never reset, so the next account's history never loaded.
- **Files:** `chatStore`, `contactStore`, `groupStore`, `presenceStore`, `chatSessionStore`, `callStore`, `authStore`, `app/src/lib/push.ts`.
- **Change:** every store clears and re-arms its loading on sign-out or account change (token refresh for the same account is ignored); slow loads for the old account are discarded; sign-out clears the account's push token while the session is valid; the token-rotation listener follows the current account.
- **Tested:** old code fails 13 checks of the A-signs-out / B-signs-in scenario, new code passes 20/20 (including the slow-load race); a rotated token was written to the wrong account before and to the right one now. Typecheck clean.
- **Limits:** if the app is force-closed while signed in, the push token is not cleared (needs a server-side rule later).
- **Shipped:** `e0beba6`, merged to `main` at 02:17.

### 2026-10-28 02:24: Issues 23 + 10 — relay client reconnect
- **Root cause:** `connect()` ran on every auth event and never closed the old socket; no dead-connection detection; nothing on foreground; reconnect reused the 1-hour token; backoff reset on socket open; `send()` failed silently.
- **File:** `app/src/lib/relayClient.ts` (plus a token provider and user id in `authStore.ts`).
- **Change:** one socket per account; late events from replaced sockets ignored; 75 s watchdog; foreground ping-probe or immediate reconnect; 12 s connect timeout; fresh token on every (re)connect; backoff resets only after login succeeds; `send()` returns true/false.
- **Tested:** old client fails 10 scenarios, new client passes all; end-to-end against the real relay including killing and restarting it; typecheck clean.
- **Limits:** no network-change listener (NetInfo not installed), so a Wi-Fi to mobile switch can take up to about 75 s to notice.
- **Shipped:** `01e27fd`, merged to `main`.

### 2026-10-28 02:25: Work log created
- This file. Appended to after every fix from here on.

### 2026-10-28: Issue 11 — messages stuck on "sending"
- **Root cause:** a message stays "sending" until the relay answers. Nothing handled the cases where no answer ever comes: send attempted before login finished (the relay rejected it), connection dropped right after the send, relay restarted, app closed mid-send. The relay has no queue, so such messages were lost and the answer never came.
- **Files:** `app/src/state/chatStore.ts`, `app/src/lib/relayClient.ts`.
- **Change:** `send()` now refuses (returns false) unless the connection is logged in, and the chat code marks the message failed at once (`not_connected`). Every outgoing message is tracked: failed if the connection is lost (`connection_lost`) or no answer within 30 s (`timeout`). Messages found as "sending" in local storage at start-up become failed (`interrupted`). A late real "sent" answer still upgrades a failed message to sent.
- **Tested:** 14 checks on the real store code: old code fails 7, new code passes all. Relay client suite passes (including send() false when not connected / true when connected). Typecheck clean.
- **Limits:** a failed message shows only a red "Failed" with no retry button and no reason (candidate follow-up, issue 41). Reactions, deletes and poll votes are still fire-and-forget. Possible duplicate: if the 30 s timeout fires and the user re-sends while the first one actually arrived late, the recipient sees two (issue 28 covers de-duplication).

### 2026-10-28: Issue 13 — relay size and rate limits
- **Root cause:** the relay held every incoming frame in memory with the library default cap of 100 MiB and no rate limits. A few oversized frames (even from a logged-in or not-logged-in client) could exhaust the 512 MB Render instance and knock everyone offline.
- **File:** `server/src/index.ts` (plus the new `rate_limited` failure reason added to both `protocol.ts` files; old apps just show Failed).
- **Change:** frames over 64 MiB are refused and that socket is closed; a socket that has not logged in may send only 8 KB; per connection: 30 messages per 10 s, 150 MB of messages per 60 s, 300 other events per 10 s (excess is rejected with an error / `rate_limited`; 3x the event limit closes the connection). Pings and pongs are never limited.
- **Tested (local relay, mock Supabase):** normal message delivered; a 27 MB message (largest single-chat video) delivered; 70 MB frame closes only that socket and the relay stays healthy; 20 KB pre-login frame closed; of 40 rapid messages exactly 30 go through and 10 get `rate_limited`; 500 pings all answered; 1000-event flood closes the connection; earlier regression and malformed-event suites still pass. Typecheck clean (relay and app).
- **Limit to know:** in a group, a video is encrypted once per member inside one frame, so a maximum-size video (about 27 MB per member) now only fits in groups with up to two other members. Smaller or compressed videos are unaffected. Before this, bigger groups worked only because the cap was 100 MiB. Follow-up for the app batch: cap or compress group videos by member count.
- **Shipped:** branch only; deploys to Render when merged to `main`.

---

## 5. Real-phone checks before releasing build 8

1. Sign up, log out, log back in by username and by email.
2. Sign in as account A, send a message, sign out, sign in as account B: B must show an empty chat list; signing back into A must show A's message.
3. Add a contact on a second phone, accept it, send a text and a photo both ways. Each arrives once and no "[unable to decrypt]".
4. Turn on airplane mode for 2 minutes, then off: the app reconnects by itself and messages flow.
5. Leave the app in the background for 5 minutes, return: it reconnects within a few seconds.
6. Voice call, video call, minimize and return, end the call.
7. Record a voice note, then place a voice call: the sound is normal.
8. Create a group of three, send a message, leave it.
9. Reset-password link on a fresh install.
10. Airplane mode on, send a message: it shows Failed within a second, not "sending".
