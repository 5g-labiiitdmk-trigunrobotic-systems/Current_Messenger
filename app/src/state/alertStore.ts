import { create } from 'zustand';

// FILE PURPOSE: A zustand-backed, themed replacement for React Native's
// native Alert.alert — see appAlert() below, the function every call site
// in the app actually uses.
export interface AppAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
}

interface AlertStore {
  alert: AlertState | null;
  dismiss: () => void;
}

export const useAlertStore = create<AlertStore>((set) => ({
  alert: null,
  dismiss: () => set({ alert: null }),
}));

/**
 * Drop-in replacement for React Native's Alert.alert — same
 * (title, message, buttons) signature — that renders a themed modal
 * matching the app's design system instead of the native OS dialog.
 * Every Alert.alert call site in the app should use this instead.
 */
export function appAlert(title: string, message?: string, buttons?: AppAlertButton[]) {
  useAlertStore.setState({
    alert: { title, message, buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }] },
  });
}
