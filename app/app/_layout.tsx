// FILE PURPOSE: The app's root Expo Router layout — mounted once for the
// entire app lifetime. Loads fonts, wires up every global zustand store
// (chat, presence, contacts, groups, calls, notifications), handles
// incoming Supabase auth deep links globally, and declares the top-level
// Stack navigator (every route in the app is registered here with its
// own transition/presentation options) plus the always-mounted overlay
// UI (active-call banners, the alert host).
//
// The two side-effect-only imports below (react-native-get-random-values,
// react-native-url-polyfill/auto) must run before anything else in the
// app does — they polyfill crypto.getRandomValues and the URL API that
// several dependencies (tweetnacl, supabase-js) assume exist natively.
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
import { handleAuthDeepLink, PASSWORD_RESET_REDIRECT_URL } from '../src/lib/authDeepLink';
import { useThemeStore } from '../src/state/themeStore';
import { useChatStore } from '../src/state/chatStore';
import { usePresenceStore } from '../src/state/presenceStore';
import { useContactStore } from '../src/state/contactStore';
import { useGroupStore } from '../src/state/groupStore';
import { useCallStore } from '../src/state/callStore';
import { useGroupCallStore } from '../src/state/groupCallStore';
import { useChatSessionStore } from '../src/state/chatSessionStore';
import { AppLockGate } from '../src/components/AppLockGate';
import { AppAlertHost } from '../src/components/AppAlertHost';
import { ActiveCallBanner } from '../src/components/ActiveCallBanner';
import { GroupActiveCallBanner } from '../src/components/GroupActiveCallBanner';
import { appAlert } from '../src/state/alertStore';
import { initNotificationRouting } from '../src/lib/push';
import { setupCallNotificationChannel, registerCallBackgroundTask, subscribeToCallNotificationEvents } from '../src/lib/callNotifications';

// Keep the native splash screen up until fonts have actually loaded
// (hidden explicitly below, once fontsLoaded flips true) — otherwise
// there'd be a flash of unstyled text before the custom font swaps in.
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

  // Handles both Supabase auth email links, which open this app via a
  // fixed current:// deep link with session tokens appended after a `#`
  // — see src/lib/authDeepLink.ts. Global (not tied to a specific route)
  // so it works regardless of which screen Expo Router lands the deep
  // link on. The two flows share the same token-parsing/session-setting
  // logic but need different post-session destinations, so the raw URL
  // (checked before it's stripped down to just its params) is what tells
  // "Confirm signup" and "Reset password" apart.
  useEffect(() => {
    if (!incomingUrl) return;
    const isPasswordReset = incomingUrl.startsWith(PASSWORD_RESET_REDIRECT_URL);
    handleAuthDeepLink(incomingUrl).then((result) => {
      if (result.status === 'session') {
        router.replace(isPasswordReset ? '/(auth)/reset-password' : '/(auth)/finish-setup');
      } else if (result.status === 'error') {
        appAlert(
          isPasswordReset ? 'Could not verify reset link' : 'Could not confirm email',
          result.message ?? (isPasswordReset ? 'The reset link may have expired — request a new one.' : 'The confirmation link may have expired — try resending it.')
        );
      }
    });
  }, [incomingUrl]);

  // Mount-once effect: initializes auth, wires every global store's own
  // realtime/background subscriptions, and sets up call-related
  // navigation — both catching up on any call already in progress at
  // mount time, and subscribing to future call-state transitions so an
  // incoming/outgoing call always pushes the right screen regardless of
  // where in the app the user currently is.
  useEffect(() => {
    initialize();
    useChatStore.getState().wire();
    usePresenceStore.getState().wire();
    useContactStore.getState().wire();
    useGroupStore.getState().wire();
    useCallStore.getState().wire();
    useGroupCallStore.getState().wire();
    useChatSessionStore.getState().wire();
    initNotificationRouting();
    setupCallNotificationChannel().catch(() => {});
    registerCallBackgroundTask();
    subscribeToCallNotificationEvents();

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

    // Group-call counterpart to the catch-up + subscribe block above —
    // same reasoning, same shape, just routing to the group screens
    // (incoming-group-call / call/group/[groupId]) instead. Kept as its
    // own separate block rather than merged into the 1:1 one above, so
    // that block's logic is untouched.
    const existingGroupCall = useGroupCallStore.getState();
    if (existingGroupCall.incoming) {
      router.push('/incoming-group-call');
    } else if (existingGroupCall.groupId && (existingGroupCall.phase === 'ringing-out' || existingGroupCall.phase === 'connecting' || existingGroupCall.phase === 'active')) {
      router.push(`/call/group/${existingGroupCall.groupId}`);
    }

    const unsubGroup = useGroupCallStore.subscribe((s, prev) => {
      if (s.incoming && !prev.incoming) router.push('/incoming-group-call');
      if (s.phase === 'ringing-out' && prev.phase === 'idle' && s.groupId) router.push(`/call/group/${s.groupId}`);
      if (s.phase === 'connecting' && prev.phase === 'ringing-in' && s.groupId) router.replace(`/call/group/${s.groupId}`);
    });

    return () => {
      unsub();
      unsubGroup();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  // Renders a blank matching-color View instead of null while fonts are
  // still loading, so there's no flash of the OS's default background
  // color before the splash screen hides.
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
              <Stack.Screen name="incoming-group-call" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="call/group/[groupId]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
              <Stack.Screen name="new-group" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="privacy" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="help" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="legal" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="qr" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="lab/index" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="lab/[key]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="auth-redirect" options={{ animation: 'fade' }} />
            </Stack>
          </AppLockGate>
          <ActiveCallBanner />
          <GroupActiveCallBanner />
          <AppAlertHost />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
