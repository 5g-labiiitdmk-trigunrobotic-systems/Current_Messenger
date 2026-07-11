import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { AudioRecorder } from 'expo-audio';
import { createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';

export async function pickImageBase64(): Promise<{ base64: string; mime: string } | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    base64: true,
    quality: 0.5,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets[0]?.base64) return null;
  const asset = result.assets[0];
  return { base64: asset.base64!, mime: asset.mimeType ?? 'image/jpeg' };
}

/**
 * Profile-photo picker: camera or gallery, square-cropped, then
 * downsized + recompressed client-side before it ever leaves the device —
 * a raw camera photo can be 4000px/several MB, wildly oversized for a
 * ~100-150px avatar. 512x512 is generous headroom for high-density
 * displays while keeping the upload small.
 */
export async function pickAvatarImage(source: 'camera' | 'library'): Promise<{ base64: string; mime: string } | null> {
  const perm =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  const result = await launch({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });
  if (result.canceled || !result.assets[0]) return null;

  const context = ImageManipulator.manipulate(result.assets[0].uri);
  context.resize({ width: 512, height: 512 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) return null;
  return { base64: saved.base64, mime: 'image/jpeg' };
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
