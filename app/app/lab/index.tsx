import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { Glass } from '../../src/components/Glass';
import { IconCircle } from '../../src/components/Buttons';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { LAB_FEATURES } from '../../src/data/labFeatures';

export default function LabScreen() {
  const { tokens, a1 } = useTheme();
  return (
    <ScreenScaffold>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconCircle onPress={() => router.back()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </IconCircle>
        <Text style={{ fontSize: 24, fontFamily: fontFamilies.black, color: tokens.text }}>Lab</Text>
      </View>
      <Text style={{ marginTop: 8, marginHorizontal: 4, fontSize: 13, fontFamily: fontFamilies.medium, color: tokens.text2, lineHeight: 19 }}>
        Experimental features, coming soon. These are wired into navigation but not functionally complete yet.
      </Text>

      <Glass radius={22} style={{ marginTop: 18, overflow: 'hidden' }}>
        {LAB_FEATURES.map((f, i) => (
          <Pressable key={f.key} onPress={() => router.push(`/lab/${f.key}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderBottomWidth: i === LAB_FEATURES.length - 1 ? 0 : 1, borderBottomColor: tokens.glassBorder }}>
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: tokens.glassBg2, borderWidth: 1, borderColor: tokens.glassBorder, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Path d={f.icon} />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: fontFamilies.bold, color: tokens.text }}>{f.label}</Text>
              <Text style={{ fontSize: 12, color: tokens.text2, fontFamily: fontFamilies.medium, marginTop: 1 }}>{f.sub}</Text>
            </View>
            <View style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8, backgroundColor: 'rgba(124,92,255,0.16)' }}>
              <Text style={{ fontSize: 10, fontFamily: fontFamilies.heavy, color: a1 }}>SOON</Text>
            </View>
          </Pressable>
        ))}
      </Glass>
    </ScreenScaffold>
  );
}
