/**
 * Where a tapped notification should take the user. Pure, so it can be tested.
 * `data` comes from the push payload built by the relay (server/src/pushPing.ts).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function routeForNotification(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if (data.kind === 'message' || data.kind === 'session_request') {
    const id = data.kind === 'message' ? data.senderId : data.requesterId;
    // Only a real user id may become part of a route.
    if (typeof id === 'string' && UUID_RE.test(id)) return `/chat/${id}`;
    return null;
  }
  if (data.kind === 'contact_request') return '/(tabs)/contacts';
  return null;
}
