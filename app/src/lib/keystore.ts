import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { generateKeyPair, type KeyPairB64 } from './crypto';
import { supabase } from './supabase';

const SECRET_KEY_STORE_ID = 'current_e2e_secret_key';

/**
 * Loads this device's E2E keypair for the given user, generating one on
 * first run. The private key is stored ONLY in the platform secure enclave
 * (Keychain/Keystore via expo-secure-store) and is never sent anywhere.
 * Only the public key is published to Supabase (device_keys), so the
 * server/relay can never decrypt.
 *
 * Namespaced by userId — this was previously a single fixed SecureStore
 * key shared by whichever account happened to be signed in, so two
 * different accounts signed into in sequence on the same device (e.g. two
 * test accounts created back-to-back on one phone/emulator) silently
 * reused the exact same keypair. That defeats E2E identity separation
 * between them (their messages would key-agree as if they were the same
 * person) and isn't caught by anything, since getOrCreateDeviceKeyPair()
 * happily "finds" the other account's key and returns it unchanged.
 */
export async function getOrCreateDeviceKeyPair(userId: string): Promise<KeyPairB64> {
  // NOT a ':' separator — expo-secure-store validates keys against
  // /^[\w.-]+$/ (confirmed by reading its actual source,
  // node_modules/expo-secure-store/src/SecureStore.ts's isValidKey/
  // ensureValidKey) and throws "Invalid key provided to SecureStore" for
  // anything outside alphanumerics, ".", "-", "_". A colon here was the
  // actual root cause of a real, universal, 100%-reproducing regression
  // on every native build: getItemAsync/setItemAsync threw on every
  // single call, for every user, the moment this namespacing was added.
  // That's invisible in this sandbox's own web-based smoke tests (they
  // never carry a real authenticated session, so this function was never
  // actually reached with a real userId) but broke every real caller:
  // sendText/sendRich/editMessage in chatStore.ts call this directly,
  // unguarded, so every message send failed silently with zero relay
  // traffic — while login kept working because ensureDeviceKeyPublished()
  // (authStore.ts) already catches this exact failure internally, and
  // calls (callStore.ts) never touch this function at all, which is
  // exactly the working-calls-but-not-messages split that was reported.
  const storeId = `${SECRET_KEY_STORE_ID}.${userId}`;
  const existingSecret = await SecureStore.getItemAsync(storeId);
  if (existingSecret) {
    const [publicKey, secretKey] = existingSecret.split('|');
    if (publicKey && secretKey) return { publicKey, secretKey };
  }
  const kp = generateKeyPair();
  await SecureStore.setItemAsync(storeId, `${kp.publicKey}|${kp.secretKey}`, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return kp;
}

/**
 * Called on every auth state change (app launch, foreground, token refresh —
 * not just "new device"), but getOrCreateDeviceKeyPair() returns the SAME
 * public key across all of those for a given device. Blindly inserting here
 * created a new device_keys row every single time, so "Active devices"
 * counted app launches instead of devices. Skip if this exact key is
 * already on record for this user.
 */
export async function publishPublicKey(userId: string, publicKey: string) {
  const { data: existing } = await supabase.from('device_keys').select('id').eq('user_id', userId).eq('public_key', publicKey).maybeSingle();
  if (existing) return;

  const deviceLabel = Platform.OS === 'ios' ? 'iOS device' : 'Android device';
  const applicationId = Application.applicationId ?? undefined;
  await supabase.from('device_keys').insert({
    user_id: userId,
    public_key: publicKey,
    device_label: applicationId ? `${deviceLabel} (${applicationId})` : deviceLabel,
    is_active: true,
  });
}

/**
 * Fetches a contact's current active public key for encryption. Always
 * queries fresh — this used to cache successful lookups in an in-memory
 * Map with no invalidation, which was a real, serious bug: a contact's
 * key legitimately changes (reinstall, this app's own SecureStore
 * format migrations earlier this session, a second device), and once
 * that happened, every OTHER user's already-cached copy of their old key
 * stayed wrong for the rest of that sender's app session — every message
 * to that contact would keep getting encrypted against a public key
 * nobody held the matching secret key for anymore, decrypting to
 * "[unable to decrypt]" on the receiving end, permanently, until the
 * sender's app happened to restart. Worse, fetchPublicKeyWithRetry's
 * retry loop was completely powerless against this: the cache is checked
 * BEFORE any network call, so every retry just re-read the same stale
 * cached value instead of ever re-querying Supabase — a "retry" that
 * never actually retried anything once a value was cached, regardless of
 * whether that value was still correct.
 *
 * device_keys.created_at DESC + LIMIT 1 already guarantees a fresh query
 * gets the CURRENT key even if a contact has old, never-deactivated
 * key rows sitting around, so removing the cache is not just safer, it
 * makes fetchPublicKeyWithRetry's retries meaningful for the first time
 * for this specific failure mode. The cost is one extra fast, indexed
 * Supabase SELECT per message send/decrypt — a correctness-critical path
 * for an E2E-encrypted messenger is exactly where that tradeoff belongs.
 */
export async function fetchPublicKey(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('device_keys')
    .select('public_key')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.public_key;
}

/**
 * Same as fetchPublicKey, but retries a few times before giving up —
 * specifically for decrypting an incoming message, where a one-shot null
 * result gets turned into a permanent "[unable to decrypt]" written to
 * local storage with no later retry. A brand-new account's key can still
 * be finishing its publishPublicKey() write (a background call, not
 * something message delivery waits on) at the exact moment the very first
 * message from/to them arrives — a transient race, not a permanent one,
 * so it deserves a transient retry instead of an immediate, permanent
 * failure. Total worst case wait here is under 2 seconds.
 */
export async function fetchPublicKeyWithRetry(userId: string, attempts = 4, delayMs = 500): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const key = await fetchPublicKey(userId);
    if (key) return key;
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}
