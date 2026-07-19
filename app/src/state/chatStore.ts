import { create } from 'zustand';
import { relayClient } from '../lib/relayClient';
import { encryptMessage, decryptMessage } from '../lib/crypto';
import { getOrCreateDeviceKeyPair, fetchPublicKey, fetchPublicKeyWithRetry } from '../lib/keystore';
import { loadAllThreads, loadPinned, saveMessage, renameMessageId, setPinned, deleteThreadLocal } from '../lib/localDb';
import type { MessageKind, ServerEvent, EncryptedPayload } from '../types/relay';
import { useAuthStore } from './authStore';
import { useGroupStore } from './groupStore';
import { appAlert } from './alertStore';

export interface ChatMessage {
  id: string; // messageId once known, else tempId while pending
  tempId: string;
  from: string;
  to?: string;
  groupId?: string;
  kind: MessageKind;
  text?: string;
  meta?: Record<string, unknown>;
  sentAt: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  failReason?: string;
  replyToId?: string;
  reactions: Record<string, string>; // userId -> emoji
  edited?: boolean;
  deleted?: boolean;
}

function chatKey(peerOrGroupId: string, isGroup: boolean) {
  return isGroup ? `group:${peerOrGroupId}` : `dm:${peerOrGroupId}`;
}

// Kinds whose real content is JSON-serialized and E2E-encrypted end to end,
// rather than sent as plaintext protocol `meta` (which only ever carries
// opaque routing hints like replyToId/targetMessageId, never content).
const RICH_KINDS = new Set<MessageKind>(['voice', 'media', 'location', 'sticker', 'poll', 'doodle', 'mood', 'game']);

/**
 * Pairwise E2E fan-out for group messages: encrypts `plaintext` separately
 * for every other member of the group, each with their own real,
 * individually-fetched public key — the exact same encryptMessage()
 * function 1-1 chats already use, just called once per recipient instead
 * of once per message. Replaces the old "encrypt with the sender's own
 * keypair as a placeholder" approach, which produced a ciphertext nobody
 * but the sender could ever decrypt.
 *
 * fetchPublicKey() is itself cached (see keystore.ts), so only the first
 * message to a given group actually pays for the lookups; every message
 * after that resolves from memory. Run in parallel rather than a
 * sequential loop so a group with several members doesn't serialize N
 * network round trips on that first send.
 *
 * A member whose key can't be fetched (e.g. they haven't published one
 * yet) is silently skipped — they just don't get this specific message,
 * same as how a 1-1 message to someone with no published key already
 * fails outright rather than sending anything.
 */
async function encryptForGroupMembers(groupId: string, me: string, plaintext: string, secretKey: string): Promise<Record<string, EncryptedPayload>> {
  const memberIds = useGroupStore.getState().groups[groupId]?.memberIds ?? [];
  const others = memberIds.filter((id) => id !== me);
  const keys = await Promise.all(others.map((id) => fetchPublicKey(id)));
  const payloads: Record<string, EncryptedPayload> = {};
  others.forEach((id, i) => {
    const k = keys[i];
    if (k) payloads[id] = encryptMessage(plaintext, k, secretKey);
  });
  return payloads;
}

interface ChatState {
  threads: Record<string, ChatMessage[]>; // hydrated from + kept in sync with on-device SQLite (localDb.ts) — see hydrateFromLocal
  typing: Record<string, boolean>; // session-only, never persisted — a stale "is typing" on relaunch would be actively wrong, not just stale
  pinned: Record<string, string[]>;
  wired: boolean;
  wire: () => void;
  sendText: (targetId: string, isGroup: boolean, text: string, opts?: { replyToId?: string; kind?: MessageKind; meta?: Record<string, unknown> }) => Promise<void>;
  sendRich: (targetId: string, isGroup: boolean, kind: MessageKind, content: Record<string, unknown>, replyToId?: string) => Promise<void>;
  forwardMessage: (message: ChatMessage, toTargetId: string, toIsGroup: boolean) => Promise<void>;
  setTyping: (targetId: string, isGroup: boolean, isTyping: boolean) => void;
  markRead: (targetId: string, isGroup: boolean, messageId: string) => void;
  react: (targetId: string, isGroup: boolean, messageId: string, emoji: string) => void;
  editMessage: (targetId: string, isGroup: boolean, messageId: string, newText: string) => void;
  deleteLocal: (targetId: string, isGroup: boolean, messageId: string) => void;
  /** Own messages only — deletes from this device immediately, and asks
   * the other party's device (if connected right now) to delete its copy
   * too. See the doc comment above the 'delete' MessageKind in
   * server/src/protocol.ts for why this is live-only, not queued. */
  deleteForEveryone: (targetId: string, isGroup: boolean, messageId: string) => void;
  togglePin: (targetId: string, isGroup: boolean, messageId: string) => void;
  votePoll: (targetId: string, isGroup: boolean, messageId: string, optionIndex: number) => void;
  /** "Clear chat" — deletes every message in this one conversation from
   * local storage (this device only; never touches the other party's
   * copy, there being nothing server-side to clear from). */
  clearThread: (key: string) => void;
}

let hydrated = false;

/**
 * Loads this account's on-device chat history (see src/lib/localDb.ts) into
 * the in-memory store once, right when a session becomes available. Merges
 * rather than overwrites in case any live relay traffic already landed in
 * `threads` in the brief window before hydration completes — local rows are
 * only added for message ids not already present in memory.
 */
async function hydrateFromLocal(userId: string) {
  if (hydrated) return;
  hydrated = true;
  // getDb() (src/lib/localDb.ts) now recovers on its own from the most
  // likely real-world failure (a SQLCipher key/file mismatch — see its own
  // doc comment), but this still has zero handling for whatever's left
  // over: a second, genuine failure after that recovery attempt, storage
  // quota errors, etc. Without this, any such failure vanished completely
  // — local history just looked permanently empty with nothing telling
  // the user why, indistinguishable from "there was never anything to
  // load" even though messages really had been sent/received before.
  try {
    const [localThreads, localPinned] = await Promise.all([loadAllThreads(userId), loadPinned(userId)]);
    useChatStore.setState((s) => {
      const threads: Record<string, ChatMessage[]> = { ...localThreads };
      for (const [key, list] of Object.entries(s.threads)) {
        const existingIds = new Set((threads[key] ?? []).map((m) => m.id));
        threads[key] = [...(threads[key] ?? []), ...list.filter((m) => !existingIds.has(m.id))].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
      }
      return { threads, pinned: { ...localPinned, ...s.pinned } };
    });
  } catch (err: any) {
    console.error('[chatStore] failed to load local chat history:', err);
    appAlert('Local history unavailable', "Your saved messages on this device couldn't be loaded. New messages will still be sent and received normally.");
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  threads: {},
  typing: {},
  pinned: {},
  wired: false,

  wire: () => {
    if (get().wired) return;
    set({ wired: true });

    const existingUserId = useAuthStore.getState().session?.user.id;
    if (existingUserId) hydrateFromLocal(existingUserId);
    useAuthStore.subscribe((s, prev) => {
      const userId = s.session?.user.id;
      if (userId && userId !== prev.session?.user.id) hydrateFromLocal(userId);
    });

    relayClient.on(async (event: ServerEvent) => {
      const me = useAuthStore.getState().session?.user.id;
      if (!me) return;

      if (event.type === 'message:sent') {
        let updatedKey: string | null = null;
        let updatedMsg: ChatMessage | null = null;
        set((s) => ({
          threads: mapThreads(s.threads, (key, list) =>
            list.map((m) => {
              if (m.tempId !== event.tempId) return m;
              updatedKey = key;
              updatedMsg = { ...m, id: event.messageId, status: 'sent' as const };
              return updatedMsg;
            })
          ),
        }));
        if (updatedKey && updatedMsg) {
          renameMessageId(me, event.tempId, event.messageId)
            .then(() => saveMessage(me, updatedKey!, updatedMsg!))
            .catch(() => {});
        }
      }

      if (event.type === 'message:failed') {
        let updatedKey: string | null = null;
        let updatedMsg: ChatMessage | null = null;
        set((s) => ({
          threads: mapThreads(s.threads, (key, list) =>
            list.map((m) => {
              if (m.tempId !== event.tempId) return m;
              updatedKey = key;
              updatedMsg = { ...m, status: 'failed' as const, failReason: event.reason };
              return updatedMsg;
            })
          ),
        }));
        if (updatedKey && updatedMsg) saveMessage(me, updatedKey, updatedMsg).catch(() => {});
      }

      if (event.type === 'message:receive') {
        const kp = await getOrCreateDeviceKeyPair(me);
        // Retries: a brand-new sender's publishPublicKey() write can still
        // be in flight (it's a background call, decoupled from message
        // delivery — see keystore.ts) at the exact moment their very first
        // message arrives here. A one-shot fetchPublicKey() null result
        // used to be treated as permanent, writing "[unable to decrypt]"
        // to local storage with nothing ever retrying it — see
        // fetchPublicKeyWithRetry's doc comment.
        const senderKey = await fetchPublicKeyWithRetry(event.from);
        let text: string | undefined;
        let richMeta: Record<string, unknown> | undefined;
        const decrypted = senderKey ? decryptMessage(event.payload, senderKey, kp.secretKey) : null;

        if (event.kind === 'text' || event.kind === 'edit' || event.kind === 'reply') {
          text = decrypted ?? '[unable to decrypt]';
        } else if (RICH_KINDS.has(event.kind)) {
          // voice/media/location/sticker/poll: the actual content travels
          // inside the encrypted payload as JSON, never in plaintext meta.
          try {
            richMeta = decrypted ? JSON.parse(decrypted) : undefined;
          } catch {
            richMeta = undefined;
          }
        }

        const key = chatKey(event.groupId ?? event.from, !!event.groupId);
        const msg: ChatMessage = {
          id: event.messageId,
          tempId: event.messageId,
          from: event.from,
          to: event.groupId ? undefined : me,
          groupId: event.groupId,
          kind: event.kind,
          text,
          meta: richMeta ?? event.meta,
          sentAt: event.sentAt,
          status: 'delivered',
          replyToId: (event.meta?.replyToId as string) ?? undefined,
          reactions: {},
        };

        if (event.kind === 'reaction' && event.meta?.targetMessageId) {
          let updatedMsg: ChatMessage | null = null;
          set((s) => ({
            threads: {
              ...s.threads,
              [key]: (s.threads[key] ?? []).map((m) => {
                if (m.id !== event.meta!.targetMessageId) return m;
                updatedMsg = { ...m, reactions: { ...m.reactions, [event.from]: String(event.meta!.emoji) } };
                return updatedMsg;
              }),
            },
          }));
          if (updatedMsg) saveMessage(me, key, updatedMsg).catch(() => {});
          return;
        }
        if (event.kind === 'edit' && event.meta?.targetMessageId) {
          let updatedMsg: ChatMessage | null = null;
          set((s) => ({
            threads: {
              ...s.threads,
              [key]: (s.threads[key] ?? []).map((m) => {
                if (m.id !== event.meta!.targetMessageId) return m;
                updatedMsg = { ...m, text, edited: true };
                return updatedMsg;
              }),
            },
          }));
          if (updatedMsg) saveMessage(me, key, updatedMsg).catch(() => {});
          return;
        }
        if (event.kind === 'delete' && event.meta?.targetMessageId) {
          // "Delete for everyone" — the sender's own copy was already
          // marked deleted locally at send time (see deleteForEveryone);
          // this applies the same tombstone on the recipient's side.
          let updatedMsg: ChatMessage | null = null;
          set((s) => ({
            threads: {
              ...s.threads,
              [key]: (s.threads[key] ?? []).map((m) => {
                if (m.id !== event.meta!.targetMessageId) return m;
                updatedMsg = { ...m, deleted: true, text: undefined };
                return updatedMsg;
              }),
            },
          }));
          if (updatedMsg) saveMessage(me, key, updatedMsg).catch(() => {});
          return;
        }
        if (event.kind === 'poll_vote' && event.meta?.targetMessageId) {
          const optionIndex = Number(event.meta.optionIndex);
          let updatedMsg: ChatMessage | null = null;
          set((s) => ({
            threads: {
              ...s.threads,
              [key]: (s.threads[key] ?? []).map((m) => {
                if (m.id !== event.meta!.targetMessageId) return m;
                updatedMsg = { ...m, meta: { ...m.meta, votes: { ...(m.meta?.votes as Record<string, number> | undefined), [event.from]: optionIndex } } };
                return updatedMsg;
              }),
            },
          }));
          if (updatedMsg) saveMessage(me, key, updatedMsg).catch(() => {});
          return;
        }

        set((s) => ({ threads: { ...s.threads, [key]: [...(s.threads[key] ?? []), msg] } }));
        saveMessage(me, key, msg).catch(() => {});
      }

      if (event.type === 'typing') {
        const key = chatKey(event.groupId ?? event.from, !!event.groupId);
        set((s) => ({ typing: { ...s.typing, [key]: event.isTyping } }));
      }

      if (event.type === 'read') {
        const key = chatKey(event.groupId ?? event.from, !!event.groupId);
        let updatedMsg: ChatMessage | null = null;
        set((s) => ({
          threads: {
            ...s.threads,
            [key]: (s.threads[key] ?? []).map((m) => {
              if (m.id !== event.messageId) return m;
              updatedMsg = { ...m, status: 'read' as const };
              return updatedMsg;
            }),
          },
        }));
        if (updatedMsg) saveMessage(me, key, updatedMsg).catch(() => {});
      }
    });
  },

  sendText: async (targetId, isGroup, text, opts) => {
    const me = useAuthStore.getState().session?.user.id;
    if (!me || !text.trim()) return;
    const key = chatKey(targetId, isGroup);
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const kp = await getOrCreateDeviceKeyPair(me);

    const optimistic: ChatMessage = {
      id: tempId,
      tempId,
      from: me,
      to: isGroup ? undefined : targetId,
      groupId: isGroup ? targetId : undefined,
      kind: opts?.kind ?? 'text',
      text,
      sentAt: new Date().toISOString(),
      status: 'sending',
      replyToId: opts?.replyToId,
      reactions: {},
    };
    set((s) => ({ threads: { ...s.threads, [key]: [...(s.threads[key] ?? []), optimistic] } }));
    saveMessage(me, key, optimistic).catch(() => {});

    if (!isGroup) {
      // 1-1: encrypt to the one recipient's public key.
      const recipientKey = await fetchPublicKey(targetId);
      if (!recipientKey) {
        const failed = { ...optimistic, status: 'failed' as const, failReason: 'no_key' };
        set((s) => ({ threads: { ...s.threads, [key]: (s.threads[key] ?? []).map((m) => (m.tempId === tempId ? failed : m)) } }));
        saveMessage(me, key, failed).catch(() => {});
        return;
      }
      const payload = encryptMessage(text, recipientKey, kp.secretKey);
      relayClient.send({
        type: 'message:send',
        tempId,
        to: targetId,
        kind: opts?.kind ?? 'text',
        payload,
        meta: { ...opts?.meta, replyToId: opts?.replyToId },
      });
    } else {
      // Group: pairwise fan-out — one real ciphertext per member, each
      // encrypted to their own public key (see encryptForGroupMembers).
      // No more `plaintextEcho` in meta: that field was a dead leftover
      // from the very first commit — nothing on the receiving side ever
      // actually read it, so it never made group text readable for
      // anyone; it just sent the plaintext through the relay in the
      // clear for no functional benefit, on top of every recipient's own
      // decrypt attempt (against the old self-encrypted placeholder
      // payload) failing and rendering "[unable to decrypt]". This fixes
      // both problems by making the payload itself genuinely decryptable
      // per recipient.
      const payloads = await encryptForGroupMembers(targetId, me, text, kp.secretKey);
      if (Object.keys(payloads).length === 0) {
        const failed = { ...optimistic, status: 'failed' as const, failReason: 'no_key' };
        set((s) => ({ threads: { ...s.threads, [key]: (s.threads[key] ?? []).map((m) => (m.tempId === tempId ? failed : m)) } }));
        saveMessage(me, key, failed).catch(() => {});
        return;
      }
      relayClient.send({
        type: 'message:send',
        tempId,
        groupId: targetId,
        kind: opts?.kind ?? 'text',
        payloads,
        meta: { ...opts?.meta, replyToId: opts?.replyToId },
      });
    }
  },

  sendRich: async (targetId, isGroup, kind, content, replyToId) => {
    const me = useAuthStore.getState().session?.user.id;
    if (!me) return;
    const key = chatKey(targetId, isGroup);
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const kp = await getOrCreateDeviceKeyPair(me);

    const optimistic: ChatMessage = {
      id: tempId,
      tempId,
      from: me,
      to: isGroup ? undefined : targetId,
      groupId: isGroup ? targetId : undefined,
      kind,
      meta: content,
      sentAt: new Date().toISOString(),
      status: 'sending',
      replyToId,
      reactions: {},
    };
    set((s) => ({ threads: { ...s.threads, [key]: [...(s.threads[key] ?? []), optimistic] } }));
    saveMessage(me, key, optimistic).catch(() => {});

    const json = JSON.stringify(content);

    if (isGroup) {
      // Pairwise fan-out — same real per-member encryption as sendText,
      // covering rich content (photos/voice/polls/etc.) too. Previously
      // this path encrypted with the sender's own keypair as a
      // placeholder, which no other group member could ever decrypt —
      // there was no plaintext-meta fallback for rich content the way
      // sendText had for plain text, so a group photo/poll/voice message
      // would have rendered as empty/undecryptable to everyone but the
      // sender the moment any group screen gained the UI to send one.
      const payloads = await encryptForGroupMembers(targetId, me, json, kp.secretKey);
      if (Object.keys(payloads).length === 0) {
        const failed = { ...optimistic, status: 'failed' as const, failReason: 'no_key' };
        set((s) => ({ threads: { ...s.threads, [key]: (s.threads[key] ?? []).map((m) => (m.tempId === tempId ? failed : m)) } }));
        saveMessage(me, key, failed).catch(() => {});
        return;
      }
      relayClient.send({ type: 'message:send', tempId, groupId: targetId, kind, payloads, meta: { replyToId } });
      return;
    }

    const encryptTo = await fetchPublicKey(targetId);
    if (!encryptTo) {
      const failed = { ...optimistic, status: 'failed' as const, failReason: 'no_key' };
      set((s) => ({ threads: { ...s.threads, [key]: (s.threads[key] ?? []).map((m) => (m.tempId === tempId ? failed : m)) } }));
      saveMessage(me, key, failed).catch(() => {});
      return;
    }
    const payload = encryptMessage(json, encryptTo, kp.secretKey);
    relayClient.send({ type: 'message:send', tempId, to: targetId, kind, payload, meta: { replyToId } });
  },

  forwardMessage: async (message, toTargetId, toIsGroup) => {
    if (message.kind === 'text' || message.kind === 'reply') {
      if (message.text) await get().sendText(toTargetId, toIsGroup, message.text, { kind: 'text', meta: { forwarded: true } });
      return;
    }
    if (message.meta) await get().sendRich(toTargetId, toIsGroup, message.kind, { ...message.meta, forwarded: true });
  },

  setTyping: (targetId, isGroup, isTyping) => {
    relayClient.send({ type: 'typing', to: isGroup ? undefined : targetId, groupId: isGroup ? targetId : undefined, isTyping });
  },

  markRead: (targetId, isGroup, messageId) => {
    // This only ever notified the *other* party (a read receipt over the
    // wire, so THEY see a "read" tick on the message they sent) — it never
    // touched this device's own copy of the messages being read. Since
    // useConversationRows' unread count (src/data/conversations.ts) is
    // computed from `m.from !== me && m.status !== 'read'` on the LOCAL
    // threads state, nothing ever cleared it: opening and reading a chat
    // sent the receipt out, but the thread's own messages stayed at
    // whatever status they arrived with, forever, from this device's own
    // point of view. Marks every currently-unread received message in this
    // thread as read locally (not just the one messageId the wire receipt
    // references — opening a chat reads the whole thread, not just its
    // newest message) and persists each change, the same way every other
    // status mutation in this store already does.
    const me = useAuthStore.getState().session?.user.id;
    relayClient.send({ type: 'read', to: isGroup ? undefined : targetId, groupId: isGroup ? targetId : undefined, messageId });
    if (!me) return;
    const key = chatKey(targetId, isGroup);
    const changed: ChatMessage[] = [];
    set((s) => ({
      threads: {
        ...s.threads,
        [key]: (s.threads[key] ?? []).map((m) => {
          if (m.from === me || m.status === 'read') return m;
          const updated = { ...m, status: 'read' as const };
          changed.push(updated);
          return updated;
        }),
      },
    }));
    changed.forEach((m) => saveMessage(me, key, m).catch(() => {}));
  },

  react: (targetId, isGroup, messageId, emoji) => {
    const me = useAuthStore.getState().session?.user.id;
    if (!me) return;
    const key = chatKey(targetId, isGroup);
    let updatedMsg: ChatMessage | null = null;
    set((s) => ({
      threads: {
        ...s.threads,
        [key]: (s.threads[key] ?? []).map((m) => {
          if (m.id !== messageId) return m;
          updatedMsg = { ...m, reactions: { ...m.reactions, [me]: emoji } };
          return updatedMsg;
        }),
      },
    }));
    if (updatedMsg) saveMessage(me, key, updatedMsg).catch(() => {});
    relayClient.send({
      type: 'message:send',
      tempId: `react-${Date.now()}`,
      to: isGroup ? undefined : targetId,
      groupId: isGroup ? targetId : undefined,
      kind: 'reaction',
      payload: { nonce: '', ciphertext: '' },
      meta: { targetMessageId: messageId, emoji },
    });
  },

  votePoll: (targetId, isGroup, messageId, optionIndex) => {
    const me = useAuthStore.getState().session?.user.id;
    if (!me) return;
    const key = chatKey(targetId, isGroup);
    let updatedMsg: ChatMessage | null = null;
    set((s) => ({
      threads: {
        ...s.threads,
        [key]: (s.threads[key] ?? []).map((m) => {
          if (m.id !== messageId) return m;
          updatedMsg = { ...m, meta: { ...m.meta, votes: { ...(m.meta?.votes as Record<string, number> | undefined), [me]: optionIndex } } };
          return updatedMsg;
        }),
      },
    }));
    if (updatedMsg) saveMessage(me, key, updatedMsg).catch(() => {});
    relayClient.send({
      type: 'message:send',
      tempId: `vote-${Date.now()}`,
      to: isGroup ? undefined : targetId,
      groupId: isGroup ? targetId : undefined,
      kind: 'poll_vote',
      payload: { nonce: '', ciphertext: '' },
      meta: { targetMessageId: messageId, optionIndex },
    });
  },

  editMessage: (targetId, isGroup, messageId, newText) => {
    const me = useAuthStore.getState().session?.user.id;
    const key = chatKey(targetId, isGroup);
    let updatedMsg: ChatMessage | null = null;
    set((s) => ({
      threads: {
        ...s.threads,
        [key]: (s.threads[key] ?? []).map((m) => {
          if (m.id !== messageId) return m;
          updatedMsg = { ...m, text: newText, edited: true };
          return updatedMsg;
        }),
      },
    }));
    if (me && updatedMsg) saveMessage(me, key, updatedMsg).catch(() => {});
    (async () => {
      if (!me) return;
      const kp = await getOrCreateDeviceKeyPair(me);
      if (!isGroup) {
        const recipientKey = await fetchPublicKey(targetId);
        if (!recipientKey) return;
        const payload = encryptMessage(newText, recipientKey, kp.secretKey);
        relayClient.send({ type: 'message:send', tempId: `edit-${Date.now()}`, to: targetId, kind: 'edit', payload, meta: { targetMessageId: messageId } });
      }
    })();
  },

  deleteLocal: (targetId, isGroup, messageId) => {
    const me = useAuthStore.getState().session?.user.id;
    const key = chatKey(targetId, isGroup);
    let updatedMsg: ChatMessage | null = null;
    set((s) => ({
      threads: {
        ...s.threads,
        [key]: (s.threads[key] ?? []).map((m) => {
          if (m.id !== messageId) return m;
          updatedMsg = { ...m, deleted: true, text: undefined };
          return updatedMsg;
        }),
      },
    }));
    if (me && updatedMsg) saveMessage(me, key, updatedMsg).catch(() => {});
  },

  deleteForEveryone: (targetId, isGroup, messageId) => {
    const me = useAuthStore.getState().session?.user.id;
    if (!me) return;
    const key = chatKey(targetId, isGroup);
    let updatedMsg: ChatMessage | null = null;
    set((s) => ({
      threads: {
        ...s.threads,
        [key]: (s.threads[key] ?? []).map((m) => {
          if (m.id !== messageId) return m;
          updatedMsg = { ...m, deleted: true, text: undefined };
          return updatedMsg;
        }),
      },
    }));
    if (updatedMsg) saveMessage(me, key, updatedMsg).catch(() => {});
    // Live-only, deliberately not queued for an offline recipient — same
    // as edit/reaction/poll_vote (all of which already only apply to a
    // currently-connected recipient; see handleMessageSend's hard-fail-if-
    // offline rule in server/src/index.ts). A "delete" instruction, unlike
    // a call ring, has no natural expiry: the sender could decide to
    // delete something hours or days after sending it, so an ephemeral
    // replay-on-reconnect record (like callStore's ring replay) would
    // either need to live indefinitely — undermining the zero-persistence
    // guarantee this whole relay is built around — or expire quickly
    // enough to rarely actually help. If the recipient is offline right
    // now, their copy simply isn't reached; the sender's own copy is still
    // deleted immediately either way.
    relayClient.send({
      type: 'message:send',
      tempId: `delete-${Date.now()}`,
      to: isGroup ? undefined : targetId,
      groupId: isGroup ? targetId : undefined,
      kind: 'delete',
      payload: { nonce: '', ciphertext: '' },
      meta: { targetMessageId: messageId },
    });
  },

  togglePin: (targetId, isGroup, messageId) => {
    const me = useAuthStore.getState().session?.user.id;
    const key = chatKey(targetId, isGroup);
    let nowPinned = false;
    set((s) => {
      const cur = s.pinned[key] ?? [];
      nowPinned = !cur.includes(messageId);
      const next = nowPinned ? [...cur, messageId] : cur.filter((id) => id !== messageId);
      return { pinned: { ...s.pinned, [key]: next } };
    });
    if (me) setPinned(me, key, messageId, nowPinned).catch(() => {});
  },

  clearThread: (key) => {
    const me = useAuthStore.getState().session?.user.id;
    set((s) => ({
      threads: { ...s.threads, [key]: [] },
      pinned: { ...s.pinned, [key]: [] },
    }));
    // Without this, the "cleared" messages were only ever wiped from
    // in-memory state — reopening the app would reload them right back
    // from local SQLite via hydrateFromLocal, since nothing had actually
    // deleted the persisted rows. This was true even before this feature
    // had a UI entry point (clearThread existed but was never called from
    // anywhere).
    if (me) deleteThreadLocal(me, key).catch(() => {});
  },
}));

export function getThreadKey(id: string, isGroup: boolean) {
  return chatKey(id, isGroup);
}

function mapThreads(threads: Record<string, ChatMessage[]>, fn: (key: string, list: ChatMessage[]) => ChatMessage[]) {
  const next: Record<string, ChatMessage[]> = {};
  for (const [key, list] of Object.entries(threads)) next[key] = fn(key, list);
  return next;
}
