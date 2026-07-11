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

## 2. Phone verification — removed (but `google-services.json` still matters — see below)

Phone verification (Firebase Phone Auth) was built, then removed, twice
this project's history — most recently because Firebase's Phone Auth
provider requires the pay-as-you-go **Blaze** billing plan, which this
project is avoiding for now. Email verification (Supabase, section 1
above) is the sole signup requirement. `@react-native-firebase/*` is no
longer a dependency and there's nothing to configure here.

**Important — don't delete `app/google-services.json` again.** It was
briefly deleted as part of this removal on the (wrong) assumption it was
phone-auth-only. It's actually also required for **Android push
notifications** (section 4's `expo-notifications`, unrelated to
`@react-native-firebase`) — `expo-notifications`'s Android implementation
depends directly on `com.google.firebase:firebase-messaging` natively,
and Expo's prebuild only applies the Google Services Gradle plugin (which
that native FCM SDK needs to initialize against the right Firebase
project) when `android.googleServicesFile` is set. Removing it silently
broke push notifications as a side effect of an unrelated cleanup — fixed
by restoring both the file and the `android.googleServicesFile` field in
`app.json`. If phone verification comes back later (e.g. once Blaze is
acceptable), the old Firebase project (`current-7798d` on
console.firebase.google.com) and the debug keystore fingerprints below
are still around for reference:
```
SHA1:   1B:11:AC:8C:6E:9B:EB:F0:44:B2:90:A3:B5:FB:B1:50:DC:F6:84:AF
SHA256: 20:93:59:00:3C:50:63:E3:FB:C9:3D:6F:D3:DB:A4:25:43:49:79:46:61:FE:12:60:26:AA:69:5E:6A:3C:DE:E7
```
(from `app/credentials/debug.keystore`, alias `current-debug`, store/key
password `android` — unrelated to Firebase itself, this is a generic
Android debug-signing keystore and stays regardless.)

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
5. Optional: `ENABLE_TRANSFER_LOG=false` disables writes to
   `message_transfer_log` (metadata only — sender/recipient/byte size, never
   content) without a code change, just an env var + restart.

## 3.5 TURN server (for calling on strict NATs)

Calling works over the relay's existing signaling with just STUN (the
free `stun.l.google.com` default, no setup needed) for devices on
permissive networks. A TURN relay is only needed as a fallback when direct
peer-to-peer fails — common on mobile carrier networks and corporate
Wi-Fi. Without one, those calls will simply fail to connect; nothing
breaks, calling on friendlier networks is unaffected.

Recommended for this app's current scale: **[Metered.ca](https://www.metered.ca)**'s
free tier (500MB relayed bandwidth/month, no card required) — sign up,
grab the TURN credentials from their dashboard, then set on the relay
server:

```
TURN_URLS=turn:<your-subdomain>.metered.live:80,turn:<your-subdomain>.metered.live:443
TURN_USERNAME=<from Metered dashboard>
TURN_CREDENTIAL=<from Metered dashboard>
```

The relay serves these to the app at call time via `GET /ice-servers` —
never baked into the app bundle. Leave all three unset and calling still
works, just STUN-only.

Once real usage outgrows the free tier, options in rough cost order:
Metered's paid plan (~$99/mo, 150GB included), Cloudflare TURN standalone
($0.05/GB), or self-hosting `coturn` on a small VPS (~$5-6/mo) — **not**
on this same Render relay instance, since Render's free tier only exposes
HTTPS/WSS, not the raw UDP relay ports TURN needs.

## 4. Running the app

```
cd app
npm install
cp .env.example .env   # fill in Supabase values + relay URL
npx eas build --profile development --platform android   # or ios
```

Plain `npx expo start` will launch fine for UI iteration, but calling
(WebRTC) won't work until you're running the EAS dev build with the
native react-native-webrtc module linked — it requires a custom dev
client, not Expo Go.

## 5. What's intentionally not wired up

- **Play Store submission** — out of scope for this pass per your request.
  `app.json` uses `com.current.app` as the bundle ID/package — change it if
  you register something else on Play Console.
- **Background calling (CallKit/ConnectionService)** — calling is real
  WebRTC audio/video (see `src/state/callStore.ts`), but there's no native
  VoIP-push/CallKit integration, so a call backgrounded for long enough may
  get throttled by the OS. A separate, native-entitlements follow-up.
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
