// Wire protocol for the relay. Mirrored in app/src/types/relay.ts — keep both in sync.
// Every payload field is opaque ciphertext (or plain JSON metadata like "isTyping");
// the relay never inspects, logs, or stores message contents.

export type MessageKind =
  | 'text'
  | 'voice'
  | 'media'
  | 'sticker'
  | 'reaction'
  | 'edit'
  | 'pin'
  | 'unpin'
  | 'forward'
  | 'reply'
  | 'poll'
  | 'poll_vote'
  | 'location'
  | 'mood'
  | 'mention'
  | 'game'
  | 'doodle'
  | 'call_signal';

export interface EncryptedPayload {
  nonce: string;
  ciphertext: string;
}

export type ClientEvent =
  | { type: 'auth'; token: string }
  | { type: 'message:send'; tempId: string; to?: string; groupId?: string; kind: MessageKind; payload: EncryptedPayload; meta?: Record<string, unknown> }
  | { type: 'typing'; to?: string; groupId?: string; isTyping: boolean }
  | { type: 'read'; to?: string; groupId?: string; messageId: string }
  | { type: 'presence:set'; status: 'online' | 'away' }
  | { type: 'group:create'; groupId: string; name: string; memberIds: string[]; isBroadcast?: boolean }
  | { type: 'group:invite'; groupId: string; to: string }
  | { type: 'group:leave'; groupId: string }
  | { type: 'call:signal'; to: string; signal: Record<string, unknown> }
  // contact_requests rows are written directly from the client to Supabase
  // (see contactStore.ts) — the relay never sees that insert happen, so it
  // has no other way to know a contact request needs a push notification.
  // This is purely a "go check your push_token and maybe notify them"
  // trigger — Supabase's contact_requests table remains the actual source
  // of truth, this carries no request data of its own.
  | { type: 'contact:request_sent'; to: string }
  // contact_requests has no working live-update path on its own — Supabase
  // Realtime's postgres_changes requires the table to be explicitly added
  // to the supabase_realtime publication, which was never done (see the
  // matching ServerEvent below) — so this doubles as the trigger for a
  // live UI refresh on the recipient's side, not just the push ping.
  | { type: 'contact:request_responded'; to: string }
  | { type: 'session:request'; to: string }
  | { type: 'session:respond'; peerId: string; accept: boolean }
  | { type: 'ping' }
  // Reply to a server-initiated heartbeat ping (see ServerEvent 'ping').
  // Deliberately a plain JSON app message, not a native WebSocket
  // protocol-level pong control frame — React Native's WebSocket has
  // documented, inconsistent handling of control frames across platforms,
  // so relying on socket.ping()/'pong' at the transport level risked the
  // server wrongly believing a perfectly healthy connection was dead.
  | { type: 'pong' };

export type ServerEvent =
  | { type: 'auth:ok'; userId: string }
  | { type: 'auth:error'; message: string }
  | { type: 'message:sent'; tempId: string; messageId: string; sentAt: string }
  | { type: 'message:failed'; tempId: string; reason: 'recipient_offline' | 'not_contact' | 'blocked' | 'not_group_member' | 'broadcast_read_only' | 'unauthenticated' | 'session_not_approved' }
  | { type: 'message:receive'; messageId: string; from: string; groupId?: string; kind: MessageKind; payload: EncryptedPayload; meta?: Record<string, unknown>; sentAt: string }
  | { type: 'typing'; from: string; groupId?: string; isTyping: boolean }
  | { type: 'read'; from: string; groupId?: string; messageId: string }
  | { type: 'presence'; userId: string; status: 'online' | 'offline'; lastSeenAt?: string }
  // Sent once, right after auth:ok — presence otherwise only broadcasts
  // future transitions to already-connected sockets, so without this a
  // freshly-connecting client never learns who was already online before
  // it connected (it would only find out once each of those contacts next
  // disconnects/reconnects/toggles, which could be arbitrarily long after).
  | { type: 'presence:snapshot'; onlineUserIds: string[] }
  | { type: 'group:created'; groupId: string; name: string; memberIds: string[]; isBroadcast?: boolean }
  | { type: 'group:invited'; groupId: string; name: string; from: string; memberIds: string[]; isBroadcast?: boolean }
  | { type: 'group:member_left'; groupId: string; userId: string }
  | { type: 'call:signal'; from: string; signal: Record<string, unknown> }
  // Tells the client "something about your contact_requests changed, go
  // refetch" — carries no data of its own, since Supabase's contact_requests
  // table remains the actual source of truth (see contactStore.ts's
  // refresh()). This exists because that table was never added to Supabase's
  // realtime publication, so the client's own postgres_changes subscription
  // silently never fires; this rides the relay's already-working WebSocket
  // instead, the same way messages/calls/presence do.
  | { type: 'contact:refresh' }
  // Per-session chat requests: a long-term approved contact still needs to
  // accept a fresh "session" before either side can exchange messages —
  // see server/src/state.ts's activeSessions for what a "session" means.
  | { type: 'session:request'; from: string } // delivered to the target — show an incoming-request prompt
  | { type: 'session:requested'; to: string } // ack to the requester — request was delivered
  | { type: 'session:request_failed'; to: string; reason: 'recipient_offline' | 'not_contact' }
  | { type: 'session:accepted'; from: string }
  | { type: 'session:rejected'; from: string; reason: 'declined' | 'timeout' | 'peer_disconnected' }
  | { type: 'session:request_withdrawn'; from: string } // to the target — the requester disconnected before you responded
  | { type: 'error'; message: string }
  | { type: 'pong' } // reply to a client-initiated 'ping' (unused by the current client, kept for compat)
  | { type: 'ping' }; // server-initiated heartbeat — client must reply with ClientEvent 'pong'
