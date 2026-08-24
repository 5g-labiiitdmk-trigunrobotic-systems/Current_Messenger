import React from 'react';
import MapView, { Marker } from 'react-native-maps';

// FILE PURPOSE: The iOS implementation of LocationMapSurface (see
// LocationMapSurface.tsx for how Metro picks this file, and this file's
// own props type — LocationMapSurfaceProps — which every platform
// variant implements). iOS only — Apple MapKit backend, no API key needed, untouched by the
// OpenFreeMap switch (which only replaced the Android/web raster-tile-
// mosaic path). See LocationMapSurface.android.tsx's doc comment for why
// this project is deliberately not unifying iOS onto the same MapLibre
// renderer this round — this screen already works correctly on iOS and
// this phase of work is scoped to Android.
export interface LocationMapSurfaceProps {
  lat: number;
  lng: number;
  width: number;
  height: number;
  interactive: boolean;
  onLoadFailed?: (reason: string) => void;
}

// Renders a MapKit view centered on the given coordinate with a single
// pin marker; `interactive` gates all gesture/zoom/rotate/pitch controls
// together (off for the small in-bubble preview, on for the expanded
// full-screen view).
export function LocationMapSurface({ lat, lng, width, height, interactive }: LocationMapSurfaceProps) {
  const region = { latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  return (
    <MapView
      style={{ width, height }}
      initialRegion={region}
      pointerEvents={interactive ? 'auto' : 'none'}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={interactive}
      pitchEnabled={interactive}
    >
      <Marker coordinate={{ latitude: lat, longitude: lng }} />
    </MapView>
  );
}
