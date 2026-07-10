// Native (iOS/Android) implementation — thin re-export of react-native-webrtc.
// webrtc.web.ts is the counterpart Metro picks on web (react-native-webrtc has
// no web support and cannot even be required there); keeping this split by
// filename, rather than a Platform.OS branch inside one file, matters because
// Metro resolves platform-specific modules statically — a runtime branch
// would still pull react-native-webrtc into the web bundle graph and break it.
export {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';

export const WEBRTC_SUPPORTED = true;
