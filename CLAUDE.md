# CLAUDE.md — Current: Messenger

Read this first in every session. It is the short, always-current memory for this
repo. The long history is in `docs/WORK_LOG.md` (the bug register, one entry per
piece of work, and the real-phone checklist). **Every piece of work, however
small, must be written down — see "Keeping this memory up to date" at the end.**

## Who and what
- Owner: **Husenbasha Sompur** (Trigun Robotic Systems Pvt. Ltd., 5G Lab, IIITDM
  Kurnool). Always call him **Husenbasha**, never "Krishna" (Dr. K. Krishna Naik is
  his supervisor, a different person).
- Product: **Current: Messenger**, a privacy-first end-to-end encrypted messenger.
  React Native / Expo SDK 57 (RN 0.86, expo-router, zustand), Supabase (auth,
  Postgres, storage), a Node `ws` relay on Render, WebRTC calls, TweetNaCl E2E,
  SQLCipher local DB (expo-sqlite).
- Releases: Google Play (India) live at **v1.0.1** (without the fixes below). iOS
  **build 7** is in TestFlight, not submitted. **Build 8** (both stores) is the next
  release: all planned app fixes are already in `main`; the EAS build still has to be
  started by Husenbasha.

## Repo layout
- `app/` — the Expo app (`app/app/` screens, `app/src/` lib, state stores, components).
- `server/` — the relay (`src/index.ts` main, `state.ts`, `groupStore.ts`,
  `supabaseAdmin.ts`, `pushPing.ts`, `protocol.ts`). Render rootDir is `server`.
- `supabase/migrations/` — numbered SQL migrations. `supabase/pending/` — migrations
  that must NOT be run yet. `supabase/tests/` — DB self-tests.
- `docs/` — `WORK_LOG.md` (history), `SETUP.md`, `GROUP_CALLING.md`.

## Infrastructure (ids are not secrets)
- GitHub: `5g-labiiitdmk-trigunrobotic-systems/Current_Messenger` (repo was moved; the
  old URL redirects).
- Supabase project **Current_Messenger**, id `vwwedjketyuyhqbrqnvl`, region
  ap-northeast-1. Connected to Claude as a connector.
- Render workspace "My Workspace" (`tea-d983cnfaqgkc73ctr4a0`), relay service
  **Current_Messenger_relay** (`srv-d983ioeq1p3s73fnsuj0`), URL
  `https://current-messenger-relay.onrender.com`, auto-deploys `main`, free plan
  (sleeps when idle; first request after a quiet spell is slow). Connected as a connector.
- TURN: Metered (env `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` on Render).
- Expo/EAS: `eas.json` has `appVersionSource: remote` and production `autoIncrement`,
  so build numbers are made by EAS. The three env vars `EXPO_PUBLIC_RELAY_WS_URL`,
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` are gitignored and must
  exist as EAS production variables.

## How we work (standing rules)
1. **One branch per issue from `main`** (`fix/issue-N-short-name`). Write an old-vs-new
   test, add a `docs/WORK_LOG.md` entry, commit, `git push -u origin <branch>`, report.
2. **Merge only when Husenbasha says "merge"** (or "merge N", "merge all"). Merge with
   `--no-ff`. Resolve WORK_LOG conflicts by keeping both sides; remove the fixed
   issue's row from the "Open" tables.
3. Relay and database fixes need no app release. **App fixes need a new build** (build
   8 for both stores). **No OTA updates.**
4. Never ask for or send passwords. Husenbasha types demo-account passwords into
   App Store Connect himself. Apple credentials for EAS are typed in his own terminal.
5. Prefer inline text. Confirm before generating files unless he explicitly asked for
   the file (he asked for this one).
6. Commits end with the Co-Authored-By and Claude-Session lines given in the session
   reminder. A pushed branch with an upstream is required by the stop hook.
7. Keep replies short and say plainly what is done, what he must do, and what is
   still open. Do not call things done that were not run.
8. **Production safety:** the Claude permission check can block changes to the live
   Supabase database; when it does, do not work around it. Say so and give the SQL
   for him to run. Never run `supabase/pending/0014_users_restrict_read.sql` early.

## Commands
- App typecheck: `cd app && npx tsc --noEmit`
- Relay typecheck/build: `cd server && npx tsc --noEmit` / `npm run build`
- Relay locally: `cd server && npx tsx src/index.ts` (needs SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY, PORT).
- Release (run by Husenbasha, from `app/`): `npx eas-cli login`,
  `npx eas-cli env:list production`, `npx eas-cli build --platform ios --profile production`,
  `npx eas-cli submit --platform ios --latest` (android: `--platform android`).
- Test harnesses (old-vs-new checks, mock Supabase, Postgres via `@electric-sql/pglite`)
  are written per fix in the session scratchpad and are NOT in the repo; recreate them
  when needed. Test claims in WORK_LOG describe what was run.

## State as of 2026-11-01 (end of session)
**Everything in the bug register is fixed and merged into `main`**, except:
- **Issue 2 step 2 (HELD):** `supabase/pending/0014_users_restrict_read.sql` closes the
  `users` table (today anyone with the public key can read all rows incl. emails and
  push tokens). Run only after nearly everyone is on build 8 or later; running it earlier
  breaks username login, search and the username check in Play 1.0.1.
- **Issue 39 Android permissions:** analysed, deliberately unchanged (needs an internal
  test build + Android 11/12 and 13+ phones). READ/WRITE_EXTERNAL_STORAGE are added by
  libraries and `media.ts` requests the library permission; steps are in WORK_LOG.
- **Issue 40:** product limit (no calls to a closed app on iPhone; no CallKit). Do not
  promise it in the App Store text.

### Fixes merged into `main` (issue → one line)
1 contact-request self-approval blocked · 2 (step 1) lookup functions, app uses them ·
3 relay crash on malformed frames · 4 "[unable to decrypt]" (multi-device keys) ·
5 + 22 chats/contacts/calls leaked between accounts on one phone; sign-out resets stores ·
6 filter injection in the contact check · 7 edits/deletes/votes sender-checked ·
8 email_verified from Supabase Auth, phone_verified server-only · 9 `/ice-servers`
needs sign-in · 10 + 23 relay-client reconnect (duplicate sockets, dead connections,
foreground reconnect, fresh token) · 11 messages stuck on "sending" now fail fast ·
12 online status enforced by relay (contacts only, "Nobody" honoured) · 13 relay frame
size and rate limits · 14 contact cache/block check · 15 group id overwrite ·
16 groups saved to Postgres (survive restarts) · 17 transfer-log 30-day retention
(pg_cron) · 18 README says TweetNaCl · 19 call ring cleared by wrong person ·
20 contact notifications need a real request · 21 audio session · 24 contact refresh
failure no longer empties lists · 25 chosen username kept · 26 DB open error no longer
wipes history · 27 app lock bypass · 28 duplicate incoming messages · 29 notification
taps open the right screen · 30 re-send declined request · 31 leaving a group ·
32 invite/forward lists not cut at 6 · 33 permission-denied messages · 34 reset-password
screen gives up · 35 push token not logged · 36 chat history loads in pages of 300 ·
37 group call cap names who is left out · 38 mock phone verification removed from
release · 39 (iOS) encryption declaration (`ITSAppUsesNonExemptEncryption: true`, his
compliance call to confirm) · 41 retry and reason for failed messages · 42 per-device
push tokens · 43 in-app account deletion.
Details and test results for each are in `docs/WORK_LOG.md` section 4.

### Database (Supabase project vwwedjketyuyhqbrqnvl)
Applied 2026-11-01, in this order: 0006, 0007, 0008, 0009, 0010, 0011, 0012, 0013,
0015, 0016. (0001–0005 were applied earlier; `0014` is intentionally the held file in
`supabase/pending/`.) pg_cron is enabled and job `purge-message-transfer-log` runs daily
03:15 UTC. The Supabase migration history only lists migrations applied through the
connector (from 0006 on; names without the number prefix quirks).
Known harmless advisor notes: RLS-enabled-no-policy on `device_push_tokens`,
`relay_groups`, `relay_group_members` (intended, service role only); trigger functions
`users_enforce_email_verified` and `contact_requests_freeze_parties` are still
executable via the API (they cannot run directly) and the latter has no fixed
`search_path` (optional hardening, not applied); leaked-password protection is off
(Auth setting he can turn on).
Not stored: any phone numbers (0 of 133 users have one); 133 users, all with email.

### Relay (Render)
Live on `main` including fixes 9 and 16. Verified start-up log
`[groups] restored 0 group(s) from the database`. `ICE_ALLOW_ANONYMOUS=1` is an
optional Render env var: tokenless callers (old builds) get STUN only instead of 401.

## Open actions for Husenbasha (not code)
1. Start **build 8**: iOS `eas build` then `eas submit`; Android build separately.
2. Correct "libsodium" to TweetNaCl in the encryption PDF (wording in WORK_LOG, Issue 18).
3. Real-phone checks in WORK_LOG section 5 (esp. #12 delete account, #22 long-chat
   scroll, #23 group survives relay restart, #24 username login/search).
4. Record the iPhone screen recording (physical iPhone, including Delete account and
   block/report), then reply to Apple's **Guideline 2.1 – Information Needed** request
   (six items; Claude can draft the reply). Confirm regional availability and the
   `ITSAppUsesNonExemptEncryption` value.
5. Optional: set `ICE_ALLOW_ANONYMOUS=1`; turn on leaked-password protection; consider a
   paid Render plan before launch (free plan sleeps).

## Keeping this memory up to date
After EVERY piece of work, even a one-line change:
1. Add or update the entry in `docs/WORK_LOG.md` (what changed, files, how it was tested,
   what is still open, shipped or not). Update the issue register row.
2. Update the "State" sections above if the status of any fix, migration, deploy,
   build or open action changed. Keep this file short; push detail to WORK_LOG.
3. Commit both with the work (same branch), push, and report to Husenbasha.
4. Any change made directly to Supabase or Render (migration applied, env var, deploy)
   must be recorded here and in WORK_LOG with the date, because it is not visible in git.
