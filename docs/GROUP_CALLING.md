# Group calling — architecture

Status as of this doc: **client-side calling built** (mesh peer
connections, ring/accept/decline/hangup flow, grid UI, entry points from
group chat) **on top of the signaling foundation from the prior round.**
Verified: type-checks, a real Metro bundle export, and a live Playwright
load of the new routes with zero runtime errors. **Not verified**: actual
multi-device mesh connectivity, audio/video quality with 3-4 real
participants, or real TURN bandwidth behavior — none of that is
testable outside a real multi-device environment. See "What's built" /
"What's not built" at the bottom for the precise, updated split.

## Topology decision: mesh, not SFU

Two ways to build group calling on top of existing 1:1 WebRTC calling:

- **Mesh (peer-to-peer)**: every participant opens a direct WebRTC
  connection to every other participant. N participants means each
  client manages N-1 peer connections and uploads its own media stream
  N-1 times.
- **SFU (Selective Forwarding Unit)**: every participant uploads their
  stream once, to a central media server, which forwards it to everyone
  else. Uploads don't multiply with group size; the server does.

**This app uses mesh.** The deciding factors, specific to this app's
actual infrastructure (not a general "mesh vs SFU" tradeoff):

1. **There is no media server today, and standing one up is a different
   project.** An SFU (e.g. self-hosted mediasoup/Janus/LiveKit, or a
   hosted SFU service) is new infrastructure this relay doesn't have —
   it's not "extend the relay," it's "add a second server." The relay
   itself (Render free/low tier, Node/`ws`) has never handled media, only
   opaque signaling payloads it doesn't inspect.
2. **The explicit ask was to extend the existing signaling-through-relay
   pattern with the existing STUN/TURN setup** — mesh is what that
   describes. SFU would mean designing and operating an entirely new
   piece of infrastructure, with its own cost, its own failure modes, and
   its own unverified-in-this-sandbox native/server risk, on top of
   everything already shipped this round.
3. **Mesh reuses almost everything that already exists**: the
   `/ice-servers` endpoint, `RTCPeerConnection` usage patterns, the
   `call:signal` relay path (now group-aware, see below), and the
   existing 1:1 offer/answer/ICE-candidate choreography — just N-1 times
   instead of once per client.

The real cost of choosing mesh is that it doesn't scale — see the next
section for exactly how far it goes on this app's infrastructure.

## Scale limit: cap group calls at 4 participants

Two independent constraints, either one enough to justify the cap:

**Upload bandwidth (device-side).** In a mesh call with N participants,
each device uploads its own stream N-1 times simultaneously (once per
peer connection). A modest mobile video bitrate is roughly 250-500kbps.
At N=4, that's 3 simultaneous uploads (~0.75-1.5Mbps) — comfortable on
WiFi or decent LTE. At N=6, that's 5 uploads (~1.25-2.5Mbps each
direction) — the point where weaker connections start dropping frames or
disconnecting, and where phone CPU/battery cost from encoding N-1
simultaneous streams also starts to matter. 4 is the widely-used
practical ceiling for mesh video calling industry-wide (this is why
FaceTime/Skype-era mesh implementations topped out in the same range
before moving to SFUs for larger calls).

**TURN budget (server-side, the sharper constraint for this app
specifically).** Per `docs/SETUP.md` §3.5, the recommended TURN provider
is Metered.ca's **free tier: 500MB relayed bandwidth/month, for the
entire app, not per call**. TURN is only invoked when a direct
peer-to-peer path fails (common on mobile carrier NAT and corporate
Wi-Fi) — but when it does, mesh means TURN relays that pair's stream
independently of every other pair in the call. A single 5-minute, 4-way
video call where even one participant is behind a TURN-requiring NAT can
burn through tens of MB just for that one call's relayed legs. At this
app's current free-tier budget, a handful of group calls in a month
could exhaust the entire app's TURN allowance — degrading or breaking
**all** calling (1:1 included, since they share the same TURN
credentials) until the next billing cycle. This is a real, concrete risk
that gets worse at any group size above the current cap, not a
theoretical one.

**Recommendation: hard-cap group calls at 4 participants** (initiator +
3 others), enforced both client-side (once built — disable/grey out
"start call" beyond 4, or only ring the first 4 members of a larger
group) and, ideally, server-side (reject a group-ring signal targeting
more than 4 people). If real usage shows this cap is too restrictive,
the next step is evaluating a real SFU, not raising the mesh cap further
— mesh past ~4-5 degrades regardless of TURN budget.

## What's reused unchanged

- `/ice-servers` endpoint and `fetchIceServers()` — works for any number
  of peer connections, no change needed.
- `RTCPeerConnection`/`RTCSessionDescription`/`RTCIceCandidate` usage
  patterns from 1:1 calling (`app/src/lib/webrtc.ts`) — same primitives,
  instantiated N-1 times per client instead of once.
- Group membership as the call roster: `Group.memberIds` / server's
  `getGroupsForUser`/`isGroupMember`, and the client's `groupStore.ts`
  mirror — this is exactly "who could this group call ring."
- The existing group-invite consent pattern (request → explicit
  accept/decline/timeout, with disconnect cleanup) as a structural
  template for per-participant call state — ringing N people and
  tracking who's joined/declined/timed out individually is the same
  shape of problem groups already solved for membership invites.

## What's built this round (server + wire protocol only)

All changes are strictly additive — every existing 1:1 call code path is
untouched and behaves byte-identically to before when no `groupId` is
present. Verified via an isolated script exercising the real
`RelayState` class directly (10 assertions, all passing) before this was
written up.

- **`call:signal` gained an optional `groupId` field** (both
  `ClientEvent` and `ServerEvent`, mirrored in
  `server/src/protocol.ts` and `app/src/types/relay.ts`). The `signal`
  payload itself was already opaque (`Record<string, unknown>`), so no
  wire-shape changes were needed for the actual SDP/ICE/ring content —
  only this one new routing field.
- **The relay's `call:signal` handler gates on group membership instead
  of 1:1 contact approval when `groupId` is present**
  (`server/src/index.ts`): `isGroupMember(groupId, sender) &&
  isGroupMember(groupId, target)`, reusing the same `isGroupMember` group
  chat already relies on. Absent `groupId`, the gate is the exact same
  `areApprovedContacts` call as before.
- **`ActiveRing` (the relay's "someone is currently ringing this person"
  record, used to replay a ring to a client that reconnects after it was
  sent) gained an optional `groupId`** so a replayed group-call ring
  carries that context through on reconnect, same as a live one would.
  `recordRing`'s new 4th parameter is optional — every existing call site
  is unaffected.

This means: the relay can now correctly gate and route an individual
call-signaling message addressed `to` one specific group member, tagged
with which group it belongs to, distinct from a 1:1 call to that same
person. It does **not** yet mean group calling works end-to-end — see
below.

## What's built this round (client-side calling)

Built as a fully **parallel, independent store** — `app/src/state/groupCallStore.ts`
— rather than a restructuring of `callStore.ts`. The earlier plan above
(items 1-2) assumed extending `callStore.ts`'s single-`RTCPeerConnection`
shape in place; in practice, keeping 1:1 calling's file completely
unmodified turned out to be both safer and not meaningfully harder than
threading group support through it, since the two call types share no
runtime state (a device is never on a 1:1 and group call simultaneously)
and only need to *coordinate* busy-detection, not share connection logic.

- **`groupCallStore.ts`**: `Map<peerId, RTCPeerConnection>` (module-scope,
  mirroring `callStore.ts`'s single `pc` but N-1 of them), per-peer
  ICE-candidate queues and remote-description flags, a `participants`
  record keyed by userId with per-participant status/stream. Mesh
  bootstrap protocol (no central call-session coordinator — see below):
  the initiator rings each target individually with the full roster
  attached to the ring payload; whoever joins (initiator immediately, a
  callee on accept) broadcasts an accept to every other roster member;
  a pairwise connection is created once both sides are known-joined, with
  the lexicographically-lower userId always offering (deterministic,
  glare-free, no join-order coordination needed). Full reasoning in that
  file's own top-of-file comment.
- **Ring/accept/decline/busy/timeout/hangup flow**, per-participant, with
  the same 45s ring timeout and 30s connecting-timeout backstops 1:1
  calling has — but per-peer, not call-wide, so one participant timing
  out or failing doesn't end the call for everyone else already connected.
- **Grid UI**: `app/app/call/group/[groupId].tsx` (in-call, dynamic
  columns/rows sized to participant count) and
  `app/app/incoming-group-call.tsx` (group-aware incoming screen) — both
  new, parallel files, not branches of the 1:1 `call/[id].tsx` /
  `incoming-call.tsx`. `GroupActiveCallBanner.tsx` is the group
  counterpart to `ActiveCallBanner.tsx`, same reasoning.
- **Entry point**: voice/video call buttons in `group-chat/[id].tsx`'s
  header, capped client-side at `GROUP_CALL_CAP` (4) — a group larger
  than that only rings the first 3 other members, with an explicit
  confirmation prompt before doing so.
- **The one necessary touch to `callStore.ts`**: a single early-return
  guard (`if (event.groupId) return;`) in its signal listener — without
  it, a group call's signaling (which rides the identical `call:signal`
  wire message) would also match 1:1's switch statement and get
  misinterpreted as a direct call from that sender. This is the only line
  changed in that file; every other 1:1 code path is byte-identical to
  before.

**Known, deliberate limitations, not oversights:**

- No true "discover and join a call in progress" for a group member who
  wasn't in the original up-to-4 ring set — there's no server-side
  "who's currently in this group's call" roster to query, and adding one
  would mean extending the relay beyond the signaling-only contract this
  document already described as sufficient. "Joining in progress" here
  means accepting a ring you already received, whenever you get to it.
- No remote mute/camera-state signaling — a participant's own mute/camera
  toggle only affects their own track locally (`.enabled = false`, same
  mechanism 1:1 calling already uses); other participants have no way to
  see "they're muted" without an additional signal type, not added this
  round to keep scope contained.
- No CallKit/ConnectionService-equivalent background handling for group
  calls, same limitation `callStore.ts` already documents for 1:1.
- **Entirely unverified beyond type-checking, a real Metro bundle export,
  and a live Playwright load with zero runtime errors**: actual mesh
  WebRTC connectivity between real devices, audio/video quality with 3-4
  live participants, and real TURN bandwidth behavior under the mesh
  multiplication described above. None of that is testable outside a
  real multi-device environment — no amount of sandbox verification
  substitutes for it.
