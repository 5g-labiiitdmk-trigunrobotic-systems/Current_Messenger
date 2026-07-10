import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

/**
 * TOTP backup/recovery codes. NOT a Supabase-native concept (unlike the TOTP
 * secret itself), so these live in our own totp_backup_codes table — only a
 * one-way SHA-256 hash is ever stored or transmitted, matching the same
 * never-plaintext-never-reversible rule as password storage. Each code is
 * single-use: used_at is set the moment it's consumed.
 *
 * Note: consuming a backup code satisfies only this app's own login gate
 * (authStore's mfaVerified flag) — it does not and cannot elevate Supabase's
 * own AAL (authenticator assurance level), since backup codes aren't a
 * Supabase Auth concept. A real TOTP code is still the only path that
 * advances Supabase's own session assurance level.
 */

const CODE_COUNT = 8;
const CODE_LENGTH = 10;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids misreads

function randomCode(): string {
  const bytes = Crypto.getRandomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

async function hashCode(code: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, code.toUpperCase());
}

/** Generates a fresh set of backup codes, stores only their hashes, and
 * returns the plaintext codes once so the UI can show them to the user —
 * this is the only moment the plaintext exists outside the user's own copy. */
export async function generateBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: CODE_COUNT }, randomCode);
  const rows = await Promise.all(
    codes.map(async (code) => ({ user_id: userId, code_hash: await hashCode(code) }))
  );
  // Replace any previous set — regenerating invalidates old codes.
  await supabase.from('totp_backup_codes').delete().eq('user_id', userId);
  const { error } = await supabase.from('totp_backup_codes').insert(rows);
  if (error) throw error;
  return codes;
}

/** Verifies and consumes a backup code. Returns true if it was valid and unused. */
export async function consumeBackupCode(userId: string, rawCode: string): Promise<boolean> {
  const hash = await hashCode(rawCode.trim());
  const { data, error } = await supabase
    .from('totp_backup_codes')
    .select('id')
    .eq('user_id', userId)
    .eq('code_hash', hash)
    .is('used_at', null)
    .maybeSingle();
  if (error || !data) return false;
  const { error: updateError } = await supabase
    .from('totp_backup_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', data.id)
    .is('used_at', null);
  return !updateError;
}
