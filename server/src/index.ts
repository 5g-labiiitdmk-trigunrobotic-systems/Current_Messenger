import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { ClientEvent, ServerEvent } from './protocol.js';
import { relayState } from './state.js';
import { verifyUserToken, areApprovedContacts, isBlocked, getUsername, logTransfer } from './supabaseAdmin.js';
import { pingOfflineRecipient } from './pushPing.js';

const PORT = Number(process.env.PORT) || 8787;
const AUTH_TIMEOUT_MS = 10_000;

// TURN credentials are secrets — they must never be baked into the app
// bundle, so the client fetches them from the already-trusted relay server
// at call time instead. STUN alone is enough for most direct P2P
// connections; TURN only matters as a relay fallback on strict NATs, so
// it's fine for this to be a plain unauthenticated GET (the credentials
// themselves are what's gated, e.g. Metered's time-limited API keys — see
// docs/SETUP.md). If no TURN_* env vars are set, only STUN is returned.
function getIceServers(): RTCIceServerConfig[] {
  const servers: RTCIceServerConfig[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  const turnUrls = process.env.TURN_URLS;
  if (turnUrls) {
    servers.push({
      urls: turnUrls.split(',').map((u) => u.trim()),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }
  return servers;
}

interface RTCIceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, online: relayState.onlineUserIds().length, storesMessages: false }));
    return;
  }
  if (req.url === '/ice-servers') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ iceServers: getIceServers() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

function send(socket: WebSocket, event: ServerEvent) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
}

function broadcastPresence(userId: string, status: 'online' | 'offline') {
  const event: ServerEvent = { type: 'presence', userId, status, lastSeenAt: new Date().toISOString() };
  for (const id of relayState.onlineUserIds()) {
    if (id === userId) continue;
    const s = relayState.getSocket(id);
    if (s) send(s, event);
  }
}

wss.on('connection', (socket) => {
  let userId: string | null = null;

  const authTimer = setTimeout(() => {
    if (!userId) {
      send(socket, { type: 'auth:error', message: 'Auth timeout' });
      socket.close();
    }
  }, AUTH_TIMEOUT_MS);

  socket.on('message', async (raw) => {
    let event: ClientEvent;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      send(socket, { type: 'error', message: 'Malformed JSON' });
      return;
    }

    if (event.type === 'ping') {
      send(socket, { type: 'pong' });
      return;
    }

    if (event.type === 'pong') {
      // Reply to our own heartbeat ping below — see the doc comment there
      // for why this is a JSON app message instead of a native WebSocket
      // protocol-level pong control frame.
      missedPongs.set(socket, 0);
      return;
    }

    if (event.type === 'auth') {
      const id = await verifyUserToken(event.token);
      if (!id) {
        send(socket, { type: 'auth:error', message: 'Invalid or expired token' });
        socket.close();
        return;
      }
      userId = id;
      clearTimeout(authTimer);
      relayState.addConnection(userId, socket);
      send(socket, { type: 'auth:ok', userId });
      broadcastPresence(userId, 'online');
      return;
    }

    if (!userId) {
      send(socket, { type: 'error', message: 'Not authenticated — send {type:"auth"} first' });
      return;
    }
    relayState.touch(userId);

    switch (event.type) {
      case 'message:send': {
        await handleMessageSend(userId, event);
        break;
      }
      case 'typing': {
        await forwardToRecipients(userId, event.to, event.groupId, (targetId) =>
          send(relayState.getSocket(targetId)!, { type: 'typing', from: userId!, groupId: event.groupId, isTyping: event.isTyping })
        );
        break;
      }
      case 'read': {
        await forwardToRecipients(userId, event.to, event.groupId, (targetId) =>
          send(relayState.getSocket(targetId)!, { type: 'read', from: userId!, groupId: event.groupId, messageId: event.messageId })
        );
        break;
      }
      case 'presence:set': {
        broadcastPresence(userId, event.status === 'online' ? 'online' : 'offline');
        break;
      }
      case 'group:create': {
        const group = relayState.createGroup(event.groupId, event.name, userId, event.memberIds, event.isBroadcast);
        const memberIds = [...group.memberIds];
        for (const memberId of memberIds) {
          if (memberId === userId) continue;
          const s = relayState.getSocket(memberId);
          if (s) send(s, { type: 'group:invited', groupId: group.id, name: group.name, from: userId, memberIds, isBroadcast: group.isBroadcast });
        }
        send(socket, { type: 'group:created', groupId: group.id, name: group.name, memberIds, isBroadcast: group.isBroadcast });
        break;
      }
      case 'group:invite': {
        const group = relayState.getGroup(event.groupId);
        if (!group || !group.memberIds.has(userId)) break;
        relayState.addGroupMember(event.groupId, event.to);
        const s = relayState.getSocket(event.to);
        if (s) send(s, { type: 'group:invited', groupId: group.id, name: group.name, from: userId, memberIds: [...group.memberIds], isBroadcast: group.isBroadcast });
        break;
      }
      case 'group:leave': {
        relayState.removeGroupMember(event.groupId, userId);
        const group = relayState.getGroup(event.groupId);
        if (group) {
          for (const memberId of group.memberIds) {
            const s = relayState.getSocket(memberId);
            if (s) send(s, { type: 'group:member_left', groupId: event.groupId, userId: userId! });
          }
        }
        break;
      }
      case 'call:signal': {
        // Same contact-approval rule as messages — signaling payloads must
        // not reach users who never approved the sender.
        if (!(await areApprovedContacts(userId, event.to))) break;
        const s = relayState.getSocket(event.to);
        if (s) send(s, { type: 'call:signal', from: userId, signal: event.signal });
        break;
      }
      case 'session:request': {
        await handleSessionRequest(userId, event.to);
        break;
      }
      case 'session:respond': {
        handleSessionRespond(userId, event.peerId, event.accept);
        break;
      }
      default:
        break;
    }
  });

  socket.on('close', () => {
    clearTimeout(authTimer);
    missedPongs.delete(socket);
    // Guarded: if this socket already got replaced by a reconnect, it's
    // stale — its belated close must not evict the newer live connection
    // or tell everyone else the (still-online) user went offline.
    if (userId && relayState.removeConnection(userId, socket)) {
      broadcastPresence(userId, 'offline');
      const { notifyWithdrawn, notifyRejected } = relayState.clearSessionsFor(userId);
      for (const targetId of notifyWithdrawn) {
        const s = relayState.getSocket(targetId);
        if (s) send(s, { type: 'session:request_withdrawn', from: userId });
      }
      for (const requesterId of notifyRejected) {
        const s = relayState.getSocket(requesterId);
        if (s) send(s, { type: 'session:rejected', from: userId, reason: 'peer_disconnected' });
      }
    }
  });
});

// Proactive dead-connection detection. Without this, the only way the
// server learns a socket is dead is the OS/TCP layer eventually firing
// 'close' — which on mobile networks (backgrounding, carrier NAT timeouts,
// wifi/cellular handoffs) can take minutes, during which a genuinely-gone
// user still looks "online" and messages sent to them vanish silently
// (hard-fail-if-offline, no queueing). A 30s ping interval with 2 missed
// pongs tolerated (~60-90s total grace) balances catching real drops
// reasonably fast against not killing a connection over one slow/lost
// pong on a flaky real-world mobile link.
//
// Deliberately a JSON app message (ServerEvent 'ping' / ClientEvent
// 'pong'), NOT native WebSocket protocol-level ping/pong control frames
// (socket.ping() / socket.on('pong', ...)). This was the original design
// and it caused a real regression: React Native's WebSocket has
// documented, inconsistent control-frame handling across iOS/Android
// (github.com/facebook/react-native issues #23825, #30020, #14855), so
// pongs weren't reliably reaching the server even from perfectly healthy,
// actively-used connections. The server would then terminate a live
// connection every ~60-90s, which briefly flipped presence to offline
// (self-healing fast enough on reconnect to look "online" at a glance)
// but also silently wiped the chat-session state that reconnect doesn't
// automatically restore — the actual cause of "message send fails despite
// an already-accepted session." A plain JSON message has no such
// ambiguity: it's handled by the exact same ordinary code path as every
// other app message, on every platform, with no reliance on control-frame
// support at all.
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_MISSED_PONGS = 2;
const missedPongs = new WeakMap<WebSocket, number>();

setInterval(() => {
  wss.clients.forEach((socket) => {
    const missed = missedPongs.get(socket) ?? 0;
    if (missed >= MAX_MISSED_PONGS) {
      socket.terminate(); // fires 'close' above, which does the guarded cleanup
      return;
    }
    missedPongs.set(socket, missed + 1);
    send(socket, { type: 'ping' });
  });
}, HEARTBEAT_INTERVAL_MS);

async function handleMessageSend(userId: string, event: Extract<ClientEvent, { type: 'message:send' }>) {
  const socket = relayState.getSocket(userId)!;
  const messageId = crypto.randomUUID();
  const sentAt = new Date().toISOString();
  // Size of the opaque ciphertext envelope — the only thing about the message
  // body that is ever recorded anywhere. Content itself never leaves memory.
  const byteSize = Buffer.byteLength(JSON.stringify(event.payload), 'utf8');

  if (event.groupId) {
    const group = relayState.getGroup(event.groupId);
    if (!group || !group.memberIds.has(userId)) {
      send(socket, { type: 'message:failed', tempId: event.tempId, reason: 'not_group_member' });
      return;
    }
    if (group.isBroadcast && group.ownerId !== userId) {
      send(socket, { type: 'message:failed', tempId: event.tempId, reason: 'broadcast_read_only' });
      return;
    }
    let deliveredToAnyone = false;
    for (const memberId of group.memberIds) {
      if (memberId === userId) continue;
      if (!relayState.isOnline(memberId)) continue; // hard fail per-recipient, no queueing
      const targetSocket = relayState.getSocket(memberId)!;
      send(targetSocket, {
        type: 'message:receive',
        messageId,
        from: userId,
        groupId: event.groupId,
        kind: event.kind,
        payload: event.payload,
        meta: event.meta,
        sentAt,
      });
      deliveredToAnyone = true;
      logTransfer(userId, memberId, byteSize);
    }
    if (deliveredToAnyone) {
      send(socket, { type: 'message:sent', tempId: event.tempId, messageId, sentAt });
    } else {
      send(socket, { type: 'message:failed', tempId: event.tempId, reason: 'recipient_offline' });
    }
    return;
  }

  const to = event.to;
  if (!to) {
    send(socket, { type: 'error', message: 'message:send requires "to" or "groupId"' });
    return;
  }

  // Only checking isBlocked(to, userId) — "has the recipient blocked the
  // sender" — meant a user who blocked someone could still message THEM;
  // only the reverse direction was ever enforced. Blocking must cut both
  // ways.
  const [approved, recipientBlockedSender, senderBlockedRecipient] = await Promise.all([
    areApprovedContacts(userId, to),
    isBlocked(to, userId),
    isBlocked(userId, to),
  ]);
  const blocked = recipientBlockedSender || senderBlockedRecipient;
  if (blocked) {
    send(socket, { type: 'message:failed', tempId: event.tempId, reason: 'blocked' });
    return;
  }
  if (!approved) {
    send(socket, { type: 'message:failed', tempId: event.tempId, reason: 'not_contact' });
    return;
  }
  if (!relayState.isOnline(to)) {
    // ABSOLUTE CORE RULE: no queueing, no persistence. Recipient offline = hard fail.
    // Checked before the session gate below: an offline recipient can
    // never have an active session anyway (disconnecting clears it — see
    // clearSessionsFor), so this ordering just reports the more specific,
    // actionable reason instead of a technically-true-but-less-useful one.
    send(socket, { type: 'message:failed', tempId: event.tempId, reason: 'recipient_offline' });
    getUsername(userId)
      .then((senderUsername) => pingOfflineRecipient(to, senderUsername))
      .catch(() => {});
    return;
  }
  if (!relayState.hasActiveSession(userId, to)) {
    // Long-term contact approval is necessary but no longer sufficient —
    // every fresh session (see state.ts) needs its own accept too. The
    // client is expected to have already sent session:request when the
    // chat screen opened rather than relying on this to trigger one as a
    // side effect, so this is a hard stop, not an implicit request.
    send(socket, { type: 'message:failed', tempId: event.tempId, reason: 'session_not_approved' });
    return;
  }

  const targetSocket = relayState.getSocket(to)!;
  send(targetSocket, {
    type: 'message:receive',
    messageId,
    from: userId,
    kind: event.kind,
    payload: event.payload,
    meta: event.meta,
    sentAt,
  });
  send(socket, { type: 'message:sent', tempId: event.tempId, messageId, sentAt });
  logTransfer(userId, to, byteSize);
}

// How long a target has to accept/decline before the requester is told
// there's been no response. Longer than the call ring timeout (45s) since
// this is asynchronous by nature — the target may not have the app open
// at all — not a live, urgent ring.
const SESSION_REQUEST_TIMEOUT_MS = 60_000;

async function handleSessionRequest(userId: string, to: string) {
  const socket = relayState.getSocket(userId)!;
  if (!(await areApprovedContacts(userId, to))) {
    send(socket, { type: 'session:request_failed', to, reason: 'not_contact' });
    return;
  }
  if (relayState.hasActiveSession(userId, to)) {
    // Already accepted (e.g. a stale re-request from a client that hasn't
    // caught up) — just re-confirm rather than re-asking.
    send(socket, { type: 'session:accepted', from: to });
    return;
  }
  // Glare: the other side already asked us and we haven't answered yet —
  // messaging them back is itself consent, so resolve both directions at
  // once instead of leaving two pending requests deadlocked on each other.
  const reversePending = relayState.getPendingSession(to, userId);
  if (reversePending && reversePending.requesterId === to) {
    relayState.resolveSession(userId, to, true);
    send(socket, { type: 'session:accepted', from: to });
    const targetSocket = relayState.getSocket(to);
    if (targetSocket) send(targetSocket, { type: 'session:accepted', from: userId });
    return;
  }

  const targetSocket = relayState.getSocket(to);
  if (!targetSocket) {
    // Can't ask someone who isn't here — consistent with the rest of this
    // relay's hard-fail-if-offline rule, no pending state is created.
    send(socket, { type: 'session:request_failed', to, reason: 'recipient_offline' });
    return;
  }

  relayState.requestSession(userId, to);
  // Captured so this specific timer can tell "still my own still-pending
  // request" apart from "A re-requested after I'd already have timed out,
  // and that newer request happens to share the same pairKey" — without
  // this, a stale timer from an earlier request could prematurely reject
  // a fresh one that A re-sent in the meantime.
  const requestedAt = relayState.getPendingSession(userId, to)!.requestedAt;
  send(socket, { type: 'session:requested', to });
  send(targetSocket, { type: 'session:request', from: userId });

  setTimeout(() => {
    const pending = relayState.getPendingSession(userId, to);
    if (!pending || pending.requesterId !== userId || pending.requestedAt !== requestedAt) return;
    relayState.clearPendingSession(userId, to);
    const requesterSocket = relayState.getSocket(userId);
    if (requesterSocket) send(requesterSocket, { type: 'session:rejected', from: to, reason: 'timeout' });
  }, SESSION_REQUEST_TIMEOUT_MS);
}

function handleSessionRespond(userId: string, peerId: string, accept: boolean) {
  const pending = relayState.getPendingSession(peerId, userId);
  if (!pending || pending.requesterId !== peerId || pending.targetId !== userId) return; // no matching pending request — ignore
  relayState.resolveSession(userId, peerId, accept);
  const requesterSocket = relayState.getSocket(peerId);
  if (!requesterSocket) return; // requester disconnected in the meantime; clearSessionsFor already handled notifying (moot) or will on their close
  send(requesterSocket, accept ? { type: 'session:accepted', from: userId } : { type: 'session:rejected', from: userId, reason: 'declined' });
}

async function forwardToRecipients(userId: string, to: string | undefined, groupId: string | undefined, sendFn: (targetId: string) => void) {
  if (groupId) {
    const group = relayState.getGroup(groupId);
    if (!group || !group.memberIds.has(userId)) return;
    for (const memberId of group.memberIds) {
      if (memberId !== userId && relayState.isOnline(memberId)) sendFn(memberId);
    }
    return;
  }
  // Typing/read receipts are metadata about a conversation — only deliverable
  // between approved contacts, same as the messages themselves.
  if (to && relayState.isOnline(to) && (await areApprovedContacts(userId, to))) sendFn(to);
}

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[relay] listening on :${PORT} — zero message persistence, in-memory only`);
});
