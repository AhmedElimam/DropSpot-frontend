import type { ReactNode } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import type { IconName } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';

interface AuthScaffoldProps {
  /** Big line inside the ink hero (e.g. the app name or the screen title). */
  title: string;
  /** Calm supporting line under the title. */
  subtitle?: string;
  /** Retained for call-site compatibility; the hero now shows the brand logo. */
  icon?: IconName;
  /** The form — rendered inside the white paper card that overlaps the hero. */
  children: ReactNode;
  /** Optional centred link row below the card (e.g. "no account? register"). */
  footer?: ReactNode;
}

/**
 * Sanad auth layout: one deep-ink hero band (the single brand moment) rounding
 * into a high-contrast white form card on warm paper. Keeps the first-impression
 * on-brand while leaving the form itself maximally legible for older parents.
 */
export function AuthScaffold({ title, subtitle, children, footer }: AuthScaffoldProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xl4 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Ink hero — the one brand moment on the screen */}
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingTop: insets.top + spacing.xl4,
              paddingBottom: spacing.xl5 + spacing.lg,
              paddingHorizontal: spacing.xl,
              alignItems: 'center',
              borderBottomLeftRadius: radius.xxl + 12,
              borderBottomRightRadius: radius.xxl + 12,
            }}
          >
            <View style={{ marginBottom: spacing.lg }}>
              <BrandMark size={104} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff', textAlign: 'center' }}>
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 15,
                  lineHeight: 23,
                  color: 'rgba(255,255,255,0.72)',
                  textAlign: 'center',
                  marginTop: spacing.xs,
                }}
              >
                {subtitle}
              </Text>
            ) : null}
          </LinearGradient>

          {/* Paper form card, pulled up to overlap the hero's rounded base */}
          <View
            style={{
              marginTop: -(spacing.xl4),
              marginHorizontal: spacing.lg,
              backgroundColor: colors.surface,
              borderRadius: radius.xxl,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.xl,
              ...shadows.md,
            }}
          >
            {children}
          </View>

          {footer ? (
            <View style={{ alignItems: 'center', marginTop: spacing.xl }}>{footer}</View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
