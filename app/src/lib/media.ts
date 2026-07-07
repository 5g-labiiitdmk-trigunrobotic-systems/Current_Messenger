import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';

export async function pickImageBase64(): Promise<{ base64: string; mime: string } | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    base64: true,
    quality: 0.5,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets[0]?.base64) return null;
  const asset = result.assets[0];
  return { base64: asset.base64!, mime: asset.mimeType ?? 'image/jpeg' };
}

export async function getCurrentLocationOnce(): Promise<{ lat: number; lng: number } | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

let activeRecording: Audio.Recording | null = null;

export async function startVoiceRecording(): Promise<boolean> {
  const perm = await Audio.requestPermissionsAsync();
  if (!perm.granted) return false;
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  activeRecording = recording;
  return true;
}

export async function stopVoiceRecording(): Promise<{ base64: string; mime: string; durationLabel: string } | null> {
  if (!activeRecording) return null;
  await activeRecording.stopAndUnloadAsync();
  const uri = activeRecording.getURI();
  const status = await activeRecording.getStatusAsync();
  activeRecording = null;
  if (!uri) return null;
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const seconds = Math.round((status.durationMillis ?? 0) / 1000);
  const durationLabel = `0:${String(seconds).padStart(2, '0')}`;
  return { base64, mime: 'audio/m4a', durationLabel };
}

export async function playAudioBase64(base64: string, mime = 'audio/m4a') {
  const uri = `${FileSystem.cacheDirectory}voice-${Date.now()}.m4a`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  const { sound } = await Audio.Sound.createAsync({ uri });
  await sound.playAsync();
  sound.setOnPlaybackStatusUpdate((s) => {
    if ('didJustFinish' in s && s.didJustFinish) sound.unloadAsync();
  });
}
