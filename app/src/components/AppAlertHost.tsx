import React from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { useAlertStore } from '../state/alertStore';
import { useTheme } from '../theme/useTheme';
import { fontFamilies } from '../theme/tokens';
import { Glass } from './Glass';

/** Mounted once at the app root — renders whatever appAlert() last set. */
export function AppAlertHost() {
  const alert = useAlertStore((s) => s.alert);
  const dismiss = useAlertStore((s) => s.dismiss);
  const { tokens, a1 } = useTheme();

  if (!alert) return null;

  const onPressButton = (btn: (typeof alert.buttons)[number]) => {
    dismiss();
    btn.onPress?.();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 30 }}
        onPress={dismiss}
      >
        <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 340 }}>
          <Glass radius={22} style={{ padding: 22 }}>
            <Text style={{ fontSize: 17, fontFamily: fontFamilies.heavy, color: tokens.text, textAlign: 'center' }}>{alert.title}</Text>
            {alert.message ? (
              <Text style={{ fontSize: 13.5, fontFamily: fontFamilies.medium, color: tokens.text2, textAlign: 'center', marginTop: 8, lineHeight: 19 }}>
                {alert.message}
              </Text>
            ) : null}
            <ScrollView style={{ maxHeight: 400, marginTop: 20 }} contentContainerStyle={{ gap: 10 }}>
              {alert.buttons.map((btn, i) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                return (
                  <Pressable key={i} onPress={() => onPressButton(btn)}>
                    <View
                      style={{
                        height: 46,
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isCancel ? tokens.field : isDestructive ? 'rgba(255,90,110,0.14)' : a1,
                        borderWidth: isCancel || isDestructive ? 1 : 0,
                        borderColor: isDestructive ? 'rgba(255,90,110,0.35)' : tokens.glassBorder,
                      }}
                    >
                      <Text style={{ fontFamily: fontFamilies.bold, fontSize: 14.5, color: isDestructive ? '#ff5a6e' : isCancel ? tokens.text : '#fff' }}>
                        {btn.text}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Glass>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
