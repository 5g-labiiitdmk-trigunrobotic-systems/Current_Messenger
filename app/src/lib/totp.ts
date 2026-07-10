import { supabase } from './supabase';

/**
 * Thin wrapper around Supabase Auth's native MFA API. The TOTP secret is
 * generated and held entirely inside Supabase's own auth schema — it never
 * passes through, or is stored by, any code in this app. This is deliberate:
 * it avoids hand-rolling HMAC-SHA1/TOTP crypto client-side and gets
 * server-verified security for free. See auth.mfa.enroll/challenge/verify.
 */

export interface EnrollResult {
  factorId: string;
  qrCodeSvg: string;
  secret: string;
  otpauthUri: string;
}

export async function enrollTotp(): Promise<EnrollResult> {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) throw error;
  return {
    factorId: data.id,
    qrCodeSvg: data.totp.qr_code,
    secret: data.totp.secret,
    otpauthUri: data.totp.uri,
  };
}

/** Confirms enrollment by verifying the first code the user enters. */
export async function confirmTotpEnrollment(factorId: string, code: string): Promise<void> {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (error) throw error;
}

export async function unenrollTotp(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

/** The verified TOTP factor for the current user, if any. */
export async function getTotpFactor() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp.find((f) => f.status === 'verified') ?? null;
}

/** Login-time challenge: verifies a 6-digit code against an already-enrolled factor. */
export async function verifyTotpLogin(factorId: string, code: string): Promise<void> {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (error) throw error;
}

export async function hasVerifiedTotpFactor(): Promise<boolean> {
  const factor = await getTotpFactor();
  return !!factor;
}
