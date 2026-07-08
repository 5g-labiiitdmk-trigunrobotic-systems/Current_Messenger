import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { ScreenScaffold } from '../src/components/ScreenScaffold';
import { useTheme } from '../src/theme/useTheme';
import { fontFamilies } from '../src/theme/tokens';

/**
 * Purely a landing pad for the Supabase confirmation-email link
 * (current://auth-redirect#access_token=...). The actual token handling
 * lives in app/_layout.tsx (global, via Linking.useURL()) so it works
 * regardless of exact route-matching behavior around the URL fragment —
 * this screen just avoids a flash of "unmatched route" while that resolves.
 */
export default function AuthRedirectScreen() {
  const { tokens } = useTheme();
  return (
    <ScreenScaffold scroll={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <ActivityIndicator color={tokens.text} />
        <Text style={{ fontFamily: fontFamilies.medium, color: tokens.text2, fontSize: 13 }}>Confirming your email…</Text>
      </View>
    </ScreenScaffold>
  );
}
