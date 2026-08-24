import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

/**
 * FILE PURPOSE: Key generation and per-message encrypt/decrypt for E2E
 * messaging — see keystore.ts for where the generated keys are persisted.
 *
 * Simple per-message E2E encryption (agreed scope: no ratcheting / forward secrecy).
 * NaCl box = X25519 (Curve25519) key agreement + XSalsa20-Poly1305 AEAD — the same
 * primitives libsodium's crypto_box wraps; tweetnacl is a pure-JS implementation of
 * the same NaCl construction, chosen so it runs in Expo Go with zero native modules.
 * If you later want a native libsodium binding, swap this file for
 * `react-native-libsodium` — the call sites in the app don't need to change shape.
 */

export interface KeyPairB64 {
  publicKey: string;
  secretKey: string;
}

// Generates a fresh X25519 keypair for one device, base64-encoded for
// storage/transport.
export function generateKeyPair(): KeyPairB64 {
  const kp = nacl.box.keyPair();
  return { publicKey: encodeBase64(kp.publicKey), secretKey: encodeBase64(kp.secretKey) };
}

export interface EncryptedPayload {
  nonce: string; // base64
  ciphertext: string; // base64
}

// Encrypts plaintext for one recipient using the sender's secret key and
// the recipient's public key (NaCl box) with a fresh random nonce.
export function encryptMessage(plaintext: string, recipientPublicKeyB64: string, senderSecretKeyB64: string): EncryptedPayload {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const message = decodeUTF8(plaintext);
  const recipientPublicKey = decodeBase64(recipientPublicKeyB64);
  const senderSecretKey = decodeBase64(senderSecretKeyB64);
  const box = nacl.box(message, nonce, recipientPublicKey, senderSecretKey);
  return { nonce: encodeBase64(nonce), ciphertext: encodeBase64(box) };
}

// Reverses encryptMessage. Returns null (rather than throwing) on any
// failure — wrong key, tampered ciphertext, malformed base64 — so callers
// can treat "can't decrypt" as a normal, displayable outcome.
export function decryptMessage(payload: EncryptedPayload, senderPublicKeyB64: string, recipientSecretKeyB64: string): string | null {
  try {
    const nonce = decodeBase64(payload.nonce);
    const ciphertext = decodeBase64(payload.ciphertext);
    const senderPublicKey = decodeBase64(senderPublicKeyB64);
    const recipientSecretKey = decodeBase64(recipientSecretKeyB64);
    const opened = nacl.box.open(ciphertext, nonce, senderPublicKey, recipientSecretKey);
    if (!opened) return null;
    return encodeUTF8(opened);
  } catch {
    return null;
  }
}
