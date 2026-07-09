import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import type { AudioRecorder } from 'expo-audio';
import { createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';

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

// AudioRecorder instances can only be created via the useAudioRecorder()
// hook (the class is exported type-only from expo-audio, not as a value),
// so the recorder itself is owned by the component — see chat/[id].tsx —
// and passed in here. Everything else (permissions, file I/O) stays here.

export async function startVoiceRecording(recorder: AudioRecorder): Promise<boolean> {
  const perm = await requestRecordingPermissionsAsync();
  if (!perm.granted) return false;
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  await recorder.prepareToRecordAsync();
  recorder.record();
  return true;
}

export async function stopVoiceRecording(recorder: AudioRecorder): Promise<{ base64: string; mime: string; durationLabel: string } | null> {
  const seconds = Math.round(recorder.currentTime);
  await recorder.stop();
  const uri = recorder.uri;
  if (!uri) return null;
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const durationLabel = `0:${String(seconds).padStart(2, '0')}`;
  return { base64, mime: 'audio/m4a', durationLabel };
}

export async function playAudioBase64(base64: string, mime = 'audio/m4a') {
  const uri = `${FileSystem.cacheDirectory}voice-${Date.now()}.m4a`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  const player = createAudioPlayer(uri);
  player.play();
  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) player.remove();
  });
}
