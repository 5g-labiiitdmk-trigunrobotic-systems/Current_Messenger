import { supabaseAdmin } from './supabaseAdmin.js';
import { relayState, type Group, type GroupPersistence } from './state.js';

// FILE PURPOSE: keeps relay groups in Postgres (tables relay_groups and
// relay_group_members, migration 0012) so a relay restart no longer wipes
// them. Only names, owners and member ids are stored — never messages.
//
// Writes go through ONE queue so they reach the database in the order they
// happened (a group row must exist before its members; a delete must not
// overtake an earlier save). A failed write is logged and skipped; the live
// in-memory state keeps working.

type Op = () => Promise<void>;
let queue: Promise<void> = Promise.resolve();

function enqueue(label: string, op: Op) {
  queue = queue.then(async () => {
    try {
      await op();
    } catch (e) {
      console.error(`[groups] ${label} failed:`, e instanceof Error ? e.message : e);
    }
  });
}

function check(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

export const postgresGroupPersistence: GroupPersistence = {
  saveGroup(g) {
    const row = { id: g.id, name: g.name, owner_id: g.ownerId, is_broadcast: g.isBroadcast };
    const members = [...g.memberIds].map((u) => ({ group_id: g.id, user_id: u, is_admin: g.admins.has(u) }));
    enqueue('saveGroup', async () => {
      check('group', (await supabaseAdmin.from('relay_groups').upsert(row)).error);
      if (members.length) check('members', (await supabaseAdmin.from('relay_group_members').upsert(members)).error);
    });
  },
  saveMember(groupId, userId, isAdmin) {
    enqueue('saveMember', async () => {
      check('member', (await supabaseAdmin.from('relay_group_members').upsert({ group_id: groupId, user_id: userId, is_admin: isAdmin })).error);
    });
  },
  removeMember(groupId, userId) {
    enqueue('removeMember', async () => {
      check('member', (await supabaseAdmin.from('relay_group_members').delete().eq('group_id', groupId).eq('user_id', userId)).error);
    });
  },
  deleteGroup(groupId) {
    enqueue('deleteGroup', async () => {
      check('group', (await supabaseAdmin.from('relay_groups').delete().eq('id', groupId)).error);
    });
  },
};

/** Reads every stored group. Throws if the database cannot be read. */
export async function loadStoredGroups(): Promise<Group[]> {
  const groupsRes = await supabaseAdmin.from('relay_groups').select('id,name,owner_id,is_broadcast,created_at').limit(100000);
  if (groupsRes.error) throw new Error(groupsRes.error.message);
  const membersRes = await supabaseAdmin.from('relay_group_members').select('group_id,user_id,is_admin').limit(1000000);
  if (membersRes.error) throw new Error(membersRes.error.message);
  const byId = new Map<string, Group>();
  for (const r of groupsRes.data ?? []) {
    byId.set(r.id, {
      id: r.id,
      name: r.name,
      ownerId: r.owner_id,
      memberIds: new Set(),
      admins: new Set(),
      isBroadcast: !!r.is_broadcast,
      createdAt: Date.parse(r.created_at) || Date.now(),
    });
  }
  for (const m of membersRes.data ?? []) {
    const g = byId.get(m.group_id);
    if (!g) continue;
    g.memberIds.add(m.user_id);
    if (m.is_admin) g.admins.add(m.user_id);
  }
  // A group with nobody in it is leftover; it can't be used.
  return [...byId.values()].filter((g) => g.memberIds.size > 0);
}

/** Loads stored groups into the relay, retrying until the database answers.
 * Persistence is switched on only AFTER a successful load, so a failed read
 * can never be followed by writes that overwrite stored groups with less. */
export function startGroupPersistence() {
  let attempt = 0;
  const tryLoad = async () => {
    attempt++;
    try {
      const groups = await loadStoredGroups();
      relayState.restoreGroups(groups);
      // Groups made while the database was unreachable exist only in memory:
      // write them out now.
      const live = relayState.getAllGroups();
      relayState.setGroupPersistence(postgresGroupPersistence);
      for (const g of live) if (!groups.some((x) => x.id === g.id)) postgresGroupPersistence.saveGroup(g);
      console.log(`[groups] restored ${groups.length} group(s) from the database`);
    } catch (e) {
      console.error(`[groups] could not load stored groups (attempt ${attempt}); retrying in 15s:`, e instanceof Error ? e.message : e);
      setTimeout(tryLoad, 15_000);
    }
  };
  void tryLoad();
}
