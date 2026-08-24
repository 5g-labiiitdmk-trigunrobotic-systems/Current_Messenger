import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import type { AudioRecorder } from 'expo-audio';
import { createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { VideoTrimNative, showVideoTrimEditorNative, compressVideoNative, type VideoTrimSpec } from './videoTrim';

// FILE PURPOSE: Every media capture/pick/process helper used by the
// composer — photos (with crop), avatar photos, videos (with trim +
// compress), device location, and voice-message recording/playback.
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

// Duration cap raised from 60s to 5 minutes now that oversized videos are
// compressed rather than flatly rejected (see compressIfNeeded below) —
// the hard duration cap is no longer the only thing standing between "a
// short clip" and "a mistakenly-shared movie", so it can be meaningfully
// more generous. It's still a genuine ceiling, not just a formality:
// compression reduces bitrate/resolution, not length, so a 20-minute
// video is still a bad fit for a pairwise-encrypted, relay-forwarded
// chat message regardless of how aggressively it's compressed. Also
// enforced natively inside the trim editor itself (EditorConfig.maxDuration
// below) — the user physically cannot select a range longer than this in
// the trim UI — with this constant used again afterward as a defense-in-
// depth check on the actual trimmed result, same as everywhere else in
// this file that doesn't trust a single check.
export const MAX_VIDEO_DURATION_SECONDS = 300;
// The relay has zero persistence and just forwards messages as-is — a
// video's base64 encoding (~4/3 the raw byte size) travels in a single
// WebSocket frame, and in a group chat gets fanned out pairwise, once per
// member (see sendRich in chatStore.ts). Raised from 15MB to 20MB along
// with the 5x duration increase above — NOT a proportional 5x increase,
// deliberately: the group fan-out multiplication this cap exists to bound
// (bytes * ~4/3 * N members) gets worse, not better, as N grows, so this
// stays a modest bump rather than tracking the duration increase
// linearly. At 20MB over a full 300s clip, that's roughly ~533kbps
// average — genuinely low-bitrate "chat video" quality, not "cap that's
// never actually the limiting factor once compression is available."
// This is now the ceiling AFTER compression is attempted, not a same-day
// rejection threshold — see compressIfNeeded.
export const MAX_VIDEO_FILE_BYTES = 20 * 1024 * 1024;
// Matches pickAvatarImage's downsizing reasoning below — a video frame
// grabbed at the source video's native resolution (e.g. 1080p+) would
// make the thumbnail itself bigger than most photo messages this app
// sends, for something that only ever renders at bubble-preview size.
const THUMBNAIL_MAX_WIDTH = 320;

export type PickVideoResult =
  | { ok: true; base64: string; mime: string; durationLabel: string; thumbnailBase64: string | null }
  | { ok: false; reason: 'canceled' | 'permission_denied' | 'too_long' | 'too_large' | 'failed' };

// Formats seconds as "m:ss" for video-message duration labels.
function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Estimates raw byte size from a base64 string's length (base64 inflates
// by ~4/3), used as a quick over-the-wire size check.
function approxBase64Bytes(base64Length: number): number {
  return (base64Length * 3) / 4;
}

/**
 * react-native-video-trim's Android native module returns output paths as
 * bare absolute filesystem paths (Kotlin File.absolutePath, e.g.
 * "/data/user/0/.../files/VIDEO_TRIM_x.mp4"), not file:// URIs — confirmed
 * directly from its Android source: StorageUtil.kt's getOutputPath/
 * getCacheOutputPath both return File(...).absolutePath, no scheme, and
 * every showEditor()/compress() result is built the same way. But
 * expo-file-system's legacy API expects a file:// URI: its own Android
 * module (FileSystemLegacyModule.kt) only rewrites strings that already
 * start with "file:" (slashifyFilePath) — a schemeless path falls through
 * untouched, Uri.parse() then gives it scheme == null, and getInfoAsync
 * takes a branch that never reports the file as existing. That was the
 * direct cause of "Could not share this video / Something went wrong
 * reading that video" on real-device testing: the trimmed/compressed file
 * genuinely exists on disk, but every downstream expo-file-system call
 * was being handed a path format it can't resolve. Idempotent — a string
 * that already has a scheme (iOS, or if the library ever changes) is
 * returned unchanged.
 */
function toFileUri(path: string): string {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path) ? path : `file://${path}`;
}

/**
 * Wraps react-native-video-trim's event-driven showEditor() (it has no
 * Promise-returning form — trimming completion, cancellation, and errors
 * all arrive as separate native events) into the Promise-based shape the
 * rest of this file uses. New-Architecture event subscription pattern
 * (`(VideoTrimNative as Spec).onX(...)`), confirmed directly from the
 * library's own README example — this project has newArchEnabled: true
 * (app.json), so this is the correct form for it, not the legacy
 * NativeEventEmitter(NativeModules.VideoTrim) pattern the same README
 * documents as the Old Architecture fallback.
 *
 * Resolves null for both "user canceled" and "editor reported an error"
 * — pickVideoBase64 below treats those the same way pickImageBase64
 * already treats a canceled picker (silently do nothing), except a
 * genuine editor error is also console.error'd for diagnosability,
 * matching this project's established "don't silently swallow a real
 * failure" convention elsewhere in this file.
 */
function showVideoTrimEditor(filePath: string, config: Parameters<typeof showVideoTrimEditorNative>[1]): Promise<{ outputPath: string; durationMs: number } | null> {
  return new Promise((resolve) => {
    let settled = false;
    const spec = VideoTrimNative as VideoTrimSpec;
    const finishSub = spec.onFinishTrimming(({ outputPath, duration }) => {
      if (settled) return;
      settled = true;
      cleanup();
      // Deliberately NOT toFileUri()'d here — this bare path is fed
      // straight back into compressVideoNative() below (via
      // compressIfNeeded), whose native Android compress() uses it
      // directly as an ffmpeg -i argument and expects the same bare-path
      // shape react-native-video-trim itself produces, not a URI. It's
      // normalized to a proper file:// URI only at the points that
      // actually need one — see toFileUri's own comment.
      resolve({ outputPath, durationMs: duration });
    });
    const cancelSub = spec.onCancel(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    });
    const errorSub = spec.onError(({ message, errorCode }) => {
      if (settled) return;
      settled = true;
      // eslint-disable-next-line no-console
      console.error('[media] video trim editor error:', errorCode, message);
      cleanup();
      resolve(null);
    });
    function cleanup() {
      finishSub.remove();
      cancelSub.remove();
      errorSub.remove();
    }
    showVideoTrimEditorNative(filePath, config);
  });
}

/**
 * Compresses a video only if it's actually over the size cap — not run
 * unconditionally, to avoid burning processing time/battery on clips
 * that already fit. Tries 'medium' quality first (CRF 23, per the
 * library's own type docs — a reasonable balance), then falls back to
 * the more aggressive 'low' (CRF 28) if the first pass still isn't
 * enough. Returns the original path unchanged if compression was never
 * attempted (already under the cap) or if the library itself throws
 * (native compression failure) — the caller's own post-hoc size check
 * is what actually decides pass/fail either way, so a compression
 * failure here degrades to "send rejected as too_large" rather than
 * "silently send an oversized/corrupt file" or "crash."
 */
async function compressIfNeeded(filePath: string, currentBytes: number): Promise<{ path: string; bytes: number }> {
  if (currentBytes <= MAX_VIDEO_FILE_BYTES) return { path: toFileUri(filePath), bytes: currentBytes };

  // filePath is kept bare (not toFileUri()'d) throughout this loop — it's
  // fed straight back into compressVideoNative() on the next iteration,
  // which expects the same bare-path shape the library's own output
  // already is (see the comment on showVideoTrimEditor's resolve() call
  // above). Only toFileUri() at the two points that actually need a URI:
  // the getInfoAsync() existence/size check, and the final returned path
  // (both callers downstream — readAsStringAsync, VideoThumbnails — are
  // expo/JS libraries that expect a URI, not another native trim/compress
  // call).
  for (const quality of ['medium', 'low'] as const) {
    try {
      const { outputPath } = await compressVideoNative(filePath, { quality });
      const info = await FileSystem.getInfoAsync(toFileUri(outputPath));
      const bytes = info.exists ? info.size : currentBytes;
      if (bytes <= MAX_VIDEO_FILE_BYTES) return { path: toFileUri(outputPath), bytes };
      filePath = outputPath; // feed the already-compressed (bare-path) file into the next, more aggressive pass
      currentBytes = bytes;
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(`[media] video compression (${quality}) failed:`, e?.message ?? e);
      break;
    }
  }
  return { path: toFileUri(filePath), bytes: currentBytes };
}

/**
 * Post-trim pipeline: duration check, compress-if-needed, base64 read,
 * thumbnail generation. Shared by both pickVideoBase64 sources. Takes
 * the file path/duration already returned by the trim editor (every
 * video now goes through it — see pickVideoBase64 below) rather than an
 * ImagePicker asset directly, since the trim step may have replaced both
 * the file and its duration.
 */
async function processTrimmedVideo(filePath: string, durationMs: number, mimeType: string | null | undefined): Promise<PickVideoResult> {
  const durationSeconds = Math.round(durationMs / 1000);
  // Defense-in-depth — the trim editor's own maxDuration (set by the
  // caller) should already prevent this, but that's a UI constraint, not
  // a guarantee, same reasoning as every other "check it again after"
  // pattern in this file.
  if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) return { ok: false, reason: 'too_long' };

  // filePath itself stays bare here (see toFileUri's comment) since it's
  // passed to compressIfNeeded below, which may feed it straight into
  // another native compress() call — only this existence/size check needs
  // the file:// form.
  const info = await FileSystem.getInfoAsync(toFileUri(filePath));
  if (!info.exists) return { ok: false, reason: 'failed' };
  const initialBytes = info.size;

  const { path: finalPath, bytes: finalBytes } = await compressIfNeeded(filePath, initialBytes);
  if (finalBytes > MAX_VIDEO_FILE_BYTES) return { ok: false, reason: 'too_large' };

  const base64 = await FileSystem.readAsStringAsync(finalPath, { encoding: FileSystem.EncodingType.Base64 });
  // Real, not estimated, now that a precise on-disk size is already known
  // from compressIfNeeded/getInfoAsync above — kept as a second guard
  // anyway since base64 inflation (~4/3) is exactly what actually rides
  // the wire, not the raw file size.
  if (approxBase64Bytes(base64.length) > MAX_VIDEO_FILE_BYTES) return { ok: false, reason: 'too_large' };

  let thumbnailBase64: string | null = null;
  try {
    const { uri: rawThumbUri } = await VideoThumbnails.getThumbnailAsync(finalPath, { time: 0 });
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

  return { ok: true, base64, mime: mimeType ?? 'video/mp4', durationLabel: formatDuration(durationSeconds), thumbnailBase64 };
}

/**
 * Video picker, mirroring pickImageBase64's shape/error handling and its
 * source parameter (same default, same reasoning — every existing call
 * site passes nothing and keeps picking from the gallery unchanged).
 *
 * Every picked/captured video now goes through react-native-video-trim's
 * native trim editor before it can be sent — matching standard
 * messaging-app video-send UX (select/capture, then trim, then send),
 * not just an escape hatch for oversized clips. EditorConfig.maxDuration
 * enforces the length cap at the UI level (the user cannot select a
 * range longer than MAX_VIDEO_DURATION_SECONDS in the first place);
 * processTrimmedVideo's own duration check is the defense-in-depth
 * backstop, same pattern as everywhere else in this file.
 *
 * Unlike images, expo-image-picker never returns base64 for video assets
 * (only a file uri) — read separately via FileSystem, same technique
 * already proven in stopVoiceRecording below. Thumbnail generation
 * (expo-video-thumbnails) and the trim/compress step
 * (react-native-video-trim) are both wrapped so a failure in either
 * degrades gracefully (no thumbnail / no compression / outright
 * too_large) rather than crashing the whole send. All of this is a new
 * native module whose on-device behavior is unverified in this sandbox
 * (no real device here) — same disclosed limitation as every other
 * native-module change this project has made.
 */
export async function pickVideoBase64(source: 'camera' | 'library' = 'library'): Promise<PickVideoResult> {
  try {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'permission_denied' };

    const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await launch({ mediaTypes: ['videos'], quality: 0.6, videoMaxDuration: MAX_VIDEO_DURATION_SECONDS });
    if (result.canceled || !result.assets[0]) return { ok: false, reason: 'canceled' };
    const asset = result.assets[0];

    const trimmed = await showVideoTrimEditor(asset.uri, {
      maxDuration: MAX_VIDEO_DURATION_SECONDS * 1000,
      saveToPhoto: false,
      openShareSheetOnFinish: false,
      closeWhenFinish: true,
      headerText: 'Trim video',
      // Matches this app's dark, purple-accented theme (theme/tokens.ts's
      // accent palette) rather than the library's own default yellow —
      // a small polish touch, not load-bearing for functionality.
      theme: 'dark',
      trimmerColor: '#7c5cff',
    });
    if (!trimmed) return { ok: false, reason: 'canceled' };

    return await processTrimmedVideo(trimmed.outputPath, trimmed.durationMs, asset.mimeType);
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[media] pickVideoBase64 failed:', e?.message ?? e);
    return { ok: false, reason: 'failed' };
  }
}

// One-shot device location fetch for the "share location" message type —
// no background/continuous tracking, matches the privacy policy's
// one-time-share-only claim.
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

// Writes a received voice message's base64 payload to a temp cache file
// and plays it back — playback needs a real file URI, not a data URI.
export async function playAudioBase64(base64: string, mime = 'audio/m4a') {
  const uri = `${FileSystem.cacheDirectory}voice-${Date.now()}.m4a`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  const player = createAudioPlayer(uri);
  player.play();
  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) player.remove();
  });
}
