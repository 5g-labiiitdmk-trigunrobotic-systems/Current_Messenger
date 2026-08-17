import React, { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { Map as MapLibreGlMap, Marker as MapLibreGlMarker, type ErrorEvent as MapLibreGlErrorEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LocationMapSurfaceProps } from './LocationMapSurface.ios';

// Web isn't a real target platform for this app (it only exists for
// layout-verification screenshots — see this project's own established
// scope), but this uses the actual maplibre-gl JS library (MapLibre
// Native's sibling project, same OpenFreeMap-recommended renderer) rather
// than leaving web on the old raster mosaic, for two reasons: consistency
// with the Android path, and — more practically — this is the only piece
// of the OpenFreeMap switch this sandbox can genuinely render and verify
// end-to-end, since MapLibre Native's actual on-device Android behavior is
// unverifiable here (no Android SDK). See this round's report for exactly
// what that verification did and didn't prove.
const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const ATTRIBUTION_TEXT = 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap';

export function LocationMapSurface({ lat, lng, width, height, interactive, onLoadFailed }: LocationMapSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreGlMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreGlMap({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: [lng, lat],
      zoom: 15,
      interactive,
      // Own attribution text (below) is the guaranteed-correct mechanism
      // (see ATTRIBUTION_TEXT's comment in the Android variant) — the
      // built-in control is left enabled too, matching MapLibre's own
      // documented recommendation, not disabled here.
    });
    mapRef.current = map;
    map.on('error', (e: MapLibreGlErrorEvent) => onLoadFailed?.(`maplibre-gl 'error' event: ${e?.error?.message ?? String(e)}`));
    new MapLibreGlMarker({ color: '#ff4d4f' }).setLngLat([lng, lat]).addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // lat/lng/interactive intentionally not in deps — this map instance is
    // recreated by React only via the `key` the caller assigns per message
    // (a new location message is a new component instance), matching how
    // the native variants behave; re-running this effect on every pan/zoom-
    // adjacent prop change would tear down and rebuild the WebGL context
    // for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <View style={{ position: 'absolute', left: 4, bottom: 4, backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
        <Text style={{ fontSize: 8, color: '#333' }}>{ATTRIBUTION_TEXT}</Text>
      </View>
    </View>
  );
}
