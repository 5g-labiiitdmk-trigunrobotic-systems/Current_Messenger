// FILE PURPOSE: single-export file — fetchIceServers() below, see its own
// doc comment for what it does and why TURN credentials live server-side.
export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Public STUN-only server, used when the relay has no TURN config or is
// unreachable — no secret credentials involved, safe to hardcode.
const FALLBACK_ICE_SERVERS: IceServerConfig[] = [{ urls: 'stun:stun.l.google.com:19302' }];

/**
 * TURN credentials are secrets, so they're never in the app bundle — they're
 * fetched at call time from the relay server (already the trusted backend
 * for auth/contact-approval), which reads them from its own env vars. Falls
 * back to STUN-only if the relay is unreachable or has no TURN configured —
 * calls between devices on permissive networks will still connect P2P, just
 * without a relay fallback for strict NATs.
 */
export async function fetchIceServers(): Promise<IceServerConfig[]> {
  const wsUrl = process.env.EXPO_PUBLIC_RELAY_WS_URL;
  if (!wsUrl) return FALLBACK_ICE_SERVERS;
  const httpUrl = wsUrl.replace(/^ws/, 'http').replace(/\/$/, '') + '/ice-servers';
  try {
    const res = await fetch(httpUrl);
    if (!res.ok) return FALLBACK_ICE_SERVERS;
    const data = await res.json();
    return Array.isArray(data.iceServers) && data.iceServers.length > 0 ? data.iceServers : FALLBACK_ICE_SERVERS;
  } catch {
    return FALLBACK_ICE_SERVERS;
  }
}
