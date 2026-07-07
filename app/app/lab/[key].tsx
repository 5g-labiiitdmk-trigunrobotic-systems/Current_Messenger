import React from 'react';
import { View, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { Glass } from '../../src/components/Glass';
import { IconCircle } from '../../src/components/Buttons';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { LAB_FEATURES } from '../../src/data/labFeatures';

export default function LabFeatureScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { tokens, a1 } = useTheme();
  const feature = LAB_FEATURES.find((f) => f.key === key);

  return (
    <ScreenScaffold scroll={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconCircle onPress={() => router.back()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </IconCircle>
        <Text style={{ fontSize: 20, fontFamily: fontFamilies.black, color: tokens.text }}>{feature?.label ?? 'Feature'}</Text>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
        <Glass radius={30} style={{ padding: 30, alignItems: 'center', gap: 16 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(124,92,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <Path d={feature?.icon ?? 'M12 8v4l3 3'} />
            </Svg>
          </View>
          <Text style={{ fontSize: 18, fontFamily: fontFamilies.heavy, color: tokens.text, textAlign: 'center' }}>{feature?.label ?? 'Coming soon'}</Text>
          <Text style={{ fontSize: 13.5, fontFamily: fontFamilies.medium, color: tokens.text2, textAlign: 'center', lineHeight: 20 }}>{feature?.detail}</Text>
        </Glass>
      </View>
    </ScreenScaffold>
  );
}
