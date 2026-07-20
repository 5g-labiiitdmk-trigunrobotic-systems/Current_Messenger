import type { WebSocket } from 'ws';

/**
 * ALL state in this file lives in process memory only. Nothing here is ever
 * written to disk or a database. A server restart/deploy wipes everything —
 * that is intentional, not a bug: it's the zero-persistence guarantee.
 */

interface Connection {
  userId: string;
  socket: WebSocket;
  lastSeenAt: number;
}

interface Group {
  id: string;
  name: string;
  ownerId: string;
  memberIds: Set<string>;
  admins: Set<string>;
  isBroadcast: boolean;
  createdAt: number;
}

interface PendingSession {
  requesterId: string;
  targetId: string;
  requestedAt: number;
}

interface PendingGroupInvite {
  groupId: string;
  inviterId: string;
  inviteeId: string;
  requestedAt: number;
}

interface ActiveRing {
  callerId: string;
  callKind: 'voice' | 'video';
  ringSentAt: number;
}

// Matches callStore.ts's own RING_TIMEOUT_MS — a ring record older than
// this is treated as dead even if nothing ever explicitly cleared it (e.g.
// the caller's app crashed instead of cleanly sending 'timeout'/'hangup').
const RING_STALE_MS = 50_000;

class RelayState {
  private connections = new Map<string, Connection>(); // userId -> connection
  private groups = new Map<string, Group>();

  /**
   * Tracks "is someone currently ringing this user right now" — the one
   * piece of call state the relay keeps, purely so a client that connects
   * (or reconnects) *after* the original 'ring' signal was sent can still
   * learn about it and see a proper ringing screen, instead of the ring
   * having been silently dropped because their socket didn't exist yet
   * (see the call:signal case in index.ts — signals to an offline user are
   * otherwise just discarded, same as everything else this relay forwards).
   * This is the single most common real path to an incoming call: the
   * receiver's app was fully closed, a push notification arrived, and they
   * reopen the app (by tapping the notification or the icon) *after* the
   * original signal already came and went.
   *
   * Deliberately as ephemeral as everything else here — cleared the moment
   * the call resolves one way or another (see clearRing's call sites in
   * index.ts) or after RING_STALE_MS, whichever comes first. Not a general
   * call-history/state store; it only ever answers "is there a ring
   * pending for this specific person right now."
   */
  private activeRings = new Map<string, ActiveRing>(); // calleeId -> ring

  /**
   * Per-session chat requests, on top of (not instead of) the long-term
   * contact-approval gate in supabaseAdmin.ts's areApprovedContacts(). A
   * "session" here means: both people have been continuously connected to
   * the relay since the session was last accepted. The moment either side
   * disconnects, the session is gone — reconnecting requires a fresh
   * request+accept, even between two already-approved contacts. This ties
   * session validity to the one piece of state the relay already tracks
   * (live connections), consistent with the relay's zero-persistence,
   * live-only design — there's no separate expiry timer or stored history,
   * it's just "are you both still here right now."
   *
   * Deliberately in-memory only, like everything else here: a relay
   * restart resets all sessions, same as it resets presence and groups.
   */
  private activeSessions = new Set<string>(); // canonical pairKey
  private pendingSessions = new Map<string, PendingSession>(); // canonical pairKey -> request

  /**
   * Pending group-membership invites, same "request must be accepted"
   * model as pendingSessions above, reused rather than reinvented — an
   * invite doesn't make someone a member until they respond. Keyed by
   * `${groupId}:${inviteeId}` (not a pair-sorted key like sessions, since
   * this is inherently one-directional: the group is inviting a specific
   * person, not two peers requesting each other).
   */
  private pendingGroupInvites = new Map<string, PendingGroupInvite>();

  private pairKey(a: string, b: string): string {
    return [a, b].sort().join(':');
  }

  addConnection(userId: string, socket: WebSocket) {
    this.connections.set(userId, { userId, socket, lastSeenAt: Date.now() });
  }

  /**
   * Only removes the connection if `socket` is still the one currently
   * registered for `userId`. This matters because a reconnect (network
   * handoff, app backgrounding, etc.) replaces the map entry with a new
   * socket via addConnection() *before* the old socket's TCP-level 'close'
   * event necessarily fires — that belated close event used to call this
   * with no way to tell it was stale, deleting the brand-new live
   * connection and broadcasting a false "offline" for a genuinely-online
   * user. Returns whether anything was actually removed, so the caller
   * only broadcasts "offline" for a real disconnect, not a stale one.
   */
  removeConnection(userId: string, socket: WebSocket): boolean {
    const current = this.connections.get(userId);
    if (!current || current.socket !== socket) return false;
    this.connections.delete(userId);
    return true;
  }

  getSocket(userId: string): WebSocket | undefined {
    return this.connections.get(userId)?.socket;
  }

  isOnline(userId: string): boolean {
    return this.connections.has(userId);
  }

  onlineUserIds(): string[] {
    return [...this.connections.keys()];
  }

  touch(userId: string) {
    const c = this.connections.get(userId);
    if (c) c.lastSeenAt = Date.now();
  }

  hasActiveSession(a: string, b: string): boolean {
    return this.activeSessions.has(this.pairKey(a, b));
  }

  getPendingSession(a: string, b: string): PendingSession | undefined {
    return this.pendingSessions.get(this.pairKey(a, b));
  }

  requestSession(requesterId: string, targetId: string) {
    this.pendingSessions.set(this.pairKey(requesterId, targetId), { requesterId, targetId, requestedAt: Date.now() });
  }

  /** Resolves a pending request. `accepted: false` also revokes any existing active session. */
  resolveSession(a: string, b: string, accepted: boolean) {
    const key = this.pairKey(a, b);
    this.pendingSessions.delete(key);
    if (accepted) this.activeSessions.add(key);
    else this.activeSessions.delete(key);
  }

  clearPendingSession(a: string, b: string) {
    this.pendingSessions.delete(this.pairKey(a, b));
  }

  recordRing(callerId: string, calleeId: string, callKind: 'voice' | 'video') {
    this.activeRings.set(calleeId, { callerId, callKind, ringSentAt: Date.now() });
  }

  /** Returns the pending ring for this callee, or undefined if there is
   * none or it's older than RING_STALE_MS (treated as dead). */
  getActiveRingFor(calleeId: string): ActiveRing | undefined {
    const ring = this.activeRings.get(calleeId);
    if (!ring) return undefined;
    if (Date.now() - ring.ringSentAt > RING_STALE_MS) {
      this.activeRings.delete(calleeId);
      return undefined;
    }
    return ring;
  }

  clearRing(calleeId: string) {
    this.activeRings.delete(calleeId);
  }

  /**
   * Called on disconnect. Ends every session (active or pending) involving
   * this user and reports who needs telling what, so index.ts can send the
   * right event to each — an already-*active* session ending needs no
   * extra notice (the existing presence:offline broadcast already covers
   * it contextually), but a *pending* request left hanging by either side
   * disconnecting would otherwise leave the other party's UI stuck.
   */
  clearSessionsFor(userId: string): { notifyWithdrawn: string[]; notifyRejected: string[] } {
    const notifyWithdrawn: string[] = []; // this user was the requester — tell the target their prompt is moot
    const notifyRejected: string[] = []; // this user was the target — tell the requester it failed

    for (const key of [...this.activeSessions]) {
      const [x, y] = key.split(':');
      if (x === userId || y === userId) this.activeSessions.delete(key);
    }
    for (const [key, pending] of [...this.pendingSessions]) {
      if (pending.requesterId === userId) {
        notifyWithdrawn.push(pending.targetId);
        this.pendingSessions.delete(key);
      } else if (pending.targetId === userId) {
        notifyRejected.push(pending.requesterId);
        this.pendingSessions.delete(key);
      }
    }
    return { notifyWithdrawn, notifyRejected };
  }

  // Only the owner becomes a member immediately — everyone else the
  // creator wants to add goes through the same invite-consent flow as
  // group:invite (see handleGroupInviteRequest in index.ts), instead of
  // being added directly the moment the group is created.
  createGroup(id: string, name: string, ownerId: string, isBroadcast = false): Group {
    const group: Group = {
      id,
      name,
      ownerId,
      memberIds: new Set([ownerId]),
      admins: new Set([ownerId]),
      isBroadcast,
      createdAt: Date.now(),
    };
    this.groups.set(id, group);
    return group;
  }

  getGroup(id: string): Group | undefined {
    return this.groups.get(id);
  }

  /** Every group this user currently belongs to — used to snapshot their
   * group list right after auth, the same way presence:snapshot covers
   * online status. Without this, a client that reconnects (including a
   * plain app relaunch, since nothing here is persisted client-side
   * either — see groupStore.ts) had no way to learn which groups it was
   * already in; the relay never told it unless something else happened
   * to re-trigger a group:invited/group:created for that group. */
  getGroupsForUser(userId: string): Group[] {
    return [...this.groups.values()].filter((g) => g.memberIds.has(userId));
  }

  addGroupMember(groupId: string, userId: string) {
    this.groups.get(groupId)?.memberIds.add(userId);
  }

  removeGroupMember(groupId: string, userId: string) {
    const g = this.groups.get(groupId);
    if (!g) return;
    g.memberIds.delete(userId);
    g.admins.delete(userId);
    if (g.memberIds.size === 0) this.groups.delete(groupId);
  }

  isGroupMember(groupId: string, userId: string): boolean {
    return this.groups.get(groupId)?.memberIds.has(userId) ?? false;
  }

  private groupInviteKey(groupId: string, inviteeId: string): string {
    return `${groupId}:${inviteeId}`;
  }

  requestGroupInvite(groupId: string, inviterId: string, inviteeId: string) {
    this.pendingGroupInvites.set(this.groupInviteKey(groupId, inviteeId), { groupId, inviterId, inviteeId, requestedAt: Date.now() });
  }

  getPendingGroupInvite(groupId: string, inviteeId: string): PendingGroupInvite | undefined {
    return this.pendingGroupInvites.get(this.groupInviteKey(groupId, inviteeId));
  }

  clearPendingGroupInvite(groupId: string, inviteeId: string) {
    this.pendingGroupInvites.delete(this.groupInviteKey(groupId, inviteeId));
  }

  /** Called on disconnect — drops any invites waiting on this user's
   * response so they don't linger forever unanswered by someone who's
   * gone. Mirrors clearSessionsFor's disconnect cleanup, but doesn't need
   * to notify inviters the way that one notifies session requesters: an
   * invite has no live "waiting" UI state on the inviter's side to unstick,
   * just a pending timeout that will fire and tell them 'timeout' anyway if
   * this player never reconnects to respond. */
  clearPendingGroupInvitesFor(userId: string) {
    for (const [key, invite] of [...this.pendingGroupInvites]) {
      if (invite.inviteeId === userId) this.pendingGroupInvites.delete(key);
    }
  }
}

export const relayState = new RelayState();
