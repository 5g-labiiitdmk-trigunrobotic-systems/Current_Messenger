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

class RelayState {
  private connections = new Map<string, Connection>(); // userId -> connection
  private groups = new Map<string, Group>();

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

  createGroup(id: string, name: string, ownerId: string, memberIds: string[], isBroadcast = false): Group {
    const group: Group = {
      id,
      name,
      ownerId,
      memberIds: new Set([ownerId, ...memberIds]),
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
}

export const relayState = new RelayState();
