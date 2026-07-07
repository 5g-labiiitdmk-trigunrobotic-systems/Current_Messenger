import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Pool {
  cx: number; // 0-1
  cy: number; // 0-1
  r: number; // 0-1 of max dimension
  color: string;
}

const LIGHT_POOLS: Pool[] = [
  { cx: 0.86, cy: 0.24, r: 0.34, color: 'rgba(255,224,158,0.95)' },
  { cx: 0.74, cy: 0.52, r: 0.28, color: 'rgba(255,198,132,0.85)' },
  { cx: 0.96, cy: 0.78, r: 0.32, color: 'rgba(255,214,150,0.7)' },
  { cx: 0.1, cy: 0.26, r: 0.38, color: 'rgba(178,170,238,0.9)' },
  { cx: 0.02, cy: 0.78, r: 0.38, color: 'rgba(150,166,232,0.78)' },
];

const DARK_POOLS: Pool[] = [
  { cx: 0.8, cy: 0.22, r: 0.36, color: 'rgba(150,150,165,0.22)' },
  { cx: 0.16, cy: 0.72, r: 0.36, color: 'rgba(120,120,138,0.18)' },
  { cx: 0.5, cy: 0.5, r: 0.55, color: 'rgba(90,90,104,0.12)' },
];

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
  const { mode, tokens } = useTheme();
  const { width, height } = useWindowDimensions();
  const pools = mode === 'light' ? LIGHT_POOLS : DARK_POOLS;
  const maxDim = Math.max(width, height);

  return (
    <Svg width={width} height={height} style={[StyleSheet.absoluteFill, style]}>
      <Defs>
        <SvgLinearGradient id="wall" x1="0" y1="0" x2="1" y2="0.85">
          {tokens.wallStops.map((c, i) => (
            <Stop key={i} offset={i / (tokens.wallStops.length - 1)} stopColor={c} />
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
      {/* drifting bokeh orbs (light mode: warm; dark mode: grey) */}
      <DriftOrb baseX={width * 0.92} baseY={height * 0.08} size={60} opacity={0.85} color={tokens.orbColor} duration={11000} />
      <DriftOrb baseX={width * 0.76} baseY={height * 0.32} size={32} opacity={0.7} color={tokens.orbColor} duration={9000} reverse />
      <DriftOrb baseX={width * 0.96} baseY={height * 0.48} size={45} opacity={0.6} color={tokens.orbColor} duration={13000} />
      <DriftOrb baseX={width * 0.6} baseY={height * 0.2} size={15} opacity={0.8} color={tokens.orbColor} duration={8000} />
    </Svg>
  );
}
