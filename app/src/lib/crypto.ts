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

// Single definition shared with the wire protocol (nonce/ciphertext plus the
// optional senderPublicKey / recipientPublicKey / extras fields).
import type { EncryptedPayload } from '../types/relay';
export type { EncryptedPayload };

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

// Messages up to this many characters are additionally encrypted to the
// recipient's other devices (see encryptForKeys). Bigger payloads (photos,
// video, voice notes travel as base64 inside the encrypted JSON) are only
// encrypted to the newest key: copying a 20 MB video once per device would
// multiply relay traffic for no good reason.
export const MAX_EXTRA_DEVICE_CHARS = 64 * 1024;

/**
 * Encrypts `plaintext` for a recipient who may be signed in on several
 * devices. `recipientPublicKeys` is that user's active keys, NEWEST FIRST.
 *
 * - `nonce` / `ciphertext` are always the classic NaCl box to the newest key,
 *   exactly what every app version already knows how to read.
 * - `senderPublicKey` / `recipientPublicKey` tell the receiver which keys
 *   were used, so it doesn't have to guess.
 * - `extras` carries the same plaintext encrypted to each remaining key so
 *   the recipient's other devices can read it too (small messages only).
 */
export function encryptForKeys(plaintext: string, recipientPublicKeys: string[], sender: KeyPairB64): EncryptedPayload {
  const unique = recipientPublicKeys.filter((k, i) => recipientPublicKeys.indexOf(k) === i);
  const [first, ...rest] = unique;
  const payload: EncryptedPayload = {
    ...encryptMessage(plaintext, first, sender.secretKey),
    senderPublicKey: sender.publicKey,
    recipientPublicKey: first,
  };
  if (rest.length > 0 && plaintext.length <= MAX_EXTRA_DEVICE_CHARS) {
    payload.extras = rest.map((k) => ({ recipientPublicKey: k, ...encryptMessage(plaintext, k, sender.secretKey) }));
  }
  return payload;
}

/**
 * Opens a message when we don't know for certain which of the sender's keys
 * made it. `senderPublicKeys` must be the sender's active keys as published
 * in device_keys (never taken from the message itself, so a sender can't
 * pick an identity). Tries, in order:
 *   1. the copy addressed to OUR key (if the sender included extras),
 *   2. the main copy (also what every older app version sends),
 * each against the sender key named in the message first, then the rest.
 * Returns null if nothing opens — never throws.
 */
export function decryptPayload(payload: EncryptedPayload, senderPublicKeys: string[], me: KeyPairB64): string | null {
  const keys = payload.senderPublicKey && senderPublicKeys.includes(payload.senderPublicKey)
    ? [payload.senderPublicKey, ...senderPublicKeys.filter((k) => k !== payload.senderPublicKey)]
    : senderPublicKeys;

  const entries: { nonce: string; ciphertext: string }[] = [];
  if (payload.recipientPublicKey !== me.publicKey) {
    // Array.isArray: the payload comes off the wire, so don't trust its shape.
    const mine = Array.isArray(payload.extras) ? payload.extras.find((x) => x && x.recipientPublicKey === me.publicKey) : undefined;
    if (mine) entries.push(mine);
  }
  entries.push(payload);

  for (const entry of entries) {
    for (const senderKey of keys) {
      const opened = decryptMessage(entry, senderKey, me.secretKey);
      if (opened !== null) return opened;
    }
  }
  return null;
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
