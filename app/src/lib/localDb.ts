import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import type { ChatMessage } from '../state/chatStore';

/**
 * On-device-only chat history. This is a deliberate architecture change:
 * messages now survive closing/reopening the app, stored locally per
 * account on this specific device. The relay (server/src/index.ts) and
 * Supabase are completely unaffected and untouched by this — message
 * content still only ever exists there as an in-flight ciphertext blob
 * during delivery, never written anywhere server-side. This file is the
 * one and only place message content is ever persisted, and it never
 * leaves this device: no sync, no backup to any server, no visibility to
 * the other party's device.
 *
 * Encrypted at rest via SQLCipher (expo-sqlite's built-in support, enabled
 * via the `useSQLCipher` option on the expo-sqlite config plugin in
 * app.json — requires a custom dev/production build, not Expo Go, which
 * this app already requires anyway for calling). The encryption key is a
 * random 256-bit value generated once per (user, device) and held only in
 * the platform secure enclave (iOS Keychain / Android Keystore via
 * expo-secure-store) — never derived from the user's password, never
 * synced, never recoverable if the device is wiped (by design: losing the
 * device means losing local history, same as losing the device means
 * losing anything else only that device ever held).
 *
 * One database per userId (not one shared device-wide database) — if a
 * second account signs into the same physical device, its local history
 * must not be visible from the first account's session, so the database
 * itself is scoped by user, not just query-filtered.
 */

const dbCache = new Map<string, SQLite.SQLiteDatabase>();

async function getDbKeyHex(userId: string): Promise<string> {
  const storeId = `current_localdb_key_${userId}`;
  const existing = await SecureStore.getItemAsync(storeId);
  if (existing) return existing;
  const bytes = Crypto.getRandomBytes(32); // 256-bit key
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await SecureStore.setItemAsync(storeId, hex, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return hex;
}

async function getDb(userId: string): Promise<SQLite.SQLiteDatabase> {
  const cached = dbCache.get(userId);
  if (cached) return cached;

  const db = await SQLite.openDatabaseAsync(`current-chat-${userId}.db`);

  if (Platform.OS !== 'web') {
    // SQLCipher only actually exists in the native build (see the
    // useSQLCipher plugin option) — on web this would hit a vanilla WASM
    // SQLite with no SQLCipher extension, where PRAGMA key is meaningless.
    // Guarded so local dev/testing on web doesn't fail to open the
    // database at all; native builds always attempt real encryption.
    const keyHex = await getDbKeyHex(userId);
    await db.execAsync(`PRAGMA key = "x'${keyHex}'";`);
  }

  await db.execAsync(`
    create table if not exists messages (
      id text primary key,
      thread_key text not null,
      temp_id text not null,
      from_id text not null,
      to_id text,
      group_id text,
      kind text not null,
      text text,
      meta text,
      sent_at text not null,
      status text not null,
      fail_reason text,
      reply_to_id text,
      reactions text not null,
      edited integer not null default 0,
      deleted integer not null default 0
    );
    create index if not exists idx_messages_thread on messages(thread_key);

    create table if not exists pinned (
      thread_key text not null,
      message_id text not null,
      primary key (thread_key, message_id)
    );
  `);

  dbCache.set(userId, db);
  return db;
}

function rowToMessage(row: any): ChatMessage {
  return {
    id: row.id,
    tempId: row.temp_id,
    from: row.from_id,
    to: row.to_id ?? undefined,
    groupId: row.group_id ?? undefined,
    kind: row.kind,
    text: row.text ?? undefined,
    meta: row.meta ? JSON.parse(row.meta) : undefined,
    sentAt: row.sent_at,
    status: row.status,
    failReason: row.fail_reason ?? undefined,
    replyToId: row.reply_to_id ?? undefined,
    reactions: JSON.parse(row.reactions),
    edited: !!row.edited,
    deleted: !!row.deleted,
  };
}

/** Loads every persisted thread for this user, keyed the same way chatStore's `threads` is. */
export async function loadAllThreads(userId: string): Promise<Record<string, ChatMessage[]>> {
  const db = await getDb(userId);
  const rows = await db.getAllAsync<any>('select * from messages order by sent_at asc');
  const threads: Record<string, ChatMessage[]> = {};
  for (const row of rows) {
    (threads[row.thread_key] ??= []).push(rowToMessage(row));
  }
  return threads;
}

export async function loadPinned(userId: string): Promise<Record<string, string[]>> {
  const db = await getDb(userId);
  const rows = await db.getAllAsync<{ thread_key: string; message_id: string }>('select * from pinned');
  const pinned: Record<string, string[]> = {};
  for (const row of rows) {
    (pinned[row.thread_key] ??= []).push(row.message_id);
  }
  return pinned;
}

/** Upsert — the one function every mutation path in chatStore.ts calls after updating in-memory state. */
export async function saveMessage(userId: string, threadKey: string, message: ChatMessage): Promise<void> {
  const db = await getDb(userId);
  await db.runAsync(
    `insert into messages (id, thread_key, temp_id, from_id, to_id, group_id, kind, text, meta, sent_at, status, fail_reason, reply_to_id, reactions, edited, deleted)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(id) do update set
       thread_key=excluded.thread_key, temp_id=excluded.temp_id, from_id=excluded.from_id, to_id=excluded.to_id,
       group_id=excluded.group_id, kind=excluded.kind, text=excluded.text, meta=excluded.meta, sent_at=excluded.sent_at,
       status=excluded.status, fail_reason=excluded.fail_reason, reply_to_id=excluded.reply_to_id,
       reactions=excluded.reactions, edited=excluded.edited, deleted=excluded.deleted`,
    [
      message.id,
      threadKey,
      message.tempId,
      message.from,
      message.to ?? null,
      message.groupId ?? null,
      message.kind,
      message.text ?? null,
      message.meta ? JSON.stringify(message.meta) : null,
      message.sentAt,
      message.status,
      message.failReason ?? null,
      message.replyToId ?? null,
      JSON.stringify(message.reactions ?? {}),
      message.edited ? 1 : 0,
      message.deleted ? 1 : 0,
    ]
  );
}

/**
 * A message's id changes from a client-generated tempId to the server's
 * real messageId once message:sent arrives — the SQLite row (primary key
 * `id`) needs to move with it rather than leaving an orphaned tempId row
 * behind next to a new one.
 */
export async function renameMessageId(userId: string, oldId: string, newId: string): Promise<void> {
  const db = await getDb(userId);
  await db.runAsync('update messages set id = ? where id = ?', [newId, oldId]);
}

export async function setPinned(userId: string, threadKey: string, messageId: string, pinned: boolean): Promise<void> {
  const db = await getDb(userId);
  if (pinned) {
    await db.runAsync('insert or ignore into pinned (thread_key, message_id) values (?, ?)', [threadKey, messageId]);
  } else {
    await db.runAsync('delete from pinned where thread_key = ? and message_id = ?', [threadKey, messageId]);
  }
}

/** Wipes this user's local history entirely — not currently wired to any UI, kept available (e.g. a future "clear local history" setting). */
export async function clearLocalHistory(userId: string): Promise<void> {
  const db = await getDb(userId);
  await db.execAsync('delete from messages; delete from pinned;');
}

/** "Clear chat" — wipes one conversation's local history only (not the
 * whole account's, see clearLocalHistory above). This device only: never
 * touches the other party's copy, since there's nothing server-side to
 * clear from in the first place. */
export async function deleteThreadLocal(userId: string, threadKey: string): Promise<void> {
  const db = await getDb(userId);
  await db.runAsync('delete from messages where thread_key = ?', [threadKey]);
  await db.runAsync('delete from pinned where thread_key = ?', [threadKey]);
}
