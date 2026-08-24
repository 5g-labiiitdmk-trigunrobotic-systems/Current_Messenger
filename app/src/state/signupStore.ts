import { create } from 'zustand';

/**
 * FILE PURPOSE: Transient state for the multi-step signup wizard. Never
 * persisted — a cold-start resume of email verification loses this,
 * which is why account.ts/usernameGen.ts exist as a fallback path.
 */
interface SignupState {
  username: string;
  email: string;
  password: string;
  set: (partial: Partial<Omit<SignupState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

export const useSignupStore = create<SignupState>((set) => ({
  username: '',
  email: '',
  password: '',
  set: (partial) => set(partial),
  reset: () => set({ username: '', email: '', password: '' }),
}));
