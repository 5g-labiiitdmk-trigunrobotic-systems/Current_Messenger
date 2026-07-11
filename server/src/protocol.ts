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
  | { type: 'session:request'; to: string }
  | { type: 'session:respond'; peerId: string; accept: boolean }
  | { type: 'ping' };

export type ServerEvent =
  | { type: 'auth:ok'; userId: string }
  | { type: 'auth:error'; message: string }
  | { type: 'message:sent'; tempId: string; messageId: string; sentAt: string }
  | { type: 'message:failed'; tempId: string; reason: 'recipient_offline' | 'not_contact' | 'blocked' | 'not_group_member' | 'broadcast_read_only' | 'unauthenticated' | 'session_not_approved' }
  | { type: 'message:receive'; messageId: string; from: string; groupId?: string; kind: MessageKind; payload: EncryptedPayload; meta?: Record<string, unknown>; sentAt: string }
  | { type: 'typing'; from: string; groupId?: string; isTyping: boolean }
  | { type: 'read'; from: string; groupId?: string; messageId: string }
  | { type: 'presence'; userId: string; status: 'online' | 'offline'; lastSeenAt?: string }
  | { type: 'group:created'; groupId: string; name: string; memberIds: string[]; isBroadcast?: boolean }
  | { type: 'group:invited'; groupId: string; name: string; from: string; memberIds: string[]; isBroadcast?: boolean }
  | { type: 'group:member_left'; groupId: string; userId: string }
  | { type: 'call:signal'; from: string; signal: Record<string, unknown> }
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
  | { type: 'pong' };
