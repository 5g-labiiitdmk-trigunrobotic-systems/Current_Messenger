// FILE PURPOSE: Static country-dial-code list for phone-auth/entry.tsx's
// country picker. Intentionally a short, hand-picked list (not every
// ITU-assigned code) — a full ~240-entry list is easy to add later if
// this screen ever ships for real, but isn't worth the bundle weight for
// code that isn't reachable from any live flow yet (see this file's
// callers for that scope note).
export interface CountryCode {
  iso2: string;
  name: string;
  dialCode: string;
  flag: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { iso2: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳' },
  { iso2: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
  { iso2: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦' },
  { iso2: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
  { iso2: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺' },
  { iso2: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪' },
  { iso2: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬' },
  { iso2: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪' },
  { iso2: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷' },
  { iso2: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵' },
  { iso2: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳' },
  { iso2: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷' },
  { iso2: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦' },
  { iso2: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬' },
  { iso2: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰' },
  { iso2: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩' },
  { iso2: 'LK', name: 'Sri Lanka', dialCode: '+94', flag: '🇱🇰' },
  { iso2: 'NP', name: 'Nepal', dialCode: '+977', flag: '🇳🇵' },
];

export const DEFAULT_COUNTRY_CODE: CountryCode = COUNTRY_CODES[0]; // India, +91

// Per-country national-number length, used for lightweight client-side
// validation before ever calling sendOtp() — deliberately loose (a min/max
// range, not exact per-country rules) since real E.164 validation is
// notoriously irregular; anything in a plausible range is accepted here
// and the real gate is always the OTP round-trip itself, same as any real
// phone-verification flow. Falls back to the generic ITU range (min 7,
// max 12) for any country not explicitly listed above.
export const NATIONAL_NUMBER_LENGTH: Record<string, { min: number; max: number }> = {
  IN: { min: 10, max: 10 },
  US: { min: 10, max: 10 },
  CA: { min: 10, max: 10 },
  GB: { min: 10, max: 10 },
  AU: { min: 9, max: 9 },
  AE: { min: 9, max: 9 },
  SG: { min: 8, max: 8 },
  DE: { min: 10, max: 11 },
  FR: { min: 9, max: 9 },
  JP: { min: 10, max: 10 },
  CN: { min: 11, max: 11 },
  BR: { min: 10, max: 11 },
  ZA: { min: 9, max: 9 },
  NG: { min: 10, max: 10 },
  PK: { min: 10, max: 10 },
  BD: { min: 10, max: 10 },
  LK: { min: 9, max: 9 },
  NP: { min: 10, max: 10 },
};

export const DEFAULT_NATIONAL_NUMBER_LENGTH = { min: 7, max: 12 };
