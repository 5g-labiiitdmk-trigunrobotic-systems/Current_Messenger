import { supabase } from './supabase';

// Same rule enforced by the DB check constraint on public.users.username —
// keep in sync with supabase/migrations/0001_init.sql. Single source of
// truth for both the signup flow and the post-signup username-change
// feature (settings.tsx via authStore.ts's changeUsername) — previously
// duplicated independently in three places.
export const USERNAME_RE = /^[a-z0-9_.]{3,24}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Returns a user-facing error string if the format is invalid, or null if it's fine. */
export function usernameFormatError(raw: string): string | null {
  if (!USERNAME_RE.test(normalizeUsername(raw))) {
    return 'Use 3-24 characters: lowercase letters, numbers, "_" or "."';
  }
  return null;
}

/**
 * Checks the database directly — the actual source of truth (the unique
 * constraint on users.username) — not just format. `excludeUserId` lets an
 * already-registered user check availability while ignoring their own
 * current row (see authStore.ts's changeUsername).
 */
export async function isUsernameTaken(username: string, excludeUserId?: string): Promise<boolean> {
  let query = supabase.from('users').select('id').eq('username', username);
  if (excludeUserId) query = query.neq('id', excludeUserId);
  const { data } = await query.maybeSingle();
  return !!data;
}
