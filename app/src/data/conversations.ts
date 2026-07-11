import { useMemo } from 'react';
import { useContactStore } from '../state/contactStore';
import { useGroupStore } from '../state/groupStore';
import { useChatStore, getThreadKey } from '../state/chatStore';
import { useAuthStore } from '../state/authStore';
import { usePresenceStore } from '../state/presenceStore';
import { isPresenceVisible } from '../lib/presencePolicy';
import type { UserRow } from '../types/database';
import type { GroupInfo } from '../state/groupStore';

export interface ConversationRow {
  id: string;
  isGroup: boolean;
  name: string;
  hue: number;
  photoUrl: string | null;
  online: boolean;
  preview: string;
  time: string;
  unread: number;
  isChannel: boolean;
  isBroadcast: boolean;
}

/**
 * The chat list is derived, not stored: WHO you can talk to comes from
 * Supabase (approved contacts + live groups), WHAT you said comes from the
 * in-memory session-only chatStore. Restart the app and contacts remain,
 * conversation history does not — that's the zero-persistence rule made visible.
 */
export function useConversationRows(): ConversationRow[] {
  const approved = useContactStore((s) => s.approved);
  const groups = useGroupStore((s) => s.groups);
  const threads = useChatStore((s) => s.threads);
  const me = useAuthStore((s) => s.session?.user.id);
  const presence = usePresenceStore((s) => s.byUser);

  return useMemo(() => {
    const rows: ConversationRow[] = [];

    for (const contact of approved) {
      const key = getThreadKey(contact.id, false);
      const thread = threads[key] ?? [];
      const last = thread[thread.length - 1];
      const unread = thread.filter((m) => m.from !== me && m.status !== 'read').length;
      rows.push({
        id: contact.id,
        isGroup: false,
        name: contact.display_name || contact.username,
        hue: contact.avatar_hue,
        photoUrl: contact.avatar_url,
        online: isPresenceVisible(contact) && presence[contact.id]?.status === 'online',
        preview: last ? previewFor(last) : 'Say hello — nothing is stored, so history starts fresh each session.',
        time: last ? timeLabel(last.sentAt) : '',
        unread,
        isChannel: false,
        isBroadcast: false,
      });
    }

    for (const group of Object.values(groups) as GroupInfo[]) {
      const key = getThreadKey(group.id, true);
      const thread = threads[key] ?? [];
      const last = thread[thread.length - 1];
      const unread = thread.filter((m) => m.from !== me && m.status !== 'read').length;
      rows.push({
        id: group.id,
        isGroup: true,
        name: group.name,
        hue: 128,
        photoUrl: null,
        online: false,
        preview: last ? previewFor(last) : `${group.memberIds.length} members — this chat exists only while everyone's session lasts.`,
        time: last ? timeLabel(last.sentAt) : '',
        unread,
        isChannel: false,
        isBroadcast: group.isBroadcast,
      });
    }

    return rows.sort((a, b) => (b.time > a.time ? 1 : -1));
  }, [approved, groups, threads, me, presence]);
}

function previewFor(m: { kind: string; text?: string }) {
  if (m.kind === 'voice') return '🎤 Voice message';
  if (m.kind === 'media') return '📷 Photo';
  if (m.kind === 'location') return '📍 Location shared';
  if (m.kind === 'sticker') return 'Sent a sticker';
  return m.text ?? '…';
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
