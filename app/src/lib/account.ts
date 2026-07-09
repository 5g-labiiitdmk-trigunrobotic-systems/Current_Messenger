import { supabase } from './supabase';

/**
 * Creates (or completes) the public.users row once email is verified. This
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
