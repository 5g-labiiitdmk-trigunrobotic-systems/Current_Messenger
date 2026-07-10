import { create } from 'zustand';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

/** Transient state for the multi-step signup wizard. Never persisted. */
interface SignupState {
  username: string;
  email: string;
  password: string;
  phone: string;
  phoneConfirmation: FirebaseAuthTypes.ConfirmationResult | null;
  /** Carried forward from verify-phone.tsx to totp-setup.tsx, where
   * finalizeAccount() is now actually called — account creation is
   * deferred until TOTP enrollment completes. */
  firebaseUid: string | null;
  set: (partial: Partial<Omit<SignupState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

export const useSignupStore = create<SignupState>((set) => ({
  username: '',
  email: '',
  password: '',
  phone: '',
  phoneConfirmation: null,
  firebaseUid: null,
  set: (partial) => set(partial),
  reset: () => set({ username: '', email: '', password: '', phone: '', phoneConfirmation: null, firebaseUid: null }),
}));
