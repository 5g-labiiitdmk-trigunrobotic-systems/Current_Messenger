import React from 'react';
import { TextInput, View, Text, type TextInputProps } from 'react-native';
import { Glass } from './Glass';
import { useTheme } from '../theme/useTheme';
import { fontFamilies } from '../theme/tokens';

interface GlassFieldProps extends TextInputProps {
  label: string;
  rightIcon?: React.ReactNode;
}

export function GlassField({ label, rightIcon, style, ...rest }: GlassFieldProps) {
  const { tokens } = useTheme();
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
            style={[{ fontSize: 16, fontFamily: fontFamilies.medium, color: tokens.text, marginTop: 3, padding: 0 }, style]}
            {...rest}
          />
        </View>
        {rightIcon}
      </View>
    </Glass>
  );
}
