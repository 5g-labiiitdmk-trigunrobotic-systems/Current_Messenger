// Web stub — react-native-webrtc has no web support and this app doesn't
// target web as a real platform (web only exists here for layout-verification
// screenshots). Metro picks this file over webrtc.ts automatically for web
// bundles via its platform-suffix resolution, so react-native-webrtc's
// native-only code is never even pulled into the web bundle graph.
import React from 'react';
import { View } from 'react-native';

class UnsupportedOnWeb extends Error {
  constructor() {
    super('Calling is not supported on web in this app.');
  }
}

export class RTCPeerConnection {
  constructor() {
    throw new UnsupportedOnWeb();
  }
}
export class RTCSessionDescription {
  constructor() {
    throw new UnsupportedOnWeb();
  }
}
export class RTCIceCandidate {
  constructor() {
    throw new UnsupportedOnWeb();
  }
}
export class MediaStream {
  constructor() {
    throw new UnsupportedOnWeb();
  }
}

export const RTCView: React.FC<any> = (props) => React.createElement(View, props);

export const mediaDevices = {
  getUserMedia: async (): Promise<never> => {
    throw new UnsupportedOnWeb();
  },
};

export const WEBRTC_SUPPORTED = false;
