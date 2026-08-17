import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients, control } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

// Celebration wall shown the moment a new student account is verified — a warm,
// one-time "welcome aboard" gesture before the user is handed to login. Uses only
// React Native's built-in Animated (no confetti dependency): the badge pops in,
// the copy fades up, and a ring of festive dots bursts outward around the badge.
const DOTS = [
  { angle: -90, color: colors.brand },
  { angle: -30, color: colors.success },
  { angle: 30, color: colors.accentWarm ?? colors.brand },
  { angle: 90, color: colors.brand },
  { angle: 150, color: colors.success },
  { angle: 210, color: colors.accentWarm ?? colors.brand },
];

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { name } = useLocalSearchParams<{ name?: string }>();

  const badgeScale = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentLift = useRef(new Animated.Value(24)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(badgeScale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(burst, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(contentFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(contentLift, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, [badgeScale, burst, contentFade, contentLift]);

  const firstName = (name ?? '').trim().split(/\s+/)[0];

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
        {/* Badge + bursting dots */}
        <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl }}>
          {DOTS.map((d, i) => {
            const rad = (d.angle * Math.PI) / 180;
            const translateX = burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * 92] });
            const translateY = burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * 92] });
            const scale = burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1.2, 1] });
            return (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute', width: 14, height: 14, borderRadius: 7,
                  backgroundColor: d.color, opacity: burst,
                  transform: [{ translateX }, { translateY }, { scale }],
                }}
              />
            );
          })}
          <Animated.View
            style={{
              width: 112, height: 112, borderRadius: 56,
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)',
              alignItems: 'center', justifyContent: 'center',
              transform: [{ scale: badgeScale }],
            }}
          >
            <Icon name="success" size={56} color="#fff" />
          </Animated.View>
        </View>

        <Animated.View style={{ alignItems: 'center', opacity: contentFade, transform: [{ translateY: contentLift }] }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 30, color: '#fff', textAlign: 'center' }}>
            {t('auth.congrats_title')}
          </Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: '#fff', textAlign: 'center', marginTop: spacing.md }}>
            {t('auth.congrats_headline')}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 26, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: spacing.md, maxWidth: 340 }}>
            {firstName ? t('auth.congrats_body', { name: firstName }) : t('auth.congrats_body_generic')}
          </Text>
        </Animated.View>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.85} style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
          <View style={{ backgroundColor: '#fff', minHeight: control.minHeight, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.brand, letterSpacing: 1 }}>
              {t('auth.congrats_cta')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}
