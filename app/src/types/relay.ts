// Wire protocol for the relay client. Mirrors server/src/protocol.ts — keep both in sync.

export type MessageKind =
  | 'text'
  | 'voice'
  | 'media'
  | 'sticker'
  | 'reaction'
  | 'edit'
  | 'delete'
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
  | {
      type: 'message:send';
      tempId: string;
      to?: string;
      groupId?: string;
      kind: MessageKind;
      // DMs: a single payload encrypted to that one recipient. Groups with
      // real content (text/rich): `payloads`, one ciphertext per member,
      // each individually encrypted with the same encryptMessage() DMs use
      // — see chatStore.ts's sendText/sendRich. Group sends with no real
      // content (reactions, poll votes, etc.) still use `payload` (an
      // empty dummy — their data is plaintext in `meta`, same as for DMs).
      payload?: EncryptedPayload;
      payloads?: Record<string, EncryptedPayload>;
      meta?: Record<string, unknown>;
    }
  | { type: 'typing'; to?: string; groupId?: string; isTyping: boolean }
  | { type: 'read'; to?: string; groupId?: string; messageId: string }
  | { type: 'presence:set'; status: 'online' | 'away' }
  // `memberIds` is who to invite — only the creator becomes a member
  // immediately, everyone else gets a pending group:invite_request.
  | { type: 'group:create'; groupId: string; name: string; memberIds: string[]; isBroadcast?: boolean }
  | { type: 'group:invite'; groupId: string; to: string }
  | { type: 'group:invite_respond'; groupId: string; accept: boolean }
  | { type: 'group:leave'; groupId: string }
  | { type: 'call:signal'; to: string; signal: Record<string, unknown> }
  | { type: 'contact:request_sent'; to: string }
  | { type: 'contact:request_responded'; to: string }
  | { type: 'session:request'; to: string }
  | { type: 'session:respond'; peerId: string; accept: boolean }
  | { type: 'ping' }
  | { type: 'pong' }; // reply to a server-initiated heartbeat ping — see relayClient.ts

export type ServerEvent =
  | { type: 'auth:ok'; userId: string }
  | { type: 'auth:error'; message: string }
  | { type: 'message:sent'; tempId: string; messageId: string; sentAt: string }
  | { type: 'message:failed'; tempId: string; reason: 'recipient_offline' | 'not_contact' | 'blocked' | 'not_group_member' | 'broadcast_read_only' | 'unauthenticated' | 'session_not_approved' }
  | { type: 'message:receive'; messageId: string; from: string; groupId?: string; kind: MessageKind; payload: EncryptedPayload; meta?: Record<string, unknown>; sentAt: string }
  | { type: 'typing'; from: string; groupId?: string; isTyping: boolean }
  | { type: 'read'; from: string; groupId?: string; messageId: string }
  | { type: 'presence'; userId: string; status: 'online' | 'offline'; lastSeenAt?: string }
  | { type: 'presence:snapshot'; onlineUserIds: string[] }
  | { type: 'group:created'; groupId: string; name: string; memberIds: string[]; isBroadcast?: boolean }
  // Sent only once an invite is accepted, to the new member and every
  // existing member. `ownerId` is explicit, not inferred from `from` (the
  // inviter — any member can invite, not just the owner).
  | { type: 'group:invited'; groupId: string; name: string; from: string; ownerId: string; memberIds: string[]; isBroadcast?: boolean }
  | { type: 'group:invite_request'; groupId: string; groupName: string; from: string; isBroadcast?: boolean }
  | { type: 'group:invite_declined'; groupId: string; userId: string; reason: 'declined' | 'timeout' | 'not_contact' | 'recipient_offline' }
  | { type: 'group:member_left'; groupId: string; userId: string }
  | { type: 'call:signal'; from: string; signal: Record<string, unknown> }
  | { type: 'contact:refresh' }
  | { type: 'session:request'; from: string }
  | { type: 'session:requested'; to: string }
  | { type: 'session:request_failed'; to: string; reason: 'recipient_offline' | 'not_contact' }
  | { type: 'session:accepted'; from: string }
  | { type: 'session:rejected'; from: string; reason: 'declined' | 'timeout' | 'peer_disconnected' }
  | { type: 'session:request_withdrawn'; from: string }
  | { type: 'error'; message: string }
  | { type: 'pong' }
  | { type: 'ping' }; // server-initiated heartbeat — relayClient.ts auto-replies with ClientEvent 'pong'
