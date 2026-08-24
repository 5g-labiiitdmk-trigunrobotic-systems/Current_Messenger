import React from 'react';
import { View, Text, Image, Pressable, Modal, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { fontFamilies } from '../theme/tokens';

interface PhotoSendPreviewProps {
  visible: boolean;
  base64: string | null;
  mime: string;
  onSend: () => void;
  onCancel: () => void;
}

/**
 * FILE PURPOSE / component doc: Confirmation step inserted between expo-image-picker's native crop
 * screen (allowsEditing: true — its own UI, confirmed not customizable;
 * see the separate crop-button-text investigation) and sendRich(). Not a
 * new interaction pattern for this app — mirrors MessageBubble.tsx's
 * existing full-screen image-viewer Modal exactly (black background,
 * translucent circular close button top-right at the same top:56/right:20
 * position, pill action button at the same bottom:46/left:20/right:20
 * position) so this reads as the same visual language as viewing an
 * already-sent photo, just with a Send action instead of no action.
 * Deliberately using the same fixed-margin numbers as that existing
 * pattern rather than adding safe-area-inset awareness of its own —
 * RN's Modal renders in a separate native window outside the normal view
 * tree, and this app's other Modals (here and the video player) already
 * use fixed margins rather than useSafeAreaInsets() for exactly that
 * reason, so matching them keeps this consistent with what's already
 * proven to work rather than introducing an untested variant.
 */
export function PhotoSendPreview({ visible, base64, mime, onSend, onCancel }: PhotoSendPreviewProps) {
  const { a1 } = useTheme();
  const { width, height } = useWindowDimensions();
  // Deliberately NOT an early `if (!base64) return null` — the caller
  // renders this component unconditionally and only toggles `visible`,
  // exactly like MessageBubble.tsx's expand modal does with its own
  // `expanded` boolean. Returning null here whenever base64 is momentarily
  // null (which happens on the very same render where the caller sets
  // visible to false, right after Send/Cancel) would unmount the Modal
  // instead of just hiding it, skipping the fade-out animation entirely —
  // this way the fade-out plays like every other modal in this app.
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {base64 && <Image source={{ uri: `data:${mime};base64,${base64}` }} style={{ width, height }} resizeMode="contain" />}
        <Pressable
          onPress={onCancel}
          style={{ position: 'absolute', top: 56, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontFamily: fontFamilies.bold }}>✕</Text>
        </Pressable>
        <Pressable
          onPress={onSend}
          style={{ position: 'absolute', left: 20, right: 20, bottom: 46, borderRadius: 16, paddingVertical: 14, alignItems: 'center', backgroundColor: a1 }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontFamily: fontFamilies.bold }}>Send</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
