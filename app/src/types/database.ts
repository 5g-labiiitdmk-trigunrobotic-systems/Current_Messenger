// Hand-written types mirroring supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript` once the project is linked, if preferred.

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  email: string;
  email_verified: boolean;
  phone: string | null;
  phone_verified: boolean;
  firebase_uid: string | null;
  avatar_hue: number;
  bio: string;
  status_visibility: 'everyone' | 'contacts' | 'nobody';
  last_seen_at: string | null;
  push_token: string | null;
  created_at: string;
}

export interface ContactRequestRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
  responded_at: string | null;
}

export interface BlockedUserRow {
  id: string;
  blocker_id: string;
  blocked_id: string;
  is_report: boolean;
  reason: string | null;
  created_at: string;
}

export interface DeviceKeyRow {
  id: string;
  user_id: string;
  public_key: string;
  device_label: string;
  is_active: boolean;
  created_at: string;
}

