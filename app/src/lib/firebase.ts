import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';

/**
 * Firebase Phone Auth (OTP) — the mandatory second verification factor
 * alongside Supabase email auth. Requires native config: see
 * docs/SETUP.md for GoogleService-Info.plist / google-services.json.
 *
 * NOTE: this uses the native @react-native-firebase SDK (Play Integrity /
 * silent APNs verification instead of a visible reCAPTCHA), which means the
 * app must run in a custom EAS dev client / prebuilt native project — not
 * plain Expo Go, which can't load native Firebase modules.
 */

export async function sendPhoneOtp(e164Phone: string): Promise<FirebaseAuthTypes.ConfirmationResult> {
  return auth().signInWithPhoneNumber(e164Phone);
}

export async function confirmPhoneOtp(
  confirmation: FirebaseAuthTypes.ConfirmationResult,
  code: string
): Promise<FirebaseAuthTypes.UserCredential> {
  const cred = await confirmation.confirm(code);
  if (!cred) throw new Error('Incorrect verification code.');
  return cred;
}

export function getFirebaseUid(): string | null {
  return auth().currentUser?.uid ?? null;
}

export async function signOutFirebase(): Promise<void> {
  if (auth().currentUser) await auth().signOut();
}
