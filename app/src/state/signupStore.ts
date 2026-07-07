import { create } from 'zustand';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

/** Transient state for the multi-step signup wizard. Never persisted. */
interface SignupState {
  username: string;
  email: string;
  password: string;
  phone: string; // E.164
  phoneConfirmation: FirebaseAuthTypes.ConfirmationResult | null;
  set: (partial: Partial<Omit<SignupState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

export const useSignupStore = create<SignupState>((set) => ({
  username: '',
  email: '',
  password: '',
  phone: '',
  phoneConfirmation: null,
  set: (partial) => set(partial),
  reset: () => set({ username: '', email: '', password: '', phone: '', phoneConfirmation: null }),
}));
