import React from 'react';
import Svg, { Path } from 'react-native-svg';

// FILE PURPOSE: A simple teardrop map-pin SVG icon. Shared between LocationMapSurface.android.tsx and .web.tsx (both place
// this as a custom marker on their respective MapLibre map), moved out of
// MessageBubble.tsx where it used to live only for the now-removed raster
// tile mosaic. Not used by the iOS variant — react-native-maps' Marker
// there uses MapKit's own default pin, unchanged from before.
export function LocationPinIcon({ size = 30, color = '#ff4d4f' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8Z" fill={color} />
      <Path d="M12 7a3 3 0 110 6 3 3 0 010-6Z" fill="#fff" />
    </Svg>
  );
}
