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
| Relay (Render) | Live: `https://current-messenger-relay.onrender.com`. Has fix 3; fixes 13, 6, 14, 15, 19, 20, 43 deploying. |
| `main` branch | Fixes 3, 4, 5, 23/10, 11, 13, 6, 14, 15, 19, 20, 43 merged (42 is on its own branch, not merged). Nothing builds automatically. |
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
| 13 | Relay accepted frames up to 100 MiB and had no rate limits | relay | `7d2b8bd` | Merged to `main` 02:51; Render auto-deploys |
| 6 | Filter injection in `areApprovedContacts`: a crafted `to` value bypassed the contact check | relay | `5c989d9` | Merged to `main` 03:37 with 14; Render auto-deploys |
| 15 | `group:create` with an existing group id silently replaced that group (members dropped, creator became owner) | relay | branch `fix/issue-15-group-overwrite` | Merged to `main` 04:41; Render auto-deploys |
| 14 | Contact cache kept "not a contact" for 30 s after approval or a database hiccup; `isBlocked` failed open | relay | branch `fix/issue-14-contact-cache` | Merged to `main` 03:37 (includes 6); Render auto-deploys |
| 26 | Local chat database deleted on any open error (disk full, locked, I/O), losing all history | app | branch `fix/issue-26-db-open-wipe` | In `main`, needs build 8 |
| 21 | Audio session left in recording mode after a voice note (earpiece / low volume afterwards) | app | branch `fix/issue-21-audio-mode` | In `main`, needs build 8 |
| 42 | Notifications went to a phone the account had left (one push token per account) | app + DB + relay | branch `fix/issue-42-device-push-tokens` | In `main`; run migration 0008 in Supabase; needs build 8 |
| 1 | `contact_requests` RLS: a user could insert an already-approved request, or approve their own pending request, or rewrite its parties | DB | branch `fix/issue-1-contact-rls` (migration 0009) | In `main`; run migration 0009 in Supabase; no build needed |
| 8 (email part) | Users could store `email_verified = true` without confirming their email | DB | branch `fix/issue-8-email-verified` (migration 0010) | In `main`; run migration 0010 in Supabase; no build needed |
| 17 | Transfer log (who messaged whom, when, size) kept forever | DB | branch `fix/issue-17-transfer-log` (migration 0011) | In `main`; run migration in Supabase; no build needed |
| 25 | Setup failure silently replaced the chosen username with a random one | app | branch `fix/issue-25-username-setup` | In `main`; needs build 8 |

| 27 | App lock started unlocked until settings loaded, and never re-locked when the app went to the background | app | branch `fix/issue-27-app-lock` | In `main`; needs build 8 |
| 28 | Incoming messages not de-duplicated (a re-sent copy showed twice) | app | branch `fix/issue-28-dedupe` | In `main`; needs build 8 |

| 29 | Tapping a message / chat-request / contact-request notification did not open the chat | app + relay | branch `fix/issue-29-notification-tap` | In `main`; relay part deploys safely first; needs build 8 |
| 30 | A declined contact request could never be re-sent; the error was swallowed | app | branch `fix/issue-30-declined-resend` | In `main`; needs build 8 |

| 31 | Leaving a group only sent the leave message; the group stayed on screen | app | branch `fix/issue-31-leave-group` | In `main`; needs build 8 |
| 32 | Group invite / forward lists silently cut at 6 people | app | branch `fix/issue-32-list-cut` | In `main`; needs build 8 |

| 33 | Denied photo / camera / location permission gave no message | app | branch `fix/issue-33-permission-messages` | In `main`; needs build 8 |
| 34 | Reset-password screen spun forever without a valid session | app | branch `fix/issue-34-reset-spinner` | In `main`; needs build 8 |

| 35 | Expo push token printed to the log | app | branch `fix/issue-35-38-cleanup` | In `main`; needs build 8 |
| 38 | Mock phone-verification (test code) shipped in release builds, and its test screens were reachable by link | app | branch `fix/issue-35-38-cleanup` | In `main`; needs build 8 |
| 39 (iOS part) | `ITSAppUsesNonExemptEncryption` not set in the app config | app config | branch `fix/issue-39-config` | In `main`; needs build 8. Android permission trimming deliberately NOT done (see log) |

| 7 | Edit / delete / poll vote not checked against the original sender | app | branch `fix/issue-7-sender-check` | In `main`; needs build 8 |
| 41 | A failed message showed only "Failed": no reason, no retry | app | branch `fix/issue-41-retry` | In `main`; needs build 8 |

| 37 | Group call cap (4 people) did not say who would be left out | app | branch `fix/issue-37-group-call-cap` | In `main`; needs build 8. The 4-person limit itself stays (see log) |
| 12 | Presence visibility setting was cosmetic: online status went to every connected user, and "Nobody" was only hidden by the app | relay | branch `fix/issue-12-presence-relay` | In `main`; relay only, no build needed (deploys on Render) |
| 24 | A failed contact refresh (network drop, timeout) emptied Chats/Contacts and made blocked people reappear | app | branch `fix/issue-24-contact-refresh` | In `main`, needs build 8 |

### Open (original 20)

| # | Issue | Sev | Where |
|---|---|---|---|
| 2 | `users` table readable by everyone (login-by-username, signup check, contact search, QR depend on it) | C | DB + app |
| 8 | Users can set their own `phone_verified` (the `email_verified` part is fixed, see below; phone verification is not in the live flow) | H | DB |
| 9 | Public `/ice-servers` exposes TURN credentials | H | relay |
| 16 | Groups lost when the relay restarts | M | relay |
| 18 | Docs and encryption PDF say "libsodium"; the app uses TweetNaCl | M | docs |

### Open (found in the broader audit)

| # | Issue | Sev | Where |
|---|---|---|---|









| 36 | All chat history loaded at once at start-up | M | app |


| 40 | No calls to a closed app on iPhone (no CallKit / push-to-talk) | — | product limit |

### Suggested order
1. **Relay, no app release:** 9, 14, 15.
2. **Database:** 1, 8, then 2 last (it breaks login-by-username until replaced, and the live Android app still reads `users` directly).
3. **App (build 8):** 26, 21, 24 (done, on branch), 25, 27, and the medium items.

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
- **Shipped:** `7d2b8bd`, merged to `main`; Render auto-deploy started.

### 2026-10-28: Issue 6 — filter injection in the contact check
- **Root cause:** `areApprovedContacts` built its database filter by pasting both user ids into a string. The second id is the `to` field of the client's event and was only checked to be "a string". A value like `x),and(sender_id.neq.0,receiver_id.neq.0` rewrote the filter so any approved contact row matched, so a logged-in user could pass the "are these two approved contacts" check for people they have no contact with (messages, typing, calls, group invites all use this check).
- **File:** `server/src/supabaseAdmin.ts`.
- **Change:** both ids must be real UUIDs (what Supabase user ids always are) or the answer is "not contacts"; such values are never cached.
- **Tested:** against a mock database that evaluates the filter like PostgREST: old code answers "approved" for a stranger with two crafted values (2 fails), new code answers false for both; real pairs (either order, upper or lower case) still true; relay regression suite re-run with UUID ids, 26/26 pass. Typecheck clean.
- **Not covered:** `isBlocked` already uses safe parameters but treats a database error as "not blocked" (issue 14).
- **Shipped:** merged to `main`; deploys on Render.

### 2026-10-28: Issue 14 — contact cache and block check
- **Root cause:** `areApprovedContacts` remembered every answer for 30 s, including "no" and database errors. Someone whose request had just been accepted (or who hit one failed lookup) kept getting "not a contact" and failed sends for up to 30 s. `isBlocked` treated a database error as "not blocked", so a blocked person's message could get through during a hiccup.
- **Files:** `server/src/supabaseAdmin.ts`, `server/src/index.ts`.
- **Change:** only "yes" is cached; errors and "no" are never cached; the cache is cleared for a pair when the relay is told their request was sent or answered (`contact:request_sent` / `contact:request_responded`); cache size is bounded; `isBlocked` now fails closed (database error = treated as blocked). Branched from fix 6, so merging this also brings in fix 6.
- **Tested:** mock database with switchable states: old code fails 3 checks (stale "no" after approval, error remembered, error treated as not blocked), new code passes 9/9; repeated checks still served from cache (0 database hits); relay regression (UUID ids) and the size/rate-limit suite still pass. Typecheck clean.
- **Limit:** a contact that was removed or declined from another device can still pass for up to 30 s unless the relay was told (only the live nudge events clear it).
- **Shipped:** merged to `main` together with fix 6.

### 2026-10-28: Issue 15 — group id could be overwritten
- **Root cause:** `group:create` replaced any existing group with the same id. Anyone who knew or guessed a group id (the app makes them client-side) could send a create for it: the real members were dropped from the relay's roster and the sender became owner.
- **Files:** `server/src/state.ts`, `server/src/index.ts`.
- **Change:** creating an id that belongs to someone else's group is refused with an error and the group is untouched; the owner re-sending create (a retry) just re-confirms the group without resetting it or re-sending invites; `createGroup` itself never replaces an existing group; input limits (id up to 128 characters, name 200, 256 invitees).
- **Tested (local relay, old vs new):** old relay: after the hijack the real owner can no longer message the group (5 checks fail); new relay passes 7/7 (refused, original group works, attacker not a member, owner retry safe, long id rejected); regression and size/rate-limit suites pass; typecheck clean.
- **Limit:** group membership still lives only in relay memory and is lost on restart (issue 16).
- **Shipped:** merged to `main` (with 19).

### 2026-10-28: Issue 19 — call ring cleared by the wrong person
- **Root cause:** any call-resolving signal (decline, hangup, accept, busy, timeout) cleared the pending ring for BOTH the sender and the target, whoever started it. So any contact could cancel someone else's pending call to a person by sending that person a "hangup", and a user's own unrelated incoming ring vanished whenever they signalled anyone. The pending ring is what a closed app learns about when it reconnects, so the call was silently lost.
- **Files:** `server/src/state.ts`, `server/src/index.ts`.
- **Change:** a resolving signal clears only the ring between those two users (either direction) and only in the same context (the same group id, or none for a 1:1 call).
- **Tested (local relay, old vs new):** old relay fails 3 checks (stranger's hangup cancels the ring; callee signalling someone else cancels their own ring; a 1:1 hangup clears a group ring); new relay passes 7/7, including the normal cases (caller hangup, callee decline, accept, group hangup all still clear). Regression and size/rate-limit suites pass; typecheck clean.
- **Limit:** one pending ring is remembered per person, so two simultaneous callers still overwrite each other (the app shows one ring at a time).
- **Shipped:** merged to `main` (with 15).

### 2026-10-28: Issue 20 — contact notifications without a real request
- **Root cause:** when the app sends a contact request it writes the row to the database itself and then tells the relay "I sent one" so the relay can push-notify the other person. The relay never checked that a request really existed, so any logged-in user could trigger "new contact request" pushes and live refreshes to any other user (and fake "request answered" nudges).
- **Files:** `server/src/supabaseAdmin.ts` (new `hasContactRequest`), `server/src/index.ts`.
- **Change:** `contact:request_sent` is acted on only if a PENDING request from this user to that person exists; `contact:request_responded` only if that person has a request to this user that is approved or declined. Anything else is ignored silently. Fails closed on database errors. The contact cache for the pair is also cleared on both events. The existing per-recipient push cooldown is unchanged.
- **Tested (local relay with a fake Expo push endpoint, old vs new):** old relay fails 6 of 8 checks (every fake request still pushes and nudges); new relay passes 8/8: a real request still notifies and pushes, no request = nothing, a third party cannot trigger it, a response nudge only after the request is answered. Regression and size/rate-limit suites pass; typecheck clean.
- **Limit:** the app writes the row before sending the event, so there is no timing gap; if the row insert were ever slow to become visible the notification would be skipped (the recipient still sees the request on their next refresh).
- **Shipped:** merged to `main`.

### 2026-10-28 08:45: New report — notification on a phone the account had left (issue 42, not fixed)
- **Report:** an account that was signed in on Krishna's phone earlier is now signed in on another phone; texting it notifies both phones.
- **Findings (code read only):** each account has ONE push token in `users.push_token`, the last device that registered wins; the relay sends one push to that token. The live Android app does not clear the token on sign-out (build 8 does, fix 22), so a phone that signed out can keep a token that is still on file, and a phone that is still signed in also shows its own in-app notification from the live connection. Not yet confirmed which of these happened on the two phones.
- **Open:** answers needed (was the account signed OUT on the first phone, or just left signed in; which notification appeared on which phone). Candidate fixes: build 8 already covers the sign-out case; a proper fix is one token per device (new database table, app registers per device, relay sends to all of the account's devices and Expo drops dead tokens) and needs a build.

### 2026-10-30: Apple review request (guideline 2.1, new-app information) — not a rejection yet
- **What Apple asked for:** screen recording on a physical device (launch, sign-up, login, **account deletion**, content reporting and blocking), app purpose and audience, setup and demo login, list of external services, regional differences, regulated-industry documents. Reply in App Store Connect AND copy it into the App Review Information notes.
- **Finding:** the app has **no account deletion** (issue 43). Reporting and blocking exist (chat menu: Block contact, Report contact). Phone verification is not in the live sign-up flow (email + password only), so it must not be mentioned as a feature.
- **Recommendation:** add account deletion (issue 43) first, ship it in build 8, then reply with a recording made from that build. A recording without account deletion will very likely be rejected under 5.1.1(v), and the Terms currently claim a feature that does not exist.

### 2026-10-30: Issue 43 — in-app account deletion
- **Why:** Apple requires any app that lets people create an account to let them delete it inside the app, and the review team asked for it to be shown in the screen recording. The Terms of Service already said this existed; it did not.
- **Files:** `server/src/index.ts`, `server/src/supabaseAdmin.ts`, `app/src/state/authStore.ts`, `app/src/lib/localDb.ts`, `app/src/lib/keystore.ts`, `app/app/settings.tsx`.
- **Change:**
  - Relay: new `POST /account/delete` (login token in the `Authorization` header). It deletes only the account that token belongs to — there is no user id in the request, anything extra is ignored — by deleting the Supabase auth user, which cascades to the profile, contact requests, blocks, public keys, push tokens and the transfer log (every table already cascades). Avatar files are then removed (best effort). The user is removed from groups (remaining members are told), their contacts get a live refresh, and their connection is closed. A double tap is refused (409); a database failure returns an error and changes nothing.
  - App: Settings gets a "Delete account" button below Log out with two confirmation steps (what will be deleted, then "Are you absolutely sure?"). On success, after the server confirms, it erases this phone's copy (chat database file, its encryption key, the end-to-end secret key), drops the connection, ends the local session and returns to the login screen. If the server or network fails, nothing is removed locally and the user is told.
- **Tested:** relay against a mock Supabase, 12/12 (no/invalid token refused; deletes only the token's owner even when another id is supplied; avatars removed; connection closed; contacts and group members notified; database failure = 500 and nothing closed; double tap = one deletion; relay healthy); app `deleteAccount` with the real store, 15/15 (success, server error, no network, relay URL missing, not signed in; local wipe happens only after the server confirmed; chats cleared); phone wipe helpers 5/5 (right database file and key names, only this user's); relay regression and size/rate-limit suites pass; app and relay typecheck clean.
- **Not covered by tests:** the real Supabase admin delete call (only a mock) and the Settings screen on a device. First real check: delete a throwaway account on a phone and confirm the row is gone in Supabase (Authentication and the `users` table).
- **Limits:** messages already delivered to other people stay on their phones (the relay and database never held them); email and username become free to reuse. Users with the live Android app cannot delete their account until they update.
- **For the App Review reply:** the recording can now include the Delete account step (from build 8).
- **Shipped:** merged to `main`; relay endpoint deploys on Render, the Settings button needs build 8.

### 2026-10-30: Issue 26 — local chat history wiped on any database error
- **Root cause:** when the app prepared the local database and ANY error came back, it assumed the encryption key no longer matched the file and deleted the whole encrypted history file to start fresh. A full disk, a locked database, an I/O error, low memory or a native hiccup says nothing about the key; the history on disk was intact and got deleted anyway.
- **File:** `app/src/lib/localDb.ts`.
- **Change:** the delete-and-start-fresh recovery now runs only when SQLite says the file cannot be read with this key ("file is not a database" / "file is encrypted or is not a database", SQLITE_NOTADB code 26), once. Any other error is reported, the file is left untouched, and the next open simply tries again.
- **Tested (simulated database errors, old vs new):** old code deletes the history on all 5 unrelated errors (disk full, locked, I/O, native hiccup, out of memory) and after a transient error followed by a retry; new code keeps it in every case (10/10). The real key-mismatch case still recovers exactly once (and stops after one reset if it keeps failing). Typecheck clean.
- **Limit:** a genuine key/file mismatch (reinstall, device restore, invalidated key) still resets that account's history; the old history cannot be read without the original key. Not tested on a device.
- **Shipped:** merged to `main`; needs build 8.

### 2026-11-01: Issue 21 — audio session left in recording mode
- **Root cause:** starting a voice note switches the phone's audio session to a record-capable mode (on iPhone: play-and-record, which sends sound to the earpiece, plays quietly and can interfere with calls). Nothing ever switched it back, so after the first voice note the rest of the session (voice-note playback, calls) ran in the wrong mode. It also stayed on if recording failed to start or to stop, and if the user left the chat mid-recording.
- **Files:** `app/src/lib/media.ts`, `app/app/chat/[id].tsx`, `app/app/group-chat/[id].tsx`.
- **Change:** a helper restores normal playback mode (still audible with the silent switch on); it runs when a recording is stopped (saved or failed), when starting fails after the mode was switched on, and via a new `abortVoiceRecording` when a chat screen closes while recording. The close-while-recording cleanup acts only if that screen was actually recording, so it cannot disturb an active call. Permission-denied starts change nothing.
- **Tested (real helper code, stubbed audio and file modules, old vs new):** old code fails 5 of 7 (mode never restored after stop, failed stop, failed start, record error, abandoned recording); new code passes 7/7. Typecheck clean.
- **Limit:** the audio behaviour itself (earpiece vs speaker, volume) cannot be observed here; it needs the phone check below. The chat-screen cleanup is covered by typecheck and code reading, not by a rendered test.
- **Shipped:** merged to `main`; needs build 8.

### 2026-11-01: Issue 24 — failed contact refresh emptied the lists
- **Problem:** `contactStore.refresh` ignored the `error` of its two database lookups. On a network drop or server error the missing data was treated as "no contacts": Chats and Contacts went empty, pending requests vanished, and a failed block lookup made blocked people reappear, until the next successful refresh.
- **Change:** `app/src/state/contactStore.ts`. A failed or thrown lookup now keeps the lists already on screen, stops the loading spinner and logs the error. It retries in the background up to 3 times, 5 seconds apart (only if no newer refresh started and the same user is still signed in). A successful refresh resets the retry count.
- **Tested:** real store with a stubbed database, old vs new. Old code failed 3 of 6 checks (requests error empties lists, block error unblocks, thrown error crashes the refresh); new code passes 6/6, including success path unchanged and recovery on the next good refresh. App typecheck clean.
- **Not covered:** retry timing on a real phone.
- **Shipped:** merged to `main`; needs build 8.

### 2026-10-28: Issue 42 — one push token per account (per-device tokens)
- **Root cause:** each account had a single push token (`users.push_token`); the last phone to register won, and the live app never removed a phone's token when it signed out (and the sign-out in `main` cleared the column even if the account's other phone had since registered). So a phone the account had left could keep getting notifications, or a second phone would silently take them over.
- **Files:** new `supabase/migrations/0008_device_push_tokens.sql`; `server/src/pushPing.ts`; `app/src/lib/push.ts`.
- **Change:**
  - Database: new `device_push_tokens` table, one row per physical install (the token is the key, so it moves to whoever signs in on that phone). Clients have no direct table access; they call `register_push_token` / `unregister_push_token`, which can only act on the caller's own account. Safe to run twice.
  - Relay: a push goes to every token of the account (one request, de-duplicated with the old single token); tokens Expo reports as dead (`DeviceNotRegistered`) are deleted; if the new table does not exist yet it falls back to the old token alone, so nothing breaks before the migration is run.
  - App: registers this device through the new function (falls back to the old column if the function is missing); on sign-out removes only THIS device's token, and clears the profile column only if it holds this device's token.
- **Tested:** the migration on a real Postgres engine with roles (13/13: moves tokens between accounts, cannot remove or read others', no direct writes, junk and unauthenticated calls refused, safe twice); app registration code old vs new (old fails 5, new passes 7/7); relay old vs new (old fails the multi-device checks; new passes 7/7, including legacy-only accounts, de-duplication, dead-token pruning, and the missing-table fallback); regression and size/rate-limit suites pass; app and relay typecheck clean.
- **Rollout order:** (1) run migration 0008 in the Supabase SQL editor; (2) merge, which deploys the relay (it works before and after the migration); (3) the app part reaches phones with build 8.
- **Limits:** a phone running the live (old) app still writes only the single profile token and never removes it on sign-out, so that stale-token case stays until those phones update; a stale old-style token is also cleaned up when Expo reports it dead. Android push still needs the FCM credentials on the Expo project (existing note in docs/SETUP.md).
- **Shipped:** merged to `main`. The relay part is safe to deploy first; the migration (0008) must be run in Supabase for per-device tokens to take effect; the app part needs build 8. The migration self-test script now lives in `supabase/tests/device_push_tokens_selftest.sql`.

### 2026-11-01: Issue 1 — nobody may approve their own contact request
- **Root cause:** the INSERT rule only checked "you are the sender", so a user could insert a row that was already `approved`; the UPDATE rule let either side change the row, so a sender could flip their own pending request to `approved` (and rewrite `sender_id` / `receiver_id`). The relay treats `approved` as permission to message, call and group with someone, so this bypassed consent.
- **File:** new `supabase/migrations/0009_contact_requests_rls_tighten.sql`.
- **Change:** a new request must be `pending` with no response time; only the receiver can answer, and only while it is still pending; a trigger freezes `sender_id`, `receiver_id` and `created_at`. The app already does exactly this (sender inserts pending, receiver updates), so no app release. The relay never writes this table. Delete (unfriend) is unchanged.
- **Tested:** real Postgres engine with the real table and policies from migrations 0001/0006/0007, before vs after: before, a sender can approve their own request, insert an approved row and rewrite the parties; after, all 10 checks pass (normal request, receiver approves/declines, sender cannot approve, no pre-approved insert, no impersonated sender, parties frozen, delete works, outsider blocked, an answered request cannot be changed again).
- **Not covered:** the real Supabase project (policy behaviour is standard Postgres RLS). Optional clean-up: the migration ends with a query listing `approved` rows with no `responded_at`, which the app never creates; review those by hand.
- **Rollout:** run migration 0009 in the Supabase SQL editor. Takes effect immediately for the live Android app too.
- **Shipped:** merged to `main`; migration still to be run in Supabase.

### 2026-11-01: Issue 8 (email part) — email_verified now comes from Supabase Auth
- **Root cause:** after the user confirmed their email, the app wrote `email_verified: true` into `public.users` itself (`finalizeAccount`), and the row rules accepted any value, so anyone could create or edit their profile row with `email_verified = true` without confirming an email. The app uses that flag to decide whether the profile setup is finished.
- **File:** new `supabase/migrations/0010_users_email_verified_from_auth.sql`.
- **Change:** a trigger on `public.users` (insert and update) sets `email_verified` from `auth.users.email_confirmed_at`, ignoring what the client sent. The live Android app is unchanged: after a real confirmation it sends true and true is stored; otherwise it is forced to false.
- **Tested:** real Postgres engine with the real table and policies, before vs after: before, an unconfirmed account could store true (insert and update); after, it is forced false, and the same update succeeds after the real confirmation; confirmed accounts and ordinary profile edits are unaffected (5/5).
- **Not changed:** `phone_verified` (phone verification is not in the live flow, per your instruction), and the `email` column itself can still be set to any text. Existing rows are untouched; the migration ends with a query that lists rows marked verified without a confirmed email.
- **Rollout:** run migration 0010 in the Supabase SQL editor.
- **Shipped:** merged to `main`; migration still to be run in Supabase.

### 2026-11-01: Issue 17 — transfer log retention
- **Root cause:** `message_transfer_log` (sender, recipient, time, size; no content) was written by the relay for every delivered message and never cleaned. Nothing in the app or relay reads it, so it only built up a permanent who-talks-to-whom history.
- **File:** new `supabase/migrations/0011_message_transfer_log_retention.sql`.
- **Change:** an index on `created_at`, a function `purge_old_message_transfer_log(retain)` (default 30 days; refuses less than 1 day; not callable by app users), and a daily pg_cron job at 03:15 UTC. If pg_cron is not enabled the migration still applies and prints a notice; enable pg_cron in Supabase (Database > Extensions) and re-run the file to add the schedule.
- **Decision for you:** 30 days is my choice; change the number in the migration if you want more or less.
- **Tested:** real Postgres engine with the real table: only rows older than the limit are deleted (2 of 4), running twice is harmless, under-1-day refused, app users denied, custom retention works (6/6). The pg_cron scheduling itself is not tested here (not available in the test engine).
- **Rollout:** enable pg_cron, run migration 0011 in the SQL editor, then check `select * from cron.job;` shows `purge-message-transfer-log`.
- **Shipped:** merged to `main`.

### 2026-11-01: Issue 25 — chosen username silently replaced after a setup failure
- **Root cause:** `finish-setup.tsx` created the profile in a 3-try loop and, on ANY error (a network blip, a server error), swapped in a random username for the next try. A bad connection could leave someone with a name they never chose, with no message.
- **Files:** `app/src/lib/account.ts` (new `finalizeAccountWithRetry`, `isUsernameCollision`), `app/app/(auth)/finish-setup.tsx`.
- **Change:** the chosen username is replaced only when the database says that username is taken (unique violation on `username`); then a random one is used AND the user is told ("Username changed ... you were given @x, change it in Settings"). Any other error retries the same username (1.5 s apart); if it keeps failing the user sees "check your connection and try signing in again", and the chosen name is kept (it is stored in the account and picked up on the next sign-in).
- **Tested (real code, stubbed database, old loop vs new):** old code renames after a single network blip; new code keeps the name (6/6): blip, persistent outage (3 tries, never renamed), real collision (renamed + flagged), other unique violations not treated as name collisions, normal path unchanged. App typecheck clean.
- **Not covered:** the alert on a device.

### 2026-11-01: Issue 27 — app lock bypass
- **Root cause:** `AppLockGate` decided "unlocked" at the first render from the lock setting, but the saved setting loads asynchronously, so a cold start read the default (off) and showed the app unlocked; it also never reacted to the app going to the background, so a user who switched away and back was never asked again.
- **Files:** `app/src/components/AppLockGate.tsx`, new `app/src/lib/appLockLogic.ts`.
- **Change:** the gate waits until the saved settings have loaded (shows only the background until then, never the app); lock off opens immediately, lock on prompts automatically; the app re-locks every time it goes to the background and prompts again on return; the system prompt's own background blip is ignored, and two prompts cannot start at once.
- **Tested:** the rules (old behaviour as on `main` vs new), 9/9: not-loaded no longer counts as unlocked, lock-on stays locked, lock-off opens, background re-locks, prompt blip ignored. App typecheck clean.
- **Not covered by tests:** the real Face ID / fingerprint prompt and the app-state events on a device (the checklist item below covers this).
- **Limit:** re-lock happens immediately on background (no grace period); a delay setting could be added later.

### 2026-11-01: Issue 28 — duplicate incoming messages
- **Root cause:** the receive handler appended every `message:receive` to the thread without checking whether a message with that id was already there, so a copy re-sent by the relay (e.g. around a reconnect) or a duplicate frame appeared twice and was saved twice.
- **File:** `app/src/state/chatStore.ts`.
- **Change:** the append now checks the id inside the state update (so copies arriving at the same instant cannot both pass) and skips both showing and saving a message that is already in the thread. Applies to direct and group chats.
- **Tested (real store, old vs new):** old code adds a repeated copy (5 of 6 checks fail); new code passes 6/6: first copy saved once, repeat ignored, three simultaneous copies give one message, distinct messages unaffected, groups covered. App typecheck clean.
- **Shipped:** merged to `main`; needs build 8.


### 2026-11-01: Issue 29 — notification taps open the right screen
- **Root cause:** only call notifications were routed on tap. The relay's message, chat-request and contact-request pushes carried no data at all, so a tap just opened the app wherever it last was.
- **Files:** relay `server/src/pushPing.ts` and `server/src/index.ts`; app `app/src/lib/push.ts`, new `app/src/lib/notificationRoute.ts`, `app/app/index.tsx`.
- **Change:** the relay now adds `data` to those pushes (`kind` plus the sender's id for messages and chat requests). The app maps a tap to the sender's chat (`/chat/<id>`) or the Contacts tab; only a real UUID can become part of a route. If the app is already signed in the tap opens it at once; on a cold start the destination is remembered and opened right after the app reaches the chat list. Old apps ignore the extra data, so the relay can deploy before build 8.
- **Tested:** relay push payloads against a stub (old vs new: old carries no data, new passes 4/4); route rules 6/6 (message, chat request, contact request, calls left to their own handler, missing data, crafted id rejected). Typechecks clean for app and relay.
- **Not covered:** the actual notification tap on a device (warm and cold start).
- **Shipped:** merged to `main`.


### 2026-11-01: Issue 30 — re-sending a declined contact request
- **Root cause:** a declined request keeps its row, which occupies the (sender, receiver) slot (`contact_requests_unique_pair`). A new request hit a unique-violation (23505), and the app treated that as "already covered" and returned silently, so nothing was sent and nothing was shown.
- **File:** `app/src/state/contactStore.ts`.
- **Change:** before inserting, the sender's own declined row to that person is deleted (a sender may delete a row they are part of), then a fresh pending request is inserted and the recipient notified as usual. A failed delete or any other insert error now shows "Could not send request" instead of failing silently. Compatible with the contact-request security fix (migration 0009: inserts must be pending, delete still allowed for participants).
- **Tested (real store, stubbed database that enforces the unique pair, old vs new):** old code fails the re-send (3 of 6 fail); new code passes 6/6: re-send after decline creates a pending request, notifies, shows as outgoing; first request, duplicate send while pending and mutual-request handling unchanged.
- **Limit:** a person who declined can be asked again; they can block the sender to stop it. A cool-down could be added if it gets abused.

### 2026-11-01: Issue 31 — leaving a group
- **Root cause:** `leave()` sent `group:leave` and relied on follow-up events, but the relay only tells the OTHER members (the leaver is already out of the member list when it broadcasts `group:member_left`). The leaving phone kept showing the group until the next reconnect.
- **Files:** `app/src/state/groupStore.ts`, `app/app/group-info/[id].tsx`.
- **Change:** once the leave request has actually been sent, the group is also removed from this phone's list. If it could not be sent (offline), nothing changes and the screen says "You are offline — Reconnect to leave this group" instead of silently leaving the user in the chat list.
- **Tested (real store, old vs new):** old code keeps the group (1 of 5 fails); new code passes 5/5: leave sends the event, group disappears at once, other groups untouched, offline keeps the group and reports false.

### 2026-11-01: Issue 32 — invite and forward lists cut at 6
- **Root cause:** "Invite to group" (`group-info/[id].tsx`) and "Forward to" (`chat/[id].tsx`) built their menus from `.slice(0, 6)`, so anyone beyond the sixth contact could not be invited or forwarded to, with no hint that the list was cut.
- **Change:** removed the cut. The menus go through the app's own alert component, whose button list already scrolls (max height 400), so every contact is reachable.
- **Tested:** app typecheck clean; code inspection that no `slice(0, 6)` remains in those two places and that the alert list scrolls. Not unit-tested (screen code); the phone check below covers it.

### 2026-11-01: Issue 33 — permission denied gave no message
- **Root cause:** when photo, camera or location permission was refused, the helpers returned `null`, which the screens treat as "cancelled", so the button just did nothing. (Voice and video already showed a message.)
- **File:** `app/src/lib/media.ts` (new `explainPermissionDenied`).
- **Change:** a refused permission now shows "Photo / Camera / Location access is off" with the reason and an "Open Settings" button (opens the app's settings page) or "Not now". Covers chat photos, the camera option, profile photo and share location.
- **Tested (real helpers, stubbed pickers and settings, old vs new):** old code shows nothing (5 of 7 fail); new code passes 7/7: each denial shows the right message, the button opens settings, and granted permissions return the photo/location with no alert. App typecheck clean.

### 2026-11-01: Issue 34 — reset-password screen never gave up
- **Root cause:** the screen waits for the recovery session created from the email link; with an expired, already-used or broken link that session never arrives and "Verifying reset link…" spun forever with no way out.
- **File:** `app/app/(auth)/reset-password.tsx`.
- **Change:** after 12 seconds without a session the screen shows "This reset link did not work — it may have expired or already been used" with a "Back to login" button. If the session arrives later the form appears as before.
- **Tested:** app typecheck clean. Not unit-tested (screen code); covered by the phone check below.

### 2026-11-01: Issues 35 + 38 — push token log and phone-verification test code
- **35:** `app/src/lib/push.ts` printed the full Expo push token to the device log; anyone able to read logs could send pushes to that phone. It now logs only "obtained an Expo push token".
- **38:** `app/src/lib/otp.ts` is a mock phone-verification provider that generates a code, prints it to the log, and accepts it; its two test screens (`phone-auth/entry`, `phone-auth/verify`) were registered routes reachable by a link. Not part of the live sign-up flow, but shipping a fake phone check is wrong. Now the mock exists only in development builds (`__DEV__`); a release build gets a provider that refuses ("Phone verification is not available yet") and prints nothing, and the two screens redirect to the start screen in release builds.
- **Tested:** OTP provider, real file with `__DEV__` on/off: release old code sends and logs the code (2 of 3 fail); release new code refuses and logs nothing (3/3); dev build still works (3/3). App typecheck clean. Push-token log change checked by code inspection.
- **Shipped:** merged to `main`; needs build 8.

### 2026-11-01: Issue 39 — encryption declaration (iOS); Android permissions left alone
- **Change:** `app/app.json` now sets `ITSAppUsesNonExemptEncryption: true` for iOS. Reasoning: the app implements its own end-to-end encryption (TweetNaCl, X25519 + XSalsa20-Poly1305) rather than only using the phone's built-in encryption for HTTPS, so I declared "uses encryption that needs documentation", matching your plan to submit the signed encryption PDF. Setting `false` would be a legal statement that no documentation is needed; I did not choose that. **This is your decision as the publisher:** if your own export-compliance review says the app is exempt, change it to `false` before building. Apple may also give an `ITSEncryptionExportComplianceCode` after the documents are accepted; add it under the same `infoPlist` then.
- **Not changed (on purpose):** the Android permission list. The live Play Store app depends on it, I cannot build or inspect the merged manifest here, and several entries look unneeded (`READ_EXTERNAL_STORAGE`, `BLUETOOTH`, `BLUETOOTH_ADMIN`, `USE_FINGERPRINT`) but some are used indirectly (Bluetooth headset routing in calls, photo picker on older Android). Trimming them blind could break calls or photo picking on some phones. Recommended: do it as a separate step with a test build and a check of the merged manifest.
- **Tested:** the JSON is valid and the key is present. No code change.
- **Shipped:** merged to `main`; needs build 8 (iOS).


### 2026-11-01: Issue 7 — edits, deletes and votes are checked
- **Root cause:** when a message arrived with kind edit, delete, poll vote or reaction, the app applied it to whatever message id it named, without checking who sent it. So the other person in a chat (or any group member) could rewrite or delete YOUR messages on your phone, vote on something that is not a poll, or store a huge "reaction".
- **File:** `app/src/state/chatStore.ts`.
- **Change:** an edit or delete applies only if the sender of the event is the original sender of the message; a poll vote applies only to a poll message and a valid option; a reaction must be a short emoji (16 characters at most). Everything else is ignored.
- **Tested (real store, old vs new):** old code fails 5 of 9 (other person edits and deletes my message, votes on a non-poll, votes for an option that does not exist, 500-character reaction); new code passes 9/9 including the normal cases (own edit, own delete, valid vote, normal reaction). App typecheck clean.
- **Not changed:** the relay still forwards these events as before (it cannot read them; they are encrypted).

### 2026-11-01: Issue 41 — retry and reason for failed messages
- **Problem:** after fix 11 a message that could not be sent shows "Failed", but nothing explained why and there was no way to send it again short of retyping it.
- **Files:** `app/src/state/chatStore.ts` (`retryMessage`, `discardFailed`), `app/src/lib/localDb.ts` (`deleteMessageRow`), new `app/src/lib/failReason.ts`, `app/src/components/MessageBubble.tsx`, `app/app/chat/[id].tsx`, `app/app/group-chat/[id].tsx`.
- **Change:** "Failed" on one of my messages is now tappable ("Failed · tap"). It opens "Message not sent" with a plain-language reason (they are offline, you are not connected, connection dropped, server did not confirm, app closed, no security key yet, ...) and three buttons: Try again (sends it as a new message and removes the failed one, works for text and for photos / voice / location / polls etc.), Delete (removes it completely, no "deleted" placeholder), Cancel. Only my own failed messages can be retried or discarded.
- **Tested (real store, old vs new):** old version has neither feature; new passes 10/10: failed text message retried exactly once, goes to the relay, old row removed from the saved history; retry/discard ignore messages that did not fail; a location message is retried with its content; every failure reason has a readable text. App typecheck clean.
- **Limit:** a retried message gets the time of the retry (it moves to the bottom), not its original position.

### 2026-11-01: Issue 37 — group call cap now names who is and is not called
- **Situation:** group calls are a direct phone-to-phone mesh limited to 4 people (`GROUP_CALL_CAP`, see docs/GROUP_CALLING.md). The group chat already warned "Group calls are limited to 4 people", but only said the first three would be rung, not who they were; the others were left out without being named. Raising the limit is a product / performance decision (every extra person multiplies each phone's connections and bandwidth), so I left the number alone.
- **Files:** new `app/src/lib/groupCallCap.ts`, `app/app/group-chat/[id].tsx`.
- **Change:** the heads-up now reads, for example, "This group has 6 members. This call will ring: A, B, C. Not called: D, E." with Cancel / Call anyway. Members who are not in your contacts appear as "Member".
- **Tested:** message builder 6/6 (no warning at 4, names the called and the not-called, correct member count). App typecheck clean.
- **Shipped:** merged to `main`; needs build 8.

### 2026-11-01: Issue 12 — online status is now enforced by the relay
- **Root cause:** the relay announced "X is online / offline" to EVERY connected socket, so any signed-in stranger could watch when anyone was online, and the "Nobody" setting was only a hint the app applied on its own screens (the code comment said so).
- **Files:** `server/src/index.ts`, `server/src/supabaseAdmin.ts`. No app change and no build needed.
- **Change:** a user's online/offline status is sent only to their approved contacts; a user whose setting is "Nobody" is not announced to anyone; the snapshot sent when you connect lists only your approved contacts who are online and not on "Nobody". The setting is read from the database and cached 30 seconds, so a changed setting takes effect within about half a minute; if it cannot be read, status is treated as "contacts" (never wider). The app already only shows presence for approved contacts, so "Everyone" and "Contacts only" look the same as before; "Nobody" now really hides you.
- **Tested (relay on a mock database, old vs new):** old relay fails 5 of 11 checks (stranger sees A online and offline, snapshot lists a Nobody contact and a stranger, a Nobody user is announced when connecting); new relay passes 11/11: contacts see each other, strangers see nothing, Nobody user never announced, snapshots filtered. Relay regression (messages, groups, calls, pings) and size/rate-limit suites pass. Relay typecheck clean.
- **Limit:** "last seen" times already known to the app are not retracted; and a user who set "Nobody" can still see their contacts' status (the setting hides you, it does not hide others).
- **Shipped:** merged to `main`; relay deploys on Render.

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
12. Create a throwaway account, add a contact, then Settings > Delete account (confirm twice): the app returns to login, signing in with that email fails, the row is gone in Supabase (Authentication and `users`), and the contact's phone refreshes without the account.
13. iPhone: record and send a voice note, then play a received voice note and place a call: playback is at normal loudness from the speaker (not the earpiece) and the call sounds normal; start a voice note, leave the chat without sending, then play a voice note: still normal.
11. Sign the same account in on two phones, close the app on one of them, send it a message from a third account: only the phone that is signed in notifies; sign out on one phone and confirm it stops notifying.
10. Airplane mode on, send a message: it shows Failed within a second, not "sending".
14. Open Contacts, turn on airplane mode, pull to refresh: the contact list stays as it was (not empty). Turn it off: it refreshes normally.
15. Sign up with a username, tap the email link while in airplane mode, then turn it off: the account ends up with the username you chose (not a random one).

16. Turn on the biometric lock, fully close the app, open it: the lock screen shows first and the app is never visible before unlocking. Then press Home for a few seconds and return: it asks again. Cancel the prompt: the Unlock button works.

17. Close the app on phone A, send A a message from B: tap the notification on A: it opens B's chat (also test with the app in the background). Send a contact request and tap its notification: it opens Contacts.

18. Create a group of three, leave it from one phone: it disappears from that phone's chat list at once, and the others see the member gone. Try leaving in airplane mode: you are told you are offline and stay in the group.

19. With more than 6 contacts: Group info > Add member and long-press a message > Forward both list every contact (scroll the list).

20. In phone settings turn off Photos / Camera / Location for Current, then try attaching a photo, the camera, a profile photo and share location: each shows a message with Open Settings.

21. Open an old (already used) reset-password link: after about 12 seconds you see 'This reset link did not work' with a Back to login button; a fresh link still shows the new-password form.

22. Airplane mode, send a message and a photo: both show 'Failed · tap'. Tap one: the reason is shown. Turn airplane mode off and tap Try again: it sends once and the failed copy is gone. Delete removes a failed message completely.
