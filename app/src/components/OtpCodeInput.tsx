import React, { useEffect, useRef } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedProps,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  interpolateColor,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { fontFamilies, success as successColor } from '../theme/tokens';
import { OTP_CODE_LENGTH } from '../lib/otp';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type OtpInputStatus = 'idle' | 'error' | 'success';

interface OtpCodeInputProps {
  value: string;
  onChangeText: (code: string) => void;
  /** 'error' plays the shake once and reverts to 'idle' on the next digit
   * change; 'success' holds (boxes turn green, checkmark draws in) until
   * the caller navigates away. */
  status: OtpInputStatus;
  autoFocus?: boolean;
}

/**
 * FILE PURPOSE / component doc: The 6-digit animated code-entry row used
 * by phone-auth/verify.tsx. A single off-screen TextInput actually
 * captures keyboard/SMS-autofill input (the standard RN pattern for a
 * multi-box code field — six separately-focused inputs fighting over
 * autofill and backspace-across-boxes is far more fragile) while six
 * plain boxes purely render the current value, each animating in on its
 * own the instant its digit arrives. The row itself shakes on 'error' and
 * the whole set glows success-green with a self-drawing checkmark on
 * 'success'.
 */
export function OtpCodeInput({ value, onChangeText, status, autoFocus }: OtpCodeInputProps) {
  const { tokens, a1 } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const shakeX = useSharedValue(0);
  const successProgress = useSharedValue(0);
  const checkmarkDraw = useSharedValue(0);
  // One bounce value per box, fixed-length (OTP_CODE_LENGTH never changes
  // at runtime) — safe to call these as a flat list of hooks rather than
  // in a loop/array, since the count is a compile-time constant.
  const bounce0 = useSharedValue(0);
  const bounce1 = useSharedValue(0);
  const bounce2 = useSharedValue(0);
  const bounce3 = useSharedValue(0);
  const bounce4 = useSharedValue(0);
  const bounce5 = useSharedValue(0);
  const bounces = [bounce0, bounce1, bounce2, bounce3, bounce4, bounce5];
  const prevLength = useRef(0);

  // Bounces exactly the box that just received a new digit — compares the
  // previous value length to the current one rather than watching each
  // box independently, so pasting/autofilling the whole code at once
  // still only bounces the boxes that are actually newly filled.
  useEffect(() => {
    for (let i = prevLength.current; i < value.length; i++) {
      if (bounces[i]) {
        bounces[i].value = withSequence(withSpring(1, { damping: 6, stiffness: 300 }), withSpring(0, { damping: 10, stiffness: 220 }));
      }
    }
    prevLength.current = value.length;
    // Backspacing (length decreasing) needs no animation of its own —
    // the box simply goes back to empty.
  }, [value]);

  // Shakes the whole row once per 'error' status, then reverts to 'idle'
  // is the caller's job (see phone-auth/verify.tsx) — this effect only
  // plays the animation, it never resets `status` itself.
  useEffect(() => {
    if (status === 'error') {
      shakeX.value = withSequence(
        withTiming(-10, { duration: 45 }),
        withTiming(10, { duration: 90 }),
        withTiming(-8, { duration: 90 }),
        withTiming(8, { duration: 90 }),
        withTiming(-4, { duration: 70 }),
        withTiming(0, { duration: 70 })
      );
    }
  }, [status]);

  useEffect(() => {
    if (status === 'success') {
      successProgress.value = withTiming(1, { duration: 260 });
      // Starts just after the boxes begin turning green, so the check
      // reads as "confirming" the color change rather than racing it.
      checkmarkDraw.value = withTiming(1, { duration: 420 });
    } else {
      successProgress.value = 0;
      checkmarkDraw.value = 0;
    }
  }, [status]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const digits = Array.from({ length: OTP_CODE_LENGTH }, (_, i) => value[i] ?? '');

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <Animated.View style={[{ flexDirection: 'row', justifyContent: 'space-between' }, rowStyle]}>
        {digits.map((digit, i) => (
          <OtpBox
            key={i}
            digit={digit}
            focused={i === value.length}
            bounce={bounces[i]}
            successProgress={successProgress}
            tokens={tokens}
            accent={a1}
          />
        ))}
      </Animated.View>

      {status === 'success' && (
        <View style={{ alignItems: 'center', marginTop: 22 }}>
          <SelfDrawingCheckmark draw={checkmarkDraw} color={successColor} />
        </View>
      )}

      {/* The real input: invisible, positioned over the row, capturing
          every keystroke/paste/SMS-autofill. autoComplete="sms-otp" +
          textContentType="oneTimeCode" hook into each platform's native
          SMS-autofill affordance for free once a real provider sends
          real SMS — harmless no-ops today against the mock provider. */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/[^0-9]/g, '').slice(0, OTP_CODE_LENGTH))}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        autoFocus={autoFocus}
        maxLength={OTP_CODE_LENGTH}
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
      />
    </Pressable>
  );
}

interface OtpBoxProps {
  digit: string;
  focused: boolean;
  bounce: SharedValue<number>;
  successProgress: SharedValue<number>;
  tokens: ReturnType<typeof useTheme>['tokens'];
  accent: string;
}

// One digit box — background/border color animates toward `successColor`
// as successProgress rises, and scales up briefly via `bounce` the moment
// its digit is set.
function OtpBox({ digit, focused, bounce, successProgress, tokens, accent }: OtpBoxProps) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + bounce.value * 0.22 }],
    borderColor: interpolateColor(successProgress.value, [0, 1], [digit ? accent : tokens.glassBorder, successColor]),
    backgroundColor: interpolateColor(successProgress.value, [0, 1], [tokens.field, 'rgba(52,210,123,0.14)']),
  }));
  return (
    <Animated.View
      style={[
        {
          width: 46,
          height: 56,
          borderRadius: 14,
          borderWidth: focused ? 2 : 1.5,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Animated.Text style={{ fontSize: 22, fontFamily: fontFamilies.bold, color: tokens.text }}>{digit}</Animated.Text>
    </Animated.View>
  );
}

// A checkmark whose stroke draws itself in as `draw` goes 0 -> 1, via the
// classic SVG stroke-dasharray/dashoffset trick — the path's total length
// is fixed (a short two-segment check shape), so dashoffset is simply
// interpolated from that full length down to 0. react-native-svg's
// AnimatedPath needs strokeDasharray/strokeDashoffset driven via
// animatedProps (SVG props), not a plain animated style (RN View style
// fields) — hence useAnimatedProps rather than useAnimatedStyle here.
function SelfDrawingCheckmark({ draw, color }: { draw: SharedValue<number>; color: string }) {
  const PATH_LENGTH = 36; // approximate length of the path below, in its own viewBox units
  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [PATH_LENGTH, PATH_LENGTH],
    strokeDashoffset: PATH_LENGTH * (1 - draw.value),
  }));
  return (
    <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
      <AnimatedPath d="M5 13l4 4L19 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" animatedProps={animatedProps} />
    </Svg>
  );
}
