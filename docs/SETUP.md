# Current — setup guide

This is the credential/infra checklist to get the app actually running against
real services. Everything in `/app` and `/server` is already wired to expect
these — nothing works end-to-end until you complete the steps below.

## 0. Claude Code on the web: GitHub push access

This repo's `origin` normally routes through this environment's connector
proxy, which doesn't currently have write access to the
`5g-labiiitdmk-trigunrobotic-systems` org (see `.claude/hooks/session-start.sh`
for the workaround and why it's needed). Until that connector access is
granted (Settings → GitHub App install → add this org), sessions authenticate
via a personal access token instead:

1. In this environment's settings (where you configure env vars/secrets for
   Claude Code on the web), add a secret named **`GITHUB_TOKEN`** with a
   GitHub PAT that has `repo` scope for this org/repo.
2. That's it — `.claude/hooks/session-start.sh` runs automatically at the
   start of every session, reads `GITHUB_TOKEN` from the environment, and
   configures git so `push`/`pull`/`fetch` just work. The token is never
   written to `.git/config` or any tracked file — it's read fresh from the
   environment each time git needs it.
3. If `GITHUB_TOKEN` isn't set, the hook no-ops silently and git operations
   against `origin` will fail with a normal auth error until it's added.

## 1. Supabase (metadata DB + email auth) — DONE, one required dashboard step left

Project: **`vwwedjketyuyhqbrqnvl`** (vwwedjketyuyhqbrqnvl.supabase.co).
`app/.env` has the URL + anon key, `server/.env` has the URL + service role
key (both gitignored, never committed). Migration `0001_init.sql` has been
run against it.

**Email confirmation uses Supabase's default link-based flow, not a typed
code** (the code-based template needs custom SMTP, skipped for now per your
call). The app was adapted to match: `signup.tsx` calls `signUp()` with
`emailRedirectTo` set to a fixed deep link, `verify-email.tsx` is a "check
your email" waiting screen (no code field), and `app/_layout.tsx` +
`src/lib/authDeepLink.ts` handle the incoming link globally — tapping it in
the confirmation email opens the app already signed in, no manual step.

**Required — you must do this or the link will error out**: go to
**Auth → URL Configuration → Redirect URLs** in the Supabase dashboard and
add exactly:
```
current://auth-redirect
```
Supabase rejects redirects to any URL not on this allow-list. This is a
fixed literal string (see the comment in `src/lib/authDeepLink.ts` for why
it's hardcoded rather than computed) — copy it exactly, no trailing slash.

This sandbox can't reach `*.supabase.co` (network egress is allowlisted and
Supabase isn't on it), so none of this has been verified live from within a
session — verify from your own machine/device, or add the host to this
environment's egress allowlist if you want a future session able to check.

## 2. Firebase (phone OTP)

Project: **`current-7798d`** (console.firebase.google.com). Android app
package `com.current.app` is already registered and `app/google-services.json`
is in place (gitignored — it's a credential file, not committed).

1. **Build → Authentication → Sign-in method**: enable **Phone**, if not
   already on.
2. Add an iOS app in the same Firebase project with bundle ID
   `com.current.app` (matches `app.json`'s `expo.ios.bundleIdentifier`), then
   download `GoogleService-Info.plist` into `app/GoogleService-Info.plist`.
   Skip this if you're only building for Android right now.
3. Add your app's SHA-1/SHA-256 signing fingerprints in the Firebase console
   (Project settings → Your apps → the Android app) — Phone Auth on Android
   uses Play Integrity and will silently fail without this.

   **For local/debug builds**, a debug keystore is already generated at
   `app/credentials/debug.keystore` (gitignored — alias `current-debug`,
   store/key password `android`). Its fingerprints, already added below for
   convenience, are:
   ```
   SHA1:   1B:11:AC:8C:6E:9B:EB:F0:44:B2:90:A3:B5:FB:B1:50:DC:F6:84:AF
   SHA256: 20:93:59:00:3C:50:63:E3:FB:C9:3D:6F:D3:DB:A4:25:43:49:79:46:61:FE:12:60:26:AA:69:5E:6A:3C:DE:E7
   ```
   Add both to the Firebase console now if you want phone auth working in
   local/EAS-development-client builds signed with this keystore.

   **For production/Play Store builds**, this debug keystore must NOT be
   used — EAS will generate (or let you upload) a separate release keystore
   once you run `eas login && eas init && eas credentials`. Add *that*
   keystore's SHA-1/SHA-256 to Firebase as a second entry before shipping;
   Firebase supports multiple fingerprints per app.
4. **Important**: this app uses `@react-native-firebase` (native SDK), which
   means it cannot run in plain Expo Go. You need an EAS development build:
   ```
   cd app
   npx eas build --profile development --platform android
   ```
   (or `ios`, once you've added the iOS app above). Install that build on
   your device/simulator instead of using the Expo Go app.

## 3. Relay server

1. `cd server && cp .env.example .env` and fill in `SUPABASE_URL` +
   `SUPABASE_SERVICE_ROLE_KEY` (from step 1.5).
2. Local dev: `npm install && npm run dev` (listens on `:8787`).
3. Point the app at it: in `app/.env`, set
   `EXPO_PUBLIC_RELAY_WS_URL=ws://<your-machine-ip>:8787` (use your LAN IP,
   not `localhost`, if testing on a physical device).
4. **Deploy** (free tier): the included `server/render.yaml` targets
   [Render](https://render.com) — connect the repo, set root directory to
   `server`, add the two env vars in the dashboard. Railway and Fly.io work
   too; just set the same two env vars and run `npm run build && npm start`.
   Once deployed, update `EXPO_PUBLIC_RELAY_WS_URL` to `wss://your-app.onrender.com`.

## 4. Running the app

```
cd app
npm install
cp .env.example .env   # fill in Supabase values + relay URL
npx eas build --profile development --platform android   # or ios
```

Plain `npx expo start` will launch fine for UI iteration, but auth (phone
OTP) won't work until you're running the EAS dev build with the native
Firebase module linked.

## 5. What's intentionally not wired up

- **Play Store submission** — out of scope for this pass per your request.
  `app.json` uses `com.current.app` as the bundle ID/package (matching the
  Firebase project) — change it if you register something else on Play Console.
- **Real-time WebRTC audio/video** — calling is live ring/accept/decline
  signaling only (see `src/state/callStore.ts`); there's no audio/video
  media transport. Building that is a separate, large subsystem.
- **AR filters, mini-games, voice changer, doodle, co-watching, business
  profiles, bots, widget presence, topics within groups** — UI shells only
  (`app/lab/`), per the agreed scope. See `src/data/labFeatures.ts` for what
  each would take to actually build.
- **Payments** — explicitly deferred per your instructions; nothing here.

## 6. The zero-storage guarantee, concretely

- Message content only ever exists as JS objects in the Expo app's memory
  (`src/state/chatStore.ts`) and as JSON passing through the relay server's
  request handler (`server/src/index.ts`) — never written to a variable that
  outlives the function call, never logged, never in a database.
- Supabase Postgres holds exactly 4 tables (`supabase/migrations/0001_init.sql`):
  accounts, contact approvals, blocks, and public encryption keys. Grep the
  schema — there is no messages/history table to remove by accident later.
- Group identity/membership lives only in the relay server's in-memory `Map`
  (`server/src/state.ts`). Restart the relay and every group is gone —
  members just re-invite each other, which takes one tap.
