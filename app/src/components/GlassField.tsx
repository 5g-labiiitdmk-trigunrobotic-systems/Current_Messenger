import React, { useState } from 'react';
import { TextInput, View, Text, Pressable, type TextInputProps } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Glass } from './Glass';
import { useTheme } from '../theme/useTheme';
import { fontFamilies } from '../theme/tokens';

interface GlassFieldProps extends TextInputProps {
  label: string;
  rightIcon?: React.ReactNode;
}

export function GlassField({ label, rightIcon, style, secureTextEntry, ...rest }: GlassFieldProps) {
  const { tokens } = useTheme();
  // Applies to every password field in the app for free — any field passed
  // secureTextEntry gets a show/hide toggle automatically, no per-screen
  // wiring needed. Local to this field only: toggling one password input
  // doesn't reveal any other on screen (e.g. signup's password + confirm
  // password fields toggle independently).
  const [revealed, setRevealed] = useState(false);
  const isPassword = !!secureTextEntry;

  return (
    <Glass radius={18} variant="field" style={{ paddingHorizontal: 18, paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontFamily: fontFamilies.bold, color: tokens.text3, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
          {/* RN doesn't support styling placeholder text separately from a
              typed value in one TextInput — both share this `style`.
              medium (was semibold) keeps typed content perfectly legible
              while making the hint text read as a hint, not real content. */}
          <TextInput
            placeholderTextColor={tokens.text3}
            secureTextEntry={isPassword && !revealed}
            style={[{ fontSize: 16, fontFamily: fontFamilies.medium, color: tokens.text, marginTop: 3, padding: 0 }, style]}
            {...rest}
          />
        </View>
        {isPassword && (
          <Pressable onPress={() => setRevealed((v) => !v)} hitSlop={10} style={{ paddingLeft: 10, paddingVertical: 4 }}>
            <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={tokens.text3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              {revealed ? (
                <>
                  <Path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.9 18.9 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  <Path d="M1 1l22 22" />
                </>
              ) : (
                <>
                  <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                  <Circle cx={12} cy={12} r={3} />
                </>
              )}
            </Svg>
          </Pressable>
        )}
        {rightIcon}
      </View>
    </Glass>
  );
}
