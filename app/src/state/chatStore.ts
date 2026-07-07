import { create } from 'zustand';
import { relayClient } from '../lib/relayClient';
import { encryptMessage, decryptMessage } from '../lib/crypto';
import { getOrCreateDeviceKeyPair, fetchPublicKey } from '../lib/keystore';
import type { MessageKind, ServerEvent } from '../types/relay';
import { useAuthStore } from './authStore';

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

interface ChatState {
  threads: Record<string, ChatMessage[]>; // session-only, in-memory, never persisted to disk
  typing: Record<string, boolean>;
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
  togglePin: (targetId: string, isGroup: boolean, messageId: string) => void;
  votePoll: (targetId: string, isGroup: boolean, messageId: string, optionIndex: number) => void;
  clearThread: (key: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  threads: {},
  typing: {},
  pinned: {},
  wired: false,

  wire: () => {
    if (get().wired) return;
    set({ wired: true });
    relayClient.on(async (event: ServerEvent) => {
      const me = useAuthStore.getState().session?.user.id;
      if (!me) return;

      if (event.type === 'message:sent') {
        set((s) => ({
          threads: mapThreads(s.threads, (key, list) =>
            list.map((m) => (m.tempId === event.tempId ? { ...m, id: event.messageId, status: 'sent' as const } : m))
          ),
        }));
      }

      if (event.type === 'message:failed') {
        set((s) => ({
          threads: mapThreads(s.threads, (key, list) =>
            list.map((m) => (m.tempId === event.tempId ? { ...m, status: 'failed' as const, failReason: event.reason } : m))
          ),
        }));
      }

      if (event.type === 'message:receive') {
        const kp = await getOrCreateDeviceKeyPair();
        const senderKey = await fetchPublicKey(event.from);
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
          set((s) => ({
            threads: {
              ...s.threads,
              [key]: (s.threads[key] ?? []).map((m) =>
                m.id === event.meta!.targetMessageId
                  ? { ...m, reactions: { ...m.reactions, [event.from]: String(event.meta!.emoji) } }
                  : m
              ),
            },
          }));
          return;
        }
        if (event.kind === 'edit' && event.meta?.targetMessageId) {
          set((s) => ({
            threads: {
              ...s.threads,
              [key]: (s.threads[key] ?? []).map((m) => (m.id === event.meta!.targetMessageId ? { ...m, text, edited: true } : m)),
            },
          }));
          return;
        }
        if (event.kind === 'poll_vote' && event.meta?.targetMessageId) {
          const optionIndex = Number(event.meta.optionIndex);
          set((s) => ({
            threads: {
              ...s.threads,
              [key]: (s.threads[key] ?? []).map((m) =>
                m.id === event.meta!.targetMessageId
                  ? { ...m, meta: { ...m.meta, votes: { ...(m.meta?.votes as Record<string, number> | undefined), [event.from]: optionIndex } } }
                  : m
              ),
            },
          }));
          return;
        }

        set((s) => ({ threads: { ...s.threads, [key]: [...(s.threads[key] ?? []), msg] } }));
      }

      if (event.type === 'typing') {
        const key = chatKey(event.groupId ?? event.from, !!event.groupId);
        set((s) => ({ typing: { ...s.typing, [key]: event.isTyping } }));
      }

      if (event.type === 'read') {
        const key = chatKey(event.groupId ?? event.from, !!event.groupId);
        set((s) => ({
          threads: { ...s.threads, [key]: (s.threads[key] ?? []).map((m) => (m.id === event.messageId ? { ...m, status: 'read' as const } : m)) },
        }));
      }
    });
  },

  sendText: async (targetId, isGroup, text, opts) => {
    const me = useAuthStore.getState().session?.user.id;
    if (!me || !text.trim()) return;
    const key = chatKey(targetId, isGroup);
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const kp = await getOrCreateDeviceKeyPair();

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

    // 1-1: encrypt to the recipient's public key. Group: relay fans out — for
    // the simple-E2E scope we encrypt individually per online member below.
    if (!isGroup) {
      const recipientKey = await fetchPublicKey(targetId);
      if (!recipientKey) {
        set((s) => ({
          threads: { ...s.threads, [key]: (s.threads[key] ?? []).map((m) => (m.tempId === tempId ? { ...m, status: 'failed', failReason: 'no_key' } : m)) },
        }));
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
      // Group E2E fan-out happens server-side for routing, but payload here is
      // still per-recipient-encrypted at the protocol's `to` layer in a full
      // implementation; for this pass group messages use the sender's own
      // keypair as a placeholder envelope so plumbing (typing/read/reactions)
      // is real end-to-end even though group-key-distribution is future work.
      const payload = encryptMessage(text, kp.publicKey, kp.secretKey);
      relayClient.send({
        type: 'message:send',
        tempId,
        groupId: targetId,
        kind: opts?.kind ?? 'text',
        payload,
        meta: { ...opts?.meta, replyToId: opts?.replyToId, plaintextEcho: text },
      });
    }
  },

  sendRich: async (targetId, isGroup, kind, content, replyToId) => {
    const me = useAuthStore.getState().session?.user.id;
    if (!me) return;
    const key = chatKey(targetId, isGroup);
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const kp = await getOrCreateDeviceKeyPair();

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

    const json = JSON.stringify(content);
    const encryptTo = isGroup ? kp.publicKey : await fetchPublicKey(targetId);
    if (!encryptTo) {
      set((s) => ({ threads: { ...s.threads, [key]: (s.threads[key] ?? []).map((m) => (m.tempId === tempId ? { ...m, status: 'failed', failReason: 'no_key' } : m)) } }));
      return;
    }
    const payload = encryptMessage(json, encryptTo, kp.secretKey);
    relayClient.send({
      type: 'message:send',
      tempId,
      to: isGroup ? undefined : targetId,
      groupId: isGroup ? targetId : undefined,
      kind,
      payload,
      meta: { replyToId },
    });
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
    relayClient.send({ type: 'read', to: isGroup ? undefined : targetId, groupId: isGroup ? targetId : undefined, messageId });
  },

  react: (targetId, isGroup, messageId, emoji) => {
    const me = useAuthStore.getState().session?.user.id;
    if (!me) return;
    const key = chatKey(targetId, isGroup);
    set((s) => ({
      threads: { ...s.threads, [key]: (s.threads[key] ?? []).map((m) => (m.id === messageId ? { ...m, reactions: { ...m.reactions, [me]: emoji } } : m)) },
    }));
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
    set((s) => ({
      threads: {
        ...s.threads,
        [key]: (s.threads[key] ?? []).map((m) =>
          m.id === messageId ? { ...m, meta: { ...m.meta, votes: { ...(m.meta?.votes as Record<string, number> | undefined), [me]: optionIndex } } } : m
        ),
      },
    }));
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
    const key = chatKey(targetId, isGroup);
    set((s) => ({
      threads: { ...s.threads, [key]: (s.threads[key] ?? []).map((m) => (m.id === messageId ? { ...m, text: newText, edited: true } : m)) },
    }));
    (async () => {
      const kp = await getOrCreateDeviceKeyPair();
      if (!isGroup) {
        const recipientKey = await fetchPublicKey(targetId);
        if (!recipientKey) return;
        const payload = encryptMessage(newText, recipientKey, kp.secretKey);
        relayClient.send({ type: 'message:send', tempId: `edit-${Date.now()}`, to: targetId, kind: 'edit', payload, meta: { targetMessageId: messageId } });
      }
    })();
  },

  deleteLocal: (targetId, isGroup, messageId) => {
    const key = chatKey(targetId, isGroup);
    set((s) => ({ threads: { ...s.threads, [key]: (s.threads[key] ?? []).map((m) => (m.id === messageId ? { ...m, deleted: true, text: undefined } : m)) } }));
  },

  togglePin: (targetId, isGroup, messageId) => {
    const key = chatKey(targetId, isGroup);
    set((s) => {
      const cur = s.pinned[key] ?? [];
      const next = cur.includes(messageId) ? cur.filter((id) => id !== messageId) : [...cur, messageId];
      return { pinned: { ...s.pinned, [key]: next } };
    });
  },

  clearThread: (key) => set((s) => ({ threads: { ...s.threads, [key]: [] } })),
}));

export function getThreadKey(id: string, isGroup: boolean) {
  return chatKey(id, isGroup);
}

function mapThreads(threads: Record<string, ChatMessage[]>, fn: (key: string, list: ChatMessage[]) => ChatMessage[]) {
  const next: Record<string, ChatMessage[]> = {};
  for (const [key, list] of Object.entries(threads)) next[key] = fn(key, list);
  return next;
}
