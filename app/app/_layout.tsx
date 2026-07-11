import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black } from '@expo-google-fonts/inter';
import { useAuthStore } from '../src/state/authStore';
import { handleAuthDeepLink } from '../src/lib/authDeepLink';
import { useThemeStore } from '../src/state/themeStore';
import { useChatStore } from '../src/state/chatStore';
import { usePresenceStore } from '../src/state/presenceStore';
import { useContactStore } from '../src/state/contactStore';
import { useGroupStore } from '../src/state/groupStore';
import { useCallStore } from '../src/state/callStore';
import { useChatSessionStore } from '../src/state/chatSessionStore';
import { AppLockGate } from '../src/components/AppLockGate';
import { AppAlertHost } from '../src/components/AppAlertHost';
import { appAlert } from '../src/state/alertStore';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });
  const initialize = useAuthStore((s) => s.initialize);
  const hydrated = useThemeStore((s) => s.hydrated);
  const mode = useThemeStore((s) => s.mode);
  const incomingUrl = Linking.useURL();

  // Handles the Supabase "Confirm signup" email link, which opens this app
  // via current://auth-redirect#access_token=...&refresh_token=... — see
  // src/lib/authDeepLink.ts. Global (not tied to a specific route) so it
  // works regardless of which screen Expo Router lands the deep link on.
  useEffect(() => {
    if (!incomingUrl) return;
    handleAuthDeepLink(incomingUrl).then((result) => {
      if (result.status === 'session') {
        router.replace('/(auth)/finish-setup');
      } else if (result.status === 'error') {
        appAlert('Could not confirm email', result.message ?? 'The confirmation link may have expired — try resending it.');
      }
    });
  }, [incomingUrl]);

  useEffect(() => {
    initialize();
    useChatStore.getState().wire();
    usePresenceStore.getState().wire();
    useContactStore.getState().wire();
    useGroupStore.getState().wire();
    useCallStore.getState().wire();
    useChatSessionStore.getState().wire();

    // zustand's subscribe() only fires on future transitions, not on state
    // that already changed before this effect (re-)ran — e.g. this layout
    // remounting while a call is already ringing/connecting. Catch up once
    // on whatever the call state already is at mount time so a call in
    // progress is never silently un-navigated-to.
    const existingCall = useCallStore.getState();
    if (existingCall.incoming) {
      router.push('/incoming-call');
    } else if (existingCall.peerId && (existingCall.phase === 'ringing-out' || existingCall.phase === 'connecting' || existingCall.phase === 'active')) {
      router.push(`/call/${existingCall.peerId}`);
    }

    const unsub = useCallStore.subscribe((s, prev) => {
      if (s.incoming && !prev.incoming) router.push('/incoming-call');
      // Outgoing call just placed — get the caller into the in-call screen.
      if (s.phase === 'ringing-out' && prev.phase === 'idle' && s.peerId) router.push(`/call/${s.peerId}`);
      // Incoming call just accepted — replace (not push) so the call screen's
      // own back button doesn't return to the now-gone incoming-call screen.
      if (s.phase === 'connecting' && prev.phase === 'ringing-in' && s.peerId) router.replace(`/call/${s.peerId}`);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#141416' }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#141416' }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#141416' }}>
          <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
          <AppLockGate>
            <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              {/* Entered via router.replace() from index.tsx (returning
                  session) and finish-setup.tsx (fresh signup) — every path
                  into the main app tears down the previous screen while
                  animating this one in, which is the exact "replace +
                  fade_from_bottom" combination react-native-screens has
                  known Android issues with (a stale native fragment
                  snapshot of the screen being replaced can linger behind
                  the incoming one). No animation needed for a one-time
                  "you're in" transition anyway — overriding the inherited
                  global default rather than changing it everywhere, since
                  this is the specific transition the reported ghost
                  rectangle lines up with. */}
              <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
              <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="group-chat/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="group-info/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="incoming-call" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="call/[id]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
              <Stack.Screen name="new-group" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="privacy" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="help" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="qr" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="lab/index" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="lab/[key]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="auth-redirect" options={{ animation: 'fade' }} />
            </Stack>
          </AppLockGate>
          <AppAlertHost />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
