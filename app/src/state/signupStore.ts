import { create } from 'zustand';

/** Transient state for the multi-step signup wizard. Never persisted. */
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
