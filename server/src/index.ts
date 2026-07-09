import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { ClientEvent, ServerEvent } from './protocol.js';
import { relayState } from './state.js';
import { verifyUserToken, areApprovedContacts, isBlocked, getUsername, logTransfer } from './supabaseAdmin.js';
import { pingOfflineRecipient } from './pushPing.js';

const PORT = Number(process.env.PORT) || 8787;
const AUTH_TIMEOUT_MS = 10_000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, online: relayState.onlineUserIds().length, storesMessages: false }));
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
      default:
        break;
    }
  });

  socket.on('close', () => {
    clearTimeout(authTimer);
    if (userId) {
      relayState.removeConnection(userId);
      broadcastPresence(userId, 'offline');
    }
  });
});

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
    send(socket, { type: 'message:failed', tempId: event.tempId, reason: 'recipient_offline' });
    getUsername(userId)
      .then((senderUsername) => pingOfflineRecipient(to, senderUsername))
      .catch(() => {});
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
