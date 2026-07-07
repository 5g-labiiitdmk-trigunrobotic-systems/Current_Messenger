import type { UserRow } from '../types/database';

/**
 * Every screen that shows presence in this app only shows it for approved
 * contacts (chat list, contacts list, chat header) — so 'everyone' and
 * 'contacts' are equivalent in practice here; the one real distinction is
 * 'nobody', which hides the online dot / last-seen even from contacts.
 */
export function isPresenceVisible(user: Pick<UserRow, 'status_visibility'> | undefined): boolean {
  if (!user) return true;
  return user.status_visibility !== 'nobody';
}
