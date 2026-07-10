import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="signup" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="add-phone" />
      <Stack.Screen name="verify-phone" />
      <Stack.Screen name="totp-setup" />
      <Stack.Screen name="totp-verify" />
      <Stack.Screen name="finish-setup" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
