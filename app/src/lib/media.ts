import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import type { AudioRecorder } from 'expo-audio';
import { createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';

/**
 * source: 'library' (default, unchanged for every existing call site —
 * none of them pass this) opens the photo gallery; 'camera' launches a
 * live capture instead, added for the in-app "Camera" attach option (see
 * chat/[id].tsx and group-chat/[id].tsx). Both now pass allowsEditing:
 * true — expo-image-picker's own built-in crop step (already used
 * elsewhere in this file by pickAvatarImage, not a new dependency),
 * shown after the photo is selected/captured and before this function
 * returns, satisfying "crop before it enters the pipeline" for both
 * sources at once. Known platform limitation of this built-in editor
 * (confirmed from expo-image-picker's own type definitions, not
 * assumed): the crop rectangle is locked to a square on iOS — `aspect`
 * (free-form/non-square cropping) is Android-only. Left unset here
 * deliberately (Android gets a free-form crop; iOS gets expo-image-
 * picker's square-only editor) rather than forcing every photo to
 * square everywhere, since this app's current phase is Android-first.
 */
export async function pickImageBase64(source: 'camera' | 'library' = 'library'): Promise<{ base64: string; mime: string } | null> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  const result = await launch({
    mediaTypes: ['images'],
    base64: true,
    quality: 0.5,
    allowsEditing: true,
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

// The relay has zero persistence and just forwards messages as-is — a
// video's base64 encoding (~4/3 the raw byte size) travels in a single
// WebSocket frame, and in a group chat gets fanned out pairwise, once
// per member (see sendRich in chatStore.ts). A 15MB cap keeps a single
// group send's total relay traffic bounded (15MB * ~4/3 * N members,
// not unbounded), while still covering a genuinely short compressed
// clip from a phone camera. Duration is capped first and separately
// (60s) since that's the more meaningful abuse limit from a user's
// perspective — "not a huge file" vs "not a mistakenly-shared movie".
export const MAX_VIDEO_DURATION_SECONDS = 60;
export const MAX_VIDEO_FILE_BYTES = 15 * 1024 * 1024;
// Matches pickAvatarImage's downsizing reasoning below — a video frame
// grabbed at the source video's native resolution (e.g. 1080p+) would
// make the thumbnail itself bigger than most photo messages this app
// sends, for something that only ever renders at bubble-preview size.
const THUMBNAIL_MAX_WIDTH = 320;

export type PickVideoResult =
  | { ok: true; base64: string; mime: string; durationLabel: string; thumbnailBase64: string | null }
  | { ok: false; reason: 'canceled' | 'permission_denied' | 'too_long' | 'too_large' | 'failed' };

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Duration/size checks, base64 read, and thumbnail generation — identical
 * regardless of whether the asset came from the gallery or a live camera
 * recording, so both pickVideoBase64 sources (below) share this one
 * implementation rather than duplicating it. Extracted from what used to
 * be pickVideoBase64's own inline tail; behavior is unchanged from
 * before for the library path.
 */
async function processVideoAsset(asset: ImagePicker.ImagePickerAsset): Promise<PickVideoResult> {
  const durationSeconds = asset.duration ? Math.round(asset.duration / 1000) : 0;
  if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) return { ok: false, reason: 'too_long' };

  // Fast-path rejection when the picker reports a size, before ever
  // reading the file into memory — not all platforms populate
  // fileSize, so this is a best-effort early check, not the only one.
  if (asset.fileSize && asset.fileSize > MAX_VIDEO_FILE_BYTES) return { ok: false, reason: 'too_large' };

  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  const approxBytes = (base64.length * 3) / 4;
  if (approxBytes > MAX_VIDEO_FILE_BYTES) return { ok: false, reason: 'too_large' };

  let thumbnailBase64: string | null = null;
  try {
    const { uri: rawThumbUri } = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 0 });
    const context = ImageManipulator.manipulate(rawThumbUri);
    context.resize({ width: THUMBNAIL_MAX_WIDTH });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
    thumbnailBase64 = saved.base64 ?? null;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[media] video thumbnail generation failed, sending without one:', e?.message ?? e);
    thumbnailBase64 = null;
  }

  return { ok: true, base64, mime: asset.mimeType ?? 'video/mp4', durationLabel: formatDuration(durationSeconds), thumbnailBase64 };
}

/**
 * Video picker, mirroring pickImageBase64's shape/error handling and its
 * new source parameter (same default, same reasoning — every existing
 * call site passes nothing and keeps picking from the gallery
 * unchanged). videoMaxDuration is a recording-time cap that only applies
 * to the camera path (irrelevant to picking an existing gallery video,
 * where the file's length is already fixed) — processVideoAsset's own
 * post-hoc duration check remains the authoritative enforcement either
 * way, so this is a nicer-to-hit UX limit for camera, not a new source
 * of truth.
 *
 * Unlike images, expo-image-picker never returns base64 for video assets
 * (only a file uri) — read separately via FileSystem, same technique
 * already proven in stopVoiceRecording below. Thumbnail generation is a
 * new native dependency (expo-video-thumbnails, official Expo SDK,
 * version-aligned with the rest of this project's ^57.0.x packages) —
 * wrapped in its own try/catch so a thumbnail failure degrades to "send
 * the video without a preview frame" rather than failing the whole send;
 * its on-device native behavior is unverified in this sandbox (no real
 * device here), same disclosed limitation as every other native-module
 * change this project has made.
 */
export async function pickVideoBase64(source: 'camera' | 'library' = 'library'): Promise<PickVideoResult> {
  try {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'permission_denied' };

    const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await launch({ mediaTypes: ['videos'], quality: 0.6, videoMaxDuration: MAX_VIDEO_DURATION_SECONDS });
    if (result.canceled || !result.assets[0]) return { ok: false, reason: 'canceled' };

    return await processVideoAsset(result.assets[0]);
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[media] pickVideoBase64 failed:', e?.message ?? e);
    return { ok: false, reason: 'failed' };
  }
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

export type StartRecordingResult = 'started' | 'permission_denied' | 'start_failed';

/**
 * Neither this nor stopVoiceRecording below had any error handling at
 * all — requestRecordingPermissionsAsync/setAudioModeAsync/
 * prepareToRecordAsync/record() could each throw (audio session state is
 * notoriously flaky on both iOS AVAudioSession and Android AudioRecord —
 * e.g. right after a call just ended, or a second tap racing a previous
 * session's cleanup that hasn't finished), and the caller (chat/[id].tsx's
 * onMic) awaited this with no try/catch either. The result was exactly
 * "sometimes works, sometimes silently does nothing": a thrown rejection
 * here became an unhandled promise rejection at the call site, so
 * setRecording(true) never ran and the existing "permission needed" alert
 * never fired either — nothing distinguished a real failure from a
 * successful start until the user tapped again and got confused about
 * which state the button was actually in. Returns which of three things
 * happened instead of a plain boolean, so the caller can show an accurate
 * message instead of only ever being able to say "permission needed"
 * (which was already wrong for a genuine native start failure, not a
 * permission denial).
 */
export async function startVoiceRecording(recorder: AudioRecorder): Promise<StartRecordingResult> {
  try {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return 'permission_denied';
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return 'started';
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[media] startVoiceRecording failed:', e?.message ?? e);
    return 'start_failed';
  }
}

export async function stopVoiceRecording(recorder: AudioRecorder): Promise<{ base64: string; mime: string; durationLabel: string } | null> {
  try {
    const seconds = Math.round(recorder.currentTime);
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) return null;
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const durationLabel = `0:${String(seconds).padStart(2, '0')}`;
    return { base64, mime: 'audio/m4a', durationLabel };
  } catch (e: any) {
    // Same unguarded-throw risk as startVoiceRecording — a failure here
    // used to mean the user recorded something, tapped stop, and it just
    // never sent, with nothing telling them why.
    // eslint-disable-next-line no-console
    console.error('[media] stopVoiceRecording failed:', e?.message ?? e);
    return null;
  }
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
