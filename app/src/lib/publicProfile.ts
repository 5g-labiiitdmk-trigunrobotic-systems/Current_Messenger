import type { UserRow } from '../types/database';

// FILE PURPOSE: the database functions search_users / get_profiles (migration
// 0013) return only public profile fields. The rest of the app works with the
// full UserRow shape, so this fills the private fields with empty values —
// they are never read for people other than yourself and your contacts.
export interface PublicProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_hue: number;
  avatar_url: string | null;
  bio: string;
  status_visibility: 'everyone' | 'contacts' | 'nobody';
  created_at: string;
}

export function toUserRow(p: PublicProfile): UserRow {
  return {
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    email: '',
    email_verified: false,
    phone: null,
    phone_verified: false,
    firebase_uid: null,
    avatar_hue: p.avatar_hue,
    avatar_url: p.avatar_url,
    bio: p.bio,
    status_visibility: p.status_visibility,
    last_seen_at: null,
    push_token: null,
    created_at: p.created_at,
  };
}
