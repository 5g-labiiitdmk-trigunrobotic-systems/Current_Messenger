// FILE PURPOSE: Expo Router layout for the "(auth)" route group — the
// stack of screens shown before a user is signed in (onboarding, signup,
// email verification, finish-setup, login, password reset). Registers
// each screen explicitly so their navigation/animation options can be
// controlled here in one place.
import { Stack } from 'expo-router';

// AuthLayout(): renders the (auth) group's own Stack navigator, with no
// header chrome (each screen draws its own) and a right-to-left slide
// transition by default — onboarding gets a fade instead since it's the
// very first screen a new user sees, not a "navigated to" push.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="signup" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="finish-setup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
