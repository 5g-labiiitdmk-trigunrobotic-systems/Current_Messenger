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
  // "Delete for everyone" — meta.targetMessageId is the message to remove.
  // Same targeted-mutation pattern as 'reaction'/'edit'/'poll_vote': rides
  // the ordinary message:send/message:receive path, an empty payload (no
  // content to carry), and is therefore just as live-only as those already
  // are — the relay hard-fails message:send to an offline recipient with
  // no queueing (see handleMessageSend), so a delete sent while the other
  // party is offline simply never reaches their device. Deliberately not
  // given a call-ring-style replay-on-reconnect: a delete has no natural
  // expiry window (unlike a ~45s call ring), so an ephemeral record would
  // either need to live indefinitely — undermining the zero-persistence
  // guarantee — or expire too fast to usually help. See chatStore.ts's
  // deleteForEveryone for the full reasoning.
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
      // DMs (`to` set): a single payload, encrypted to that one recipient's
      // public key. Groups (`groupId` set) with real content (text/rich
      // messages): `payloads` instead — one ciphertext per member, each
      // individually encrypted client-side to that member's own public key
      // with the exact same encryptMessage() function DMs use (see
      // chatStore.ts's sendText/sendRich) — genuine pairwise E2E, not a
      // single ciphertext broadcast to everyone (which nobody but the
      // sender could ever have opened). Group sends with no real content
      // (reactions, poll votes, pin/unpin, etc.) still use the single
      // `payload` — always an empty dummy already, since their actual data
      // rides in plaintext `meta` and was never encrypted for DMs either.
      // The relay picks payloads[memberId] first, falling back to `payload`
      // — see the group branch in handleMessageSend.
      payload?: EncryptedPayload;
      payloads?: Record<string, EncryptedPayload>;
      meta?: Record<string, unknown>;
    }
  | { type: 'typing'; to?: string; groupId?: string; isTyping: boolean }
  | { type: 'read'; to?: string; groupId?: string; messageId: string }
  | { type: 'presence:set'; status: 'online' | 'away' }
  // `memberIds` is who the creator WANTS to add — as of the group-invite-
  // consent change, only the creator becomes an actual member immediately;
  // everyone else in this list gets a pending group:invite_request (same
  // mechanism group:invite below uses) instead of being added directly.
  | { type: 'group:create'; groupId: string; name: string; memberIds: string[]; isBroadcast?: boolean }
  // Creates a pending invite and notifies `to` — does NOT add them as a
  // member. See group:invite_respond below for how they accept/decline.
  | { type: 'group:invite'; groupId: string; to: string }
  // Sent by the invitee in response to a group:invite_request.
  | { type: 'group:invite_respond'; groupId: string; accept: boolean }
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
  // Sent once, right after auth:ok, same idiom as presence:snapshot —
  // every group this user currently belongs to. Group membership is
  // relay-memory-only and nothing client-side persists it either (see
  // groupStore.ts), so without this, a reconnect/app relaunch had no way
  // to learn which groups the user was already in.
  | { type: 'group:snapshot'; groups: { groupId: string; name: string; ownerId: string; memberIds: string[]; isBroadcast: boolean }[] }
  | { type: 'group:created'; groupId: string; name: string; memberIds: string[]; isBroadcast?: boolean }
  // Sent only once someone has actually ACCEPTED an invite (never on
  // invite-sent) — to the new member, and to every existing member, so
  // everyone's local roster converges on the same list. `ownerId` is
  // explicit rather than inferred from `from` (the inviter, who is not
  // necessarily the owner — any member can invite) since the client used
  // to assume `from` was always the owner, which broke group-info's
  // owner/admin display for anyone invited by a non-owner member.
  | { type: 'group:invited'; groupId: string; name: string; from: string; ownerId: string; memberIds: string[]; isBroadcast?: boolean }
  // Delivered to the invitee — show an accept/decline prompt, same idiom
  // as session:request.
  | { type: 'group:invite_request'; groupId: string; groupName: string; from: string; isBroadcast?: boolean }
  // Delivered to the inviter when their invite doesn't result in a new
  // member, for any reason.
  | { type: 'group:invite_declined'; groupId: string; userId: string; reason: 'declined' | 'timeout' | 'not_contact' | 'recipient_offline' }
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
