import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import type { ChatMessage } from '../state/chatStore';
import type { CallLogEntry } from '../state/callStore';
import { appAlert } from '../state/alertStore';

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

// Two prior rounds fixed this file "blind" — the SQLCipher key/file
// recovery logic below, and catch-and-alert at the chatStore/callStore
// hydration call sites — without ever actually seeing what fails on the
// one real device still reportedly broken. Both of those only covered
// *initialization*; individual reads/writes (loadAllThreads, saveMessage,
// etc.) still had zero error handling of their own, so a device-specific
// failure at any of THOSE points was just as silently swallowed as the
// original bug. Every exported function below now goes through this, so
// any failure anywhere in this file becomes a real, visible, on-device
// alert with the actual error message — not just a console.error nobody
// can see without a debugger attached to the specific failing device.
let lastAlertAt = 0;
const ALERT_COOLDOWN_MS = 4000; // a burst of failures (e.g. Promise.all([loadAllThreads, loadPinned])) shows one alert, not several back to back

function reportDbError(context: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error(`[localDb] ${context} failed:`, message);
  const now = Date.now();
  if (now - lastAlertAt < ALERT_COOLDOWN_MS) return;
  lastAlertAt = now;
  appAlert(`Local storage error — ${context}`, message);
}

/** Runs `fn`, surfacing (but not swallowing) any failure — see the doc
 * comment above. Callers keep their own existing error handling
 * unchanged; this only adds visibility on top of it. */
async function withDbErrorAlert<T>(context: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    reportDbError(context, err);
    throw err;
  }
}

async function getDbKeyHex(userId: string): Promise<string> {
  return withDbErrorAlert('reading/creating encryption key', async () => {
    const storeId = `current_localdb_key_${userId}`;
    const existing = await SecureStore.getItemAsync(storeId);
    if (existing) return existing;
    const bytes = Crypto.getRandomBytes(32); // 256-bit key
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await SecureStore.setItemAsync(storeId, hex, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    return hex;
  });
}

const SCHEMA_SQL = `
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

  create table if not exists call_logs (
    id text primary key,
    peer_id text not null,
    direction text not null,
    kind text not null,
    at text not null,
    duration_sec integer
  );
  create index if not exists idx_call_logs_at on call_logs(at);
`;

/**
 * Opens (or creates) this account's on-disk database, applies its
 * SQLCipher key, and ensures the schema exists. `isRecoveryAttempt` guards
 * against retrying forever — see the catch block below.
 *
 * The encryption key (SecureStore/Keychain/Keystore) and the encrypted
 * data (a plain file in app storage) are two independent stores with
 * nothing cross-referencing them. Anything that desyncs them — Android's
 * Auto Backup restores app files on reinstall but never Keystore-backed
 * keys (they're hardware-bound and the OS explicitly excludes them from
 * backup); an iOS device restore/migration can carry the file without a
 * THIS_DEVICE_ONLY Keychain item; a Keystore key can be invalidated by a
 * device security-state change — leaves an old, still-encrypted file
 * paired with a key that can't open it. This is exactly the failure mode
 * that only ever shows up for accounts with *some* prior on-device state
 * (a returning install, a restored backup, a re-signed build), never for
 * an account whose key and file are both being created fresh together
 * right now — which is why it can look like "works for new accounts,
 * broken for old ones" even though the code path is identical for both.
 */
async function openAndInitDb(userId: string, dbName: string, isRecoveryAttempt = false): Promise<SQLite.SQLiteDatabase> {
  const db = await withDbErrorAlert('opening local database', () => SQLite.openDatabaseAsync(dbName));

  if (Platform.OS !== 'web') {
    // SQLCipher only actually exists in the native build (see the
    // useSQLCipher plugin option) — on web this would hit a vanilla WASM
    // SQLite with no SQLCipher extension, where PRAGMA key is meaningless.
    // Guarded so local dev/testing on web doesn't fail to open the
    // database at all; native builds always attempt real encryption.
    const keyHex = await getDbKeyHex(userId);
    await withDbErrorAlert('applying encryption key', () => db.execAsync(`PRAGMA key = "x'${keyHex}'";`));
  }

  try {
    // The PRAGMA key call above never fails by itself — SQLCipher only
    // discovers a wrong/mismatched key once it actually tries to read the
    // file's real content, which is this statement, not the one above.
    await db.execAsync(SCHEMA_SQL);
  } catch (err) {
    if (isRecoveryAttempt) {
      reportDbError(`initializing "${dbName}" (still failing after resetting the local file once)`, err);
      throw err; // already tried a fresh file once — something else is wrong, let it surface for real
    }

    reportDbError(`initializing "${dbName}" (likely an undecryptable/stale local file) — resetting local history for this account`, err);
    await db.closeAsync().catch(() => {});
    await SQLite.deleteDatabaseAsync(dbName).catch(() => {});
    // The file that just failed is gone; whatever key we hold now (existing
    // or freshly generated) becomes the correct key for the brand-new file
    // this creates, so this does not loop — it recovers, once. This cannot
    // bring back the old, now-unreadable history (that isn't possible
    // without the original key, same as losing the device that held it),
    // but it stops every future launch from failing the same way forever.
    return openAndInitDb(userId, dbName, true);
  }

  return db;
}

async function getDb(userId: string): Promise<SQLite.SQLiteDatabase> {
  const cached = dbCache.get(userId);
  if (cached) return cached;

  const db = await openAndInitDb(userId, `current-chat-${userId}.db`);
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
  return withDbErrorAlert('loading chat history', async () => {
    const db = await getDb(userId);
    const rows = await db.getAllAsync<any>('select * from messages order by sent_at asc');
    const threads: Record<string, ChatMessage[]> = {};
    for (const row of rows) {
      (threads[row.thread_key] ??= []).push(rowToMessage(row));
    }
    return threads;
  });
}

export async function loadPinned(userId: string): Promise<Record<string, string[]>> {
  return withDbErrorAlert('loading pinned messages', async () => {
    const db = await getDb(userId);
    const rows = await db.getAllAsync<{ thread_key: string; message_id: string }>('select * from pinned');
    const pinned: Record<string, string[]> = {};
    for (const row of rows) {
      (pinned[row.thread_key] ??= []).push(row.message_id);
    }
    return pinned;
  });
}

/** Upsert — the one function every mutation path in chatStore.ts calls after updating in-memory state. */
export async function saveMessage(userId: string, threadKey: string, message: ChatMessage): Promise<void> {
  return withDbErrorAlert('saving message', async () => {
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
  });
}

/**
 * A message's id changes from a client-generated tempId to the server's
 * real messageId once message:sent arrives — the SQLite row (primary key
 * `id`) needs to move with it rather than leaving an orphaned tempId row
 * behind next to a new one.
 */
export async function renameMessageId(userId: string, oldId: string, newId: string): Promise<void> {
  return withDbErrorAlert('updating message id', async () => {
    const db = await getDb(userId);
    await db.runAsync('update messages set id = ? where id = ?', [newId, oldId]);
  });
}

export async function setPinned(userId: string, threadKey: string, messageId: string, pinned: boolean): Promise<void> {
  return withDbErrorAlert('updating pinned message', async () => {
    const db = await getDb(userId);
    if (pinned) {
      await db.runAsync('insert or ignore into pinned (thread_key, message_id) values (?, ?)', [threadKey, messageId]);
    } else {
      await db.runAsync('delete from pinned where thread_key = ? and message_id = ?', [threadKey, messageId]);
    }
  });
}

/** Wipes this user's local history entirely — not currently wired to any UI, kept available (e.g. a future "clear local history" setting). */
export async function clearLocalHistory(userId: string): Promise<void> {
  return withDbErrorAlert('clearing local history', async () => {
    const db = await getDb(userId);
    await db.execAsync('delete from messages; delete from pinned;');
  });
}

/** "Clear chat" — wipes one conversation's local history only (not the
 * whole account's, see clearLocalHistory above). This device only: never
 * touches the other party's copy, since there's nothing server-side to
 * clear from in the first place. */
export async function deleteThreadLocal(userId: string, threadKey: string): Promise<void> {
  return withDbErrorAlert('clearing chat', async () => {
    const db = await getDb(userId);
    await db.runAsync('delete from messages where thread_key = ?', [threadKey]);
    await db.runAsync('delete from pinned where thread_key = ?', [threadKey]);
  });
}

/**
 * Call log: same on-device-only, per-account, SQLCipher-encrypted pattern
 * as message history above — who called whom, when, for how long, and
 * whether it was answered/missed/declined. Never touches the server; the
 * relay has no concept of call history at all (server/src/state.ts's
 * activeRings is a purely ephemeral, few-seconds-lived ring-in-progress
 * marker, not a log — see its own doc comment).
 */
export async function loadCallLog(userId: string): Promise<CallLogEntry[]> {
  return withDbErrorAlert('loading call log', async () => {
    const db = await getDb(userId);
    const rows = await db.getAllAsync<any>('select * from call_logs order by at desc');
    return rows.map((row) => ({
      id: row.id,
      peerId: row.peer_id,
      direction: row.direction,
      kind: row.kind,
      at: row.at,
      durationSec: row.duration_sec ?? undefined,
    }));
  });
}

/** Upsert — called at call-start (ring sent/received) and again whenever
 * that entry changes (relabeled 'missed', duration filled in at call end). */
export async function saveCallLogEntry(userId: string, entry: CallLogEntry): Promise<void> {
  return withDbErrorAlert('saving call log entry', async () => {
    const db = await getDb(userId);
    await db.runAsync(
      `insert into call_logs (id, peer_id, direction, kind, at, duration_sec)
       values (?, ?, ?, ?, ?, ?)
       on conflict(id) do update set
         peer_id=excluded.peer_id, direction=excluded.direction, kind=excluded.kind,
         at=excluded.at, duration_sec=excluded.duration_sec`,
      [entry.id, entry.peerId, entry.direction, entry.kind, entry.at, entry.durationSec ?? null]
    );
  });
}
