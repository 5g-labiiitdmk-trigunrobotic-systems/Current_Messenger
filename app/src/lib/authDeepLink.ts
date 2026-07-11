import { supabase } from './supabase';

/**
 * Supabase's default "Confirm signup" email is a clickable link (not a
 * code) unless you configure custom SMTP with a code-based template. This
 * app is built against the default: the link opens AUTH_REDIRECT_URL with
 * the session tokens appended after a `#`, e.g.
 * `current://auth-redirect#access_token=...&refresh_token=...&type=signup`.
 * We parse that out and hand it to supabase-js directly — no code entry UI.
 *
 * This must be a fixed literal string, not `Linking.createURL(...)` — that
 * helper can bake in the local Metro dev-server host when running in a
 * development client connected to a packager, making the URL differ per
 * machine/network. Since react-native-webrtc (calling) already requires a
 * real dev-client/standalone build (never Expo Go) for this whole app, the
 * scheme is always exactly "current" — so we hardcode it, and this exact
 * string must be added to Supabase's Auth -> URL Configuration -> Redirect
 * URLs allow-list, or the confirmation link will fail with an error page
 * instead of returning to the app.
 */
export const AUTH_REDIRECT_URL = 'current://auth-redirect';

export interface AuthDeepLinkResult {
  status: 'session' | 'error' | 'ignored';
  message?: string;
}

function extractParams(url: string): Record<string, string> {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const cut = hashIndex >= 0 ? hashIndex : queryIndex;
  if (cut < 0) return {};
  const raw = url.slice(cut + 1);
  const params: Record<string, string> = {};
  new URLSearchParams(raw).forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export async function handleAuthDeepLink(url: string): Promise<AuthDeepLinkResult> {
  const params = extractParams(url);

  if (params.error_description || params.error) {
    return { status: 'error', message: decodeURIComponent((params.error_description ?? params.error).replace(/\+/g, ' ')) };
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) return { status: 'error', message: error.message };
    return { status: 'session' };
  }

  // Defensive: if a project is ever switched to PKCE-style links, they carry
  // a `code` param instead of tokens directly.
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) return { status: 'error', message: error.message };
    return { status: 'session' };
  }

  return { status: 'ignored' };
}
