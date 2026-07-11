import { supabase } from './supabase';

/**
 * Creates (or completes) the public.users row once both email and phone are
 * verified — the two mandatory verification factors. This is the single
 * point where an account becomes "real" — before this, the auth.users row
 * exists but the account can't be discovered, added as a contact, or
 * message anyone.
 */
export async function finalizeAccount(params: {
  userId: string;
  username: string;
  email: string;
  phone: string;
  firebaseUid: string;
}) {
  const { userId, username, email, phone, firebaseUid } = params;
  const { error } = await supabase.from('users').upsert(
    {
      id: userId,
      username,
      display_name: username,
      email,
      email_verified: true,
      phone,
      phone_verified: true,
      firebase_uid: firebaseUid,
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
}
