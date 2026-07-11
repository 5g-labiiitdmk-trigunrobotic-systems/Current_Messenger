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

class RelayState {
  private connections = new Map<string, Connection>(); // userId -> connection
  private groups = new Map<string, Group>();

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
