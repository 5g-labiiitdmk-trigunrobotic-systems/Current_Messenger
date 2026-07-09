import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { View, Alert } from 'react-native';
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
import { AppLockGate } from '../src/components/AppLockGate';

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
        Alert.alert('Could not confirm email', result.message ?? 'The confirmation link may have expired — try resending it.');
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
    const unsub = useCallStore.subscribe((s, prev) => {
      if (s.incoming && !prev.incoming) router.push('/incoming-call');
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
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="group-chat/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="group-info/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="incoming-call" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="new-group" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="privacy" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="qr" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="lab/index" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="lab/[key]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="auth-redirect" options={{ animation: 'fade' }} />
            </Stack>
          </AppLockGate>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
