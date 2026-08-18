import React, { useEffect, useRef } from 'react';
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

// onDidFailLoadingMap (below) only fires for style-load failures — not for
// individual vector-tile fetch failures once the style itself has loaded,
// and not for a native view that mounts but silently never paints for some
// other reason. Confirmed via a real-device screenshot: a location bubble
// that never called onLoadFailed, never threw a JS error caught by
// LocationErrorBoundary, and still showed no map — just an invisible
// 220x140 gap above a caption that read plain "Location" (proving it was
// on the happy-path return, not any fallback state; see this round's
// conversation for the full code-path elimination). onDidFailLoadingMap
// alone can never catch that class of failure, since by definition nothing
// ever told it something was wrong. This timeout closes that gap: if
// onDidFinishLoadingMap hasn't fired within LOAD_TIMEOUT_MS of mount,
// "still not loaded" is itself treated as a failure, so the diagnostic
// fallback becomes reachable even when nothing native ever reports an
// explicit error.
const LOAD_TIMEOUT_MS = 8000;

// Real-device evidence this round: zero `mbgl`-tagged logcat output at all
// (MapLibre Native's own C++ core logger — inherited from its Mapbox GL
// Native fork lineage), and the 8s timeout above never fired either (no
// [LocationMapSurface] warning), on top of no onDidFailLoadingMap and no JS
// error caught by LocationErrorBoundary. That full silence is consistent
// with two different explanations that look identical from the JS side:
// (a) this component never actually mounts far enough to construct
// MapLibreMap at all, or (b) it mounts and genuinely finishes loading
// (silencing the timeout, since a native core has no reason to log
// anything on success), but the rendered output never reaches the screen.
// LOG_TAG below (a synchronous, unconditional log at the very top of every
// render, independent of anything MapLibre-specific) is what actually
// distinguishes these two — check for it in the same logcat capture.
//
// (b) has a concrete, well-evidenced candidate: this component's default
// rendering surface. The installed package's own type definitions
// (Map.d.ts) say `androidView` defaults to `"surface"` — i.e. a
// SurfaceView/GLSurfaceView-backed native layer, which Android composites
// via a hardware "hole punch" outside the normal view-drawing pipeline
// rather than through it. The preview card that wraps this component
// (MessageBubble.tsx:346, `overflow: 'hidden'` + `borderRadius: 20`, to
// get the rounded-corner clipped thumbnail visible in the screenshot) is
// exactly the kind of clipping that a hole-punched SurfaceView is known
// not to respect correctly on Android — the surface can end up composited
// incorrectly relative to that clip and simply never becomes visible,
// while still rendering "successfully" as far as the native core and its
// own logger are concerned. This library ships an explicit way around
// that: `androidView="texture"` renders through a TextureView instead,
// which is a normal GPU-backed bitmap that participates in the standard
// view hierarchy (clipping, rounded corners, opacity — all of it) instead
// of bypassing it. Set below for exactly that reason. This library has
// also had real, confirmed Fabric/Android-specific event-delivery bugs
// before (maplibre/maplibre-react-native#1165, fixed in 11.0.0 stable —
// this project is on 11.3.6, past that fix, but it's evidence this
// category of bug is real for this library on this platform, not
// hypothetical) and a historical native-registration issue under RN's
// bridgeless mode (maplibre/maplibre-react-native#436, closed via #483) —
// neither is confirmed as *this* bug, but both corroborate that Android
// Fabric integration has genuinely had rough edges here.
const LOG_TAG = '[LocationMapSurface]';

export function LocationMapSurface({ lat, lng, width, height, interactive, onLoadFailed }: LocationMapSurfaceProps) {
  const finishedRef = useRef(false);

  // eslint-disable-next-line no-console
  console.log(LOG_TAG, 'render — this fires on every render regardless of MapLibre; if this never appears in logcat, the component itself is never reached (a JS/import/routing problem upstream, not MapLibre). lat/lng:', lat, lng);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(LOG_TAG, 'mount effect ran — MapLibreMap was constructed and the timer armed.');
    finishedRef.current = false;
    const timer = setTimeout(() => {
      if (!finishedRef.current) {
        onLoadFailed?.(
          `Map did not finish loading within ${LOAD_TIMEOUT_MS / 1000}s — onDidFinishLoadingMap never fired, and no explicit onDidFailLoadingMap error was reported either. This is the "silently renders nothing" failure mode, not a reported one (see LOAD_TIMEOUT_MS's comment above).`
        );
      }
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // A new location message is a new component instance (same reasoning
    // as the .web.tsx variant's identical comment) — this only needs to
    // arm once per mount, not re-run on every prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ width, height }}>
      <MapLibreMap
        style={{ flex: 1 }}
        mapStyle={OPENFREEMAP_STYLE_URL}
        // See LOG_TAG's comment above — this is the primary suspected fix,
        // not just a diagnostic. Switches off the default SurfaceView-based
        // rendering path that doesn't reliably composite under this card's
        // overflow:hidden/rounded-corner clipping.
        androidView="texture"
        attribution={interactive}
        dragPan={interactive}
        touchZoom={interactive}
        touchRotate={interactive}
        touchPitch={interactive}
        doubleTapZoom={interactive}
        doubleTapHoldZoom={interactive}
        onDidFailLoadingMap={() => onLoadFailed?.('MapLibre onDidFailLoadingMap fired — the style or its tiles failed to load.')}
        onDidFinishLoadingMap={() => {
          // eslint-disable-next-line no-console
          console.log(LOG_TAG, 'onDidFinishLoadingMap fired — native core reports the map genuinely finished loading.');
          finishedRef.current = true;
        }}
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
