import { supabase } from './supabase';
import { generateFriendlyUsername } from './usernameGen';

/**
 * FILE PURPOSE / function doc: single-export file — finalizeAccount()
 * creates (or completes) the public.users row once email is verified. This
 * is the single point where an account becomes "real" — before this, the
 * auth.users row exists but the account can't be discovered, added as a
 * contact, or message anyone.
 */
export async function finalizeAccount(params: { userId: string; username: string; email: string }) {
  const { userId, username, email } = params;
  const { error } = await supabase.from('users').upsert(
    {
      id: userId,
      username,
      display_name: username,
      email,
      email_verified: true,
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

/** True only when the database refused the row because the USERNAME is already
 * taken (unique violation on users.username) — not for network or other errors. */
export function isUsernameCollision(err: any): boolean {
  if (!err || err.code !== '23505') return false;
  const text = `${err.message ?? ''} ${err.details ?? ''}`.toLowerCase();
  return text.includes('username');
}

const FINALIZE_ATTEMPTS = 3;
const FINALIZE_RETRY_DELAY_MS = 1500;

/**
 * Creates the profile row for a freshly verified account and returns the
 * username that was actually stored.
 *
 * The chosen username is only ever replaced when it is genuinely taken
 * (`replaced: true` so the caller can tell the user). A network drop or
 * server error retries the SAME username and, if it keeps failing, throws —
 * the old code swapped in a random name on any error, so a bad connection
 * silently gave people a username they never chose.
 */
export async function finalizeAccountWithRetry(
  params: { userId: string; username: string; email: string },
  deps: { finalize?: typeof finalizeAccount; random?: () => string; wait?: (ms: number) => Promise<void> } = {}
): Promise<{ username: string; replaced: boolean }> {
  const finalize = deps.finalize ?? finalizeAccount;
  const random = deps.random ?? generateFriendlyUsername;
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let username = params.username;
  let replaced = false;
  let lastError: any;
  for (let attempt = 0; attempt < FINALIZE_ATTEMPTS; attempt++) {
    try {
      await finalize({ userId: params.userId, username, email: params.email });
      return { username, replaced };
    } catch (e: any) {
      lastError = e;
      if (isUsernameCollision(e)) {
        username = random();
        replaced = true;
      } else if (attempt < FINALIZE_ATTEMPTS - 1) {
        await wait(FINALIZE_RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
}
