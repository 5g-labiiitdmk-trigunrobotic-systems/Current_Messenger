import React from 'react';
import { View, Text } from 'react-native';
import { Map as MapLibreMap, Camera, Marker } from '@maplibre/maplibre-react-native';
import { LocationPinIcon } from './LocationPinIcon';
import type { LocationMapSurfaceProps } from './LocationMapSurface.ios';

// Real vector-tile rendering via MapLibre Native + OpenFreeMap
// (https://openfreemap.org), replacing the raster tile-image mosaic this
// project used before (raw OpenStreetMap tiles, then briefly MapTiler,
// then raw OSM again — see git history / docs/SETUP.md for that saga).
// OpenFreeMap explicitly does not offer raster tile hosting (confirmed
// directly from their GitHub README: "OpenFreeMap is not providing: ...
// raster tile hosting, ... static image generation") — using it at all
// requires an actual vector-tile rendering client, which is what
// @maplibre/maplibre-react-native (MapLibre Native's official RN binding)
// is. This is a materially bigger dependency than the plain <Image>-based
// mosaic it replaces: a new native module whose on-device behavior this
// sandbox cannot verify (no Android SDK — see this round's report for
// exactly what was and wasn't verified). Chosen anyway, deliberately,
// after flagging that risk directly — see the conversation this shipped
// in, not just this comment.
const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
// Required by OpenFreeMap's usage policy for non-MapLibre clients; kept
// here too even though MapLibre's own built-in attribution control
// (attribution prop below) is supposed to render whatever the style JSON
// itself embeds automatically — this sandbox cannot fetch that JSON to
// confirm its exact embedded string (tiles.openfreemap.org is blocked by
// this environment's own network egress policy), so this explicit text
// is a belt-and-suspenders guarantee rather than the sole mechanism.
const ATTRIBUTION_TEXT = 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap';

export function LocationMapSurface({ lat, lng, width, height, interactive, onLoadFailed }: LocationMapSurfaceProps) {
  return (
    <View style={{ width, height }}>
      <MapLibreMap
        style={{ flex: 1 }}
        mapStyle={OPENFREEMAP_STYLE_URL}
        attribution={interactive}
        dragPan={interactive}
        touchZoom={interactive}
        touchRotate={interactive}
        touchPitch={interactive}
        doubleTapZoom={interactive}
        doubleTapHoldZoom={interactive}
        onDidFailLoadingMap={() => onLoadFailed?.('MapLibre onDidFailLoadingMap fired — the style or its tiles failed to load.')}
      >
        <Camera initialViewState={{ center: [lng, lat], zoom: 15 }} />
        <Marker lngLat={[lng, lat]} anchor="bottom">
          <LocationPinIcon />
        </Marker>
      </MapLibreMap>
      {/* Explicit attribution text — see ATTRIBUTION_TEXT's own comment.
          Only rendered on the non-interactive preview, where MapLibre's own
          attribution control is disabled (attribution={interactive} above)
          since a tappable "i" button has nothing useful to do inside a
          220x140 preview that isn't already reachable by tapping through to
          the expanded view, which keeps the native control enabled. */}
      {!interactive && (
        <View style={{ position: 'absolute', left: 4, bottom: 4, backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
          <Text style={{ fontSize: 8, color: '#333' }}>{ATTRIBUTION_TEXT}</Text>
        </View>
      )}
    </View>
  );
}
