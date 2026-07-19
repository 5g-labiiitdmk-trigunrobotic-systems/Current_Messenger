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

**Known limitation — resend uses Supabase's own rate-limited default
mailer.** No custom SMTP is configured (see above), so both the original
signup email and any `auth.resend()` call go through Supabase's shared
built-in email service, which enforces a low per-project rate limit
specifically because it's meant for development/testing, not real user
traffic (historically a handful of emails per hour). This is the most
likely explanation if a resend silently doesn't arrive shortly after the
original signup email did — the client already surfaces whatever error
Supabase returns (`verify-email.tsx`'s `onResend`), so check that alert's
message first. Fix: configure a custom SMTP provider under **Auth → Emails
→ SMTP Settings** in the Supabase dashboard (Resend is a reasonable choice
— free tier, simple API-key setup). Can't be fixed from application code.

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
`app.json`.

**Resolved.** `android.package` in `app.json` was changed from
`com.current.app` to `com.trigunrobotics.current` (the old name was
already claimed by another app on the Play Store). `app/google-services.json`
now has a Firebase Android app registered under
`com.trigunrobotics.current` (it's a second `client[]` entry alongside
the original `com.current.app` one — Firebase allows multiple Android
apps per project in one file, and the Google Services Gradle plugin
picks whichever entry's `package_name` matches `android.package` at
build time, so having both is harmless). No other config change was
needed — `android.googleServicesFile` already pointed at this same
path.

If phone verification comes back later (e.g. once Blaze is
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

## 2.5 Push notifications — REQUIRED: FCM V1 service account in the Expo project

**This is almost certainly why push notifications don't arrive at all on
Android, even with OS-level notification permission granted.** This app
sends push via Expo's push service (`Notifications.getExpoPushTokenAsync()`
+ `https://exp.host/--/api/v2/push/send` — see `src/lib/push.ts` and
`server/src/pushPing.ts`), not raw FCM directly. Expo's push service is
just a relay in front of FCM/APNs — for the Android leg specifically, Expo
needs *your* Firebase project's own FCM credentials to actually deliver to
FCM on your behalf.

Google shut down the legacy FCM HTTP API in June 2024. Every Expo project
now needs a **Firebase Cloud Messaging V1 service account key** uploaded to
the Expo/EAS project (Expo dashboard → your project → Project settings →
Credentials → Android → **Google Service Account**, or `eas credentials` →
Android → Push Notifications: Google Service Account Key). Without it,
every push this app sends to an Android device fails — not with a client-
side error (permission is still reported as granted, the app never sees
anything wrong), but with an error status inside Expo's push receipt,
visible only in the *relay's* logs (`[push] Expo push send failed: ...` /
`[push] Expo call push send failed: ...` — see `server/src/pushPing.ts`).
**Check Render's logs for those lines first** if push seems totally silent
— that error message will say exactly what's misconfigured.

To generate the service account key: Firebase console → the `current-7798d`
project (see section 2 above) → Project settings → Service accounts →
Generate new private key. Upload the resulting JSON to Expo via either path
above. This is a one-time, per-Expo-project setup step — not something any
code change here can do for you, and not something that belongs in this
repo (it's a credential).

Also worth ruling out while debugging push: **`getExpoPushTokenAsync` only
returns a real, receivable token from a custom dev/production build** (EAS
build with this project's own `google-services.json` baked in — see
section 4) — Expo Go does not support remote push on Android as of recent
SDKs. If you're testing via Expo Go, that alone would explain zero
delivery regardless of the FCM credential above.

`src/lib/push.ts` now logs the full token-registration lifecycle
(`[push] obtained Expo push token: ...`, `[push] push token stored for
user ...`, or the specific failure) — check Metro/logcat output on the
device to confirm registration itself is succeeding before assuming the
server-side send is the problem.

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

## 3.6 Map tiles for shared locations (Android)

Shared-location messages render an actual map (not raw coordinates) — a
static tile mosaic on Android, a real interactive `react-native-maps` view
on iOS (Apple MapKit, no key needed, nothing to set up). Android's tiles
used to hotlink `tile.openstreetmap.org` directly, OSM's own free
volunteer-run tile server — that server has since started blocking this
app's traffic for not following its production-usage policy (it's meant
for light/evaluation use, not app traffic at any real scale), so that path
is retired for good.

Sign up for **[MapTiler](https://www.maptiler.com)** instead — free tier is
100,000 tile loads/month, no card required, and it's explicitly built for
this kind of app usage (unlike OSM's own server). From their dashboard,
grab your API key and set it in `app/.env`:

```
EXPO_PUBLIC_MAPTILER_API_KEY=<from MapTiler dashboard>
```

Unlike the TURN credentials above, this key is safe to bake directly into
the app bundle via the `EXPO_PUBLIC_` prefix (same category as
`EXPO_PUBLIC_SUPABASE_ANON_KEY`) — MapTiler's keys are designed for direct
client embedding and can optionally be domain/bundle-ID restricted from
their dashboard, unlike TURN's shared-secret relay credentials, which must
never leave the server. Leave it unset and shared-location messages on
Android fall back to a plain coordinate bubble instead of a map — nothing
crashes, and it never falls back to hotlinking OSM's server again.

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
client, not Expo Go. Real audio-route selection (earpiece/speaker/
Bluetooth) and the in-call ringtone need the same rebuild, since they're
also a native module (react-native-incall-manager — see
`src/lib/callAudio.ts`), not something a JS-only update to an existing
dev client picks up.

## 5. What's intentionally not wired up

- **Play Store submission** — `app.json`'s `android.package` is
  `com.trigunrobotics.current`. It was originally `com.current.app`, but
  that name was already claimed by another app on the Play Store,
  discovered during Play Console submission, so it was changed. The iOS
  `bundleIdentifier` is a separate namespace (App Store, not Play Store)
  and was intentionally left as `com.current.app` — nothing showed that
  one was taken, and the two platforms don't share a namespace, so there
  was no reason to change it too. `google-services.json` now has a
  Firebase Android app registered under `com.trigunrobotics.current` —
  see the FCM section above for details.
- **Background calling (CallKit/ConnectionService)** — calling is real
  WebRTC audio/video (see `src/state/callStore.ts`), but there's no native
  VoIP-push/CallKit integration, so a call backgrounded for long enough may
  get throttled by the OS. A separate, native-entitlements follow-up.
- **Full-screen-intent incoming-call notification (auto-launching the
  incoming-call UI over the lock screen, not just ringing)** — investigated;
  `expo-notifications` has zero support for Android full-screen intent at
  any layer (confirmed against its native Android source directly, not
  just its JS types — no field, no hook). The real fix is `@notifee/react-
  native` (its `android.fullScreenAction` is exactly this), but it requires
  the call push to become a *data-only* message instead of the notification-
  message it is today, so notifee's own handler is the sole thing that ever
  displays it — Android auto-displays a notification-message the instant it
  arrives, before any JS gets a chance to run, so a client-side-only add-on
  can't intercept or replace that. Changing the server payload shape
  (`server/src/pushPing.ts`) affects every client immediately, including
  anyone not yet running a build with the matching notifee handler — they'd
  get a data-only push their client doesn't know how to display, i.e.
  silent call notifications, a regression. That needs a coordinated
  server+client rollout (and a real device to verify — full-screen-intent
  behavior isn't observable in this project's web-based verification
  workflow at all), not a change bundled into an unrelated patch. Left
  unimplemented on purpose rather than shipped half-verified.
  `android.permission.USE_FULL_SCREEN_INTENT` has already been added to
  `app.json` as the one safe, needed-either-way piece of groundwork.
- **AR filters, mini-games, voice changer, doodle, co-watching, business
  profiles, bots, widget presence, topics within groups** — UI shells only
  (`app/lab/`), per the agreed scope. See `src/data/labFeatures.ts` for what
  each would take to actually build.
- **Payments** — explicitly deferred per your instructions; nothing here.

## 6. The zero-*server*-storage guarantee, concretely

Message content is now persisted **on-device only** (`src/lib/localDb.ts`,
SQLite/SQLCipher — see below) — this was a deliberate architecture change
away from the original fully-ephemeral design. The guarantee that still
holds, unchanged, is that the server side never stores it:

- Message content only ever exists as JS objects in transit through the
  relay server's request handler (`server/src/index.ts`) — never written to
  a variable that outlives the function call, never logged, never in
  Supabase or any server-side database.
- Supabase Postgres holds exactly 4 tables (`supabase/migrations/0001_init.sql`):
  accounts, contact approvals, blocks, and public encryption keys. Grep the
  schema — there is no messages/history table to remove by accident later.
- Local chat history (`src/lib/localDb.ts`) is a separate SQLite database
  per (user, device), encrypted at rest via SQLCipher (expo-sqlite's
  built-in support, enabled via the `useSQLCipher` plugin option in
  app.json) with a random 256-bit key generated once per account and held
  only in the platform secure enclave (`expo-secure-store` — iOS Keychain /
  Android Keystore), never derived from the password, never synced
  anywhere. It never syncs to another device or to any server — losing the
  device means losing that device's local history, same as losing any
  other on-device-only secret. **Requires a custom dev/production build**,
  same as calling — SQLCipher isn't available in Expo Go.
- Group identity/membership lives only in the relay server's in-memory `Map`
  (`server/src/state.ts`). Restart the relay and every group is gone —
  members just re-invite each other, which takes one tap.
