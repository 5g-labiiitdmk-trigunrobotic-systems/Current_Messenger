import React from 'react';
import MapView, { Marker } from 'react-native-maps';

// iOS only — Apple MapKit backend, no API key needed, untouched by the
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
