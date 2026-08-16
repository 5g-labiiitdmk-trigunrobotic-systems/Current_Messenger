# Group calling — architecture

Status as of this doc: **signaling foundation shipped (server + wire
protocol only); client-side calling UI/logic not started.** See "What's
built" / "What's not built" at the bottom for the precise split.

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

## What's NOT built (the actual client-side calling feature)

None of this exists yet. In rough dependency order:

1. **Client-side multi-peer connection management.** `callStore.ts`
   today has exactly one module-scope `RTCPeerConnection`, one
   `peerId: string`, one `remoteStream`. Group calling needs a
   `Map<peerId, RTCPeerConnection>` plus per-peer ICE-candidate-queue and
   remote-description state — essentially the same offer/answer/ICE
   choreography already proven for 1:1, run N-1 times per client and
   kept independent per peer.
2. **Call state redesign.** `phase`/`peerId`/`remoteStream` need to
   become call-level status plus a `participants` map/array (each with
   its own connection state, mute state, stream). This is the highest-
   risk piece to get wrong, since it's a restructuring of the file that
   *also* runs every existing 1:1 call — it should be built and tested
   very deliberately, ideally with 1:1 calling's existing behavior
   covered by regression checks before merging any change to this file.
3. **A client-side "ring the group" flow**: enumerate up to 4 members via
   `groupStore`, send one `call:signal` with `groupId` set to each,
   collect accept/decline/timeout per person (reusing the group-invite
   consent pattern's shape).
4. **New UI**: a group call screen with a participant grid (not the
   current full-bleed-remote + PIP-local layout, which assumes one
   remote party), a group-aware incoming-call screen, and an update to
   `ActiveCallBanner` (currently derives its label/route from a single
   `peerId`).
5. **New routing**: `/call/[id]` currently assumes `id` is one peer's
   userId; group calls need their own route shape (e.g.
   `/call/group/[groupId]`).
6. **The 4-participant cap enforced in the UI** (and ideally the relay
   rejecting an over-cap group-ring attempt too, once the client-side
   ring flow above exists to send one).

Steps 1-2 in particular touch the same file that all existing 1:1
calling depends on — given how much of this round already went into
other changes, and given the real risk of a half-finished touch to that
file regressing calling that already works, the deliberate choice this
round was to stop at the signaling foundation and not start restructuring
`callStore.ts` without the time to do it carefully and verify it doesn't
regress 1:1 calls.
