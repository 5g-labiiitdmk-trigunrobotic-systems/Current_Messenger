import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { useThemeStore } from '../state/themeStore';
import { wallpapers, type Pool } from '../theme/wallpapers';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function DriftOrb({ baseX, baseY, size, opacity, color, duration, reverse }: { baseX: number; baseY: number; size: number; opacity: number; color: string; duration: number; reverse?: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);
  const dir = reverse ? -1 : 1;
  const animatedProps = useAnimatedProps(() => ({
    cx: baseX + dir * -20 * t.value,
    cy: baseY + dir * 16 * t.value,
  }));
  return <AnimatedCircle animatedProps={animatedProps} r={size} fill={color} opacity={opacity} />;
}

export function BokehBackground({ style }: { style?: any }) {
  const { mode } = useTheme();
  const wallpaperKey = useThemeStore((s) => s.wallpaperKey);
  const { width, height } = useWindowDimensions();
  const variant = (wallpapers[wallpaperKey] ?? wallpapers.default)[mode];
  const { wallStops, pools, orbColor } = variant;
  const maxDim = Math.max(width, height);

  return (
    <Svg width={width} height={height} style={[StyleSheet.absoluteFill, style]}>
      <Defs>
        <SvgLinearGradient id="wall" x1="0" y1="0" x2="1" y2="0.85">
          {wallStops.map((c, i) => (
            <Stop key={i} offset={i / (wallStops.length - 1)} stopColor={c} />
          ))}
        </SvgLinearGradient>
        {pools.map((p, i) => (
          <RadialGradient key={i} id={`pool-${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={p.color} />
            <Stop offset="1" stopColor={p.color} stopOpacity="0" />
          </RadialGradient>
        ))}
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#wall)" />
      {pools.map((p, i) => (
        <Circle key={i} cx={width * p.cx} cy={height * p.cy} r={maxDim * p.r} fill={`url(#pool-${i})`} />
      ))}
      {/* drifting bokeh orbs */}
      <DriftOrb baseX={width * 0.92} baseY={height * 0.08} size={60} opacity={0.85} color={orbColor} duration={11000} />
      <DriftOrb baseX={width * 0.76} baseY={height * 0.32} size={32} opacity={0.7} color={orbColor} duration={9000} reverse />
      <DriftOrb baseX={width * 0.96} baseY={height * 0.48} size={45} opacity={0.6} color={orbColor} duration={13000} />
      <DriftOrb baseX={width * 0.6} baseY={height * 0.2} size={15} opacity={0.8} color={orbColor} duration={8000} />
    </Svg>
  );
}
