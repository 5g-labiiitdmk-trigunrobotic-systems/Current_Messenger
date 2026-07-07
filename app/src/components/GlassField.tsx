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
          <TextInput
            placeholderTextColor={tokens.text3}
            style={[{ fontSize: 16, fontFamily: fontFamilies.semibold, color: tokens.text, marginTop: 3, padding: 0 }, style]}
            {...rest}
          />
        </View>
        {rightIcon}
      </View>
    </Glass>
  );
}
