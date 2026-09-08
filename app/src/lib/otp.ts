// FILE PURPOSE: Provider-agnostic phone/OTP verification service layer.
// sendOtp()/verifyOtp() below are the only two functions the UI (see
// app/phone-auth/entry.tsx and app/phone-auth/verify.tsx) ever calls —
// today they run against a local, in-memory mock provider that simulates
// a real SMS round-trip (network delay, a real generated code, right/
// wrong-code outcomes). Swapping in a real provider later means writing
// one more object of the same OtpProvider shape and reassigning
// `activeProvider` below — nothing in the UI needs to change.
//
// NOT WIRED UP: this file, and the two screens that call it, are not
// reachable from the live signup/login flow yet — see the TODO block
// near the bottom of this file for exactly what "wiring it in" would
// mean, and docs/SETUP.md's "Phone/OTP verification" section for what a
// real provider needs configured before that can happen. This app has
// already built and removed phone verification twice before (Firebase
// Phone Auth, both times, over its Blaze-billing-plan requirement — see
// docs/SETUP.md section 2) — this file is deliberately provider-agnostic
// specifically so a non-Firebase provider (MSG91 is the leading
// candidate) can be dropped in without repeating that cycle a third time.

export interface OtpSendResult {
  ok: boolean;
  /** User-facing reason when ok is false (e.g. "Enter a valid phone number."). */
  error?: string;
}

export interface OtpVerifyResult {
  ok: boolean;
  /** User-facing reason when ok is false (e.g. "That code is incorrect."). */
  error?: string;
}

/**
 * The shape any OTP backend — mock or real — must implement. `phoneNumber`
 * is always the full E.164-formatted number (e.g. "+919876543210" — see
 * phone-auth/entry.tsx's formatting), never a bare local number, so a real
 * provider implementation never has to guess or reconstruct the country
 * code.
 */
export interface OtpProvider {
  /** Requests a fresh code be sent to phoneNumber. Resolves once the send
   * attempt itself completes (queued with the SMS gateway) — not once the
   * SMS is actually delivered, which no provider can promise synchronously. */
  sendOtp(phoneNumber: string): Promise<OtpSendResult>;
  /** Checks `code` against whatever was most recently sent to phoneNumber. */
  verifyOtp(phoneNumber: string, code: string): Promise<OtpVerifyResult>;
}

export const OTP_CODE_LENGTH = 6;

// Simulated network latency, so the UI's loading states (spinner on
// "Send code", the resend button's disabled moment) are exercised
// realistically instead of resolving instantly.
const MOCK_NETWORK_DELAY_MS = 900;

// phoneNumber -> the code most recently "sent" to it, plus when — module-
// scope, not persisted anywhere, matching this app's usual "nothing
// sensitive survives a restart unless it's explicitly meant to" posture.
// A restart simply forgets every pending code, same as a real provider's
// server-side session would eventually expire one.
const pendingCodes = new Map<string, { code: string; sentAt: number }>();

// A pending code is treated as expired after this long — mirrors a real
// provider's own OTP TTL (MSG91's default is 15 minutes; kept much
// shorter here purely so the "expired code" path is actually reachable
// during manual testing without waiting).
const MOCK_CODE_TTL_MS = 5 * 60_000;

function randomSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Same basic E.164 shape check used client-side by phone-auth/entry.tsx —
// duplicated here (not imported from there) because a real provider's
// backend would run this exact check server-side regardless of what the
// client already validated, and the mock should behave the same way.
const E164_RE = /^\+[1-9]\d{7,14}$/;

/**
 * Mock/stub implementation. Simulates success and failure the same way a
 * real SMS gateway would surface them to this layer — invalid number,
 * wrong code, expired code — without ever making a network call or
 * touching a real phone. The generated code is deliberately logged to the
 * console (clearly tagged, dev-build-only in spirit) since there is no
 * inbox to check it in — that log line *is* this mock's "SMS".
 */
export const mockOtpProvider: OtpProvider = {
  async sendOtp(phoneNumber) {
    await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS));
    if (!E164_RE.test(phoneNumber)) {
      return { ok: false, error: 'That phone number looks invalid.' };
    }
    const code = randomSixDigitCode();
    pendingCodes.set(phoneNumber, { code, sentAt: Date.now() });
    // eslint-disable-next-line no-console
    console.log(`[otp:mock] "Sent" ${OTP_CODE_LENGTH}-digit code ${code} to ${phoneNumber} (no real SMS — this is the mock provider, see src/lib/otp.ts)`);
    return { ok: true };
  },

  async verifyOtp(phoneNumber, code) {
    await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS));
    const pending = pendingCodes.get(phoneNumber);
    if (!pending) {
      return { ok: false, error: 'No code was sent to this number — request a new one.' };
    }
    if (Date.now() - pending.sentAt > MOCK_CODE_TTL_MS) {
      pendingCodes.delete(phoneNumber);
      return { ok: false, error: 'That code has expired — request a new one.' };
    }
    if (code !== pending.code) {
      return { ok: false, error: 'That code is incorrect.' };
    }
    // One-time use, same as a real provider — a second verify attempt
    // with the same (now-consumed) code should not silently succeed again.
    pendingCodes.delete(phoneNumber);
    return { ok: true };
  },
};

/**
 * The provider every call in this file actually goes through. Swapping
 * providers is exactly this one line — see the TODO block below for what
 * a real implementation needs to do before it can replace this.
 */
const activeProvider: OtpProvider = mockOtpProvider;

export async function sendOtp(phoneNumber: string): Promise<OtpSendResult> {
  return activeProvider.sendOtp(phoneNumber);
}

export async function verifyOtp(phoneNumber: string, code: string): Promise<OtpVerifyResult> {
  return activeProvider.verifyOtp(phoneNumber, code);
}

// TODO(real SMS provider — MSG91 is the leading candidate, see
// docs/SETUP.md's "Phone/OTP verification" section for the full
// checklist): implement a second OtpProvider object here (e.g.
// `msg91OtpProvider`) and reassign `activeProvider` above to it. That
// implementation must NOT call MSG91's API directly from this client —
// MSG91's auth key is a secret and this project already keeps every
// comparable secret server-side only (Supabase's service-role key lives
// in server/src/supabaseAdmin.ts, never in the app bundle; see that
// file's own doc comment). The real sendOtp/verifyOtp here should instead
// call a small HTTP endpoint added to the existing relay server
// (server/src/index.ts already runs one process this app already trusts
// and already talks to) or a Supabase Edge Function, which holds the
// MSG91 auth key server-side and proxies the actual MSG91 API calls.
// Neither screen that calls sendOtp/verifyOtp needs to change at all —
// they only ever see the OtpSendResult/OtpVerifyResult shapes above,
// never anything provider-specific.
