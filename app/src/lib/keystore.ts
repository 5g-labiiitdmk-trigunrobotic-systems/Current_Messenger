import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { generateKeyPair, type KeyPairB64 } from './crypto';
import { supabase } from './supabase';

const SECRET_KEY_STORE_ID = 'current_e2e_secret_key';

/**
 * Loads this device's E2E keypair, generating one on first run. The private
 * key is stored ONLY in the platform secure enclave (Keychain/Keystore via
 * expo-secure-store) and is never sent anywhere. Only the public key is
 * published to Supabase (device_keys), so the server/relay can never decrypt.
 */
export async function getOrCreateDeviceKeyPair(): Promise<KeyPairB64> {
  const existingSecret = await SecureStore.getItemAsync(SECRET_KEY_STORE_ID);
  if (existingSecret) {
    const [publicKey, secretKey] = existingSecret.split('|');
    if (publicKey && secretKey) return { publicKey, secretKey };
  }
  const kp = generateKeyPair();
  await SecureStore.setItemAsync(SECRET_KEY_STORE_ID, `${kp.publicKey}|${kp.secretKey}`, {
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

const keyCache = new Map<string, string>();

/** Fetches (and caches) a contact's current active public key for encryption. */
export async function fetchPublicKey(userId: string): Promise<string | null> {
  if (keyCache.has(userId)) return keyCache.get(userId)!;
  const { data, error } = await supabase
    .from('device_keys')
    .select('public_key')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  keyCache.set(userId, data.public_key);
  return data.public_key;
}
