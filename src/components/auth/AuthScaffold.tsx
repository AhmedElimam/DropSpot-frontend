import type { ReactNode } from 'react';
import { View, Text, KeyboardAvoidingView, ScrollView, StatusBar, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';

interface AuthScaffoldProps {
  /** The screen's headline, in ink on the canvas. */
  title: string;
  /** Calm supporting line under it. */
  subtitle?: string;
  /** Small brand-coloured line ABOVE the title («أهلًا بعودتك»). */
  eyebrow?: string;
  /** 'brand' = the big centred emblem (login); 'compact' = back button + small lockup. */
  hero?: 'brand' | 'compact';
  /** Shows the back button in the top row. */
  onBack?: () => void;
  /** Retained for call-site compatibility; unused. */
  icon?: IconName;
  /** The form, inside the white card. */
  children: ReactNode;
  /** Centred row under the card (e.g. «ليس لديك حساب؟»). */
  footer?: ReactNode;
}

/**
 * The auth screens' layout, in the app's canvas style (the same warm paper, ink text and
 * floating white card the role homes use — see project memory "canvas-based redesign").
 * The old deep-ink gradient band is gone: a dark hero over a form read as a lid, pushed
 * the first field below the fold on small phones, and made the status bar fight the
 * keyboard. Here the brand is one gradient tile, the title is dark text, and the form
 * starts within the first screen on a 5.5" phone.
 */
export function AuthScaffold({ title, subtitle, eyebrow, hero = 'compact', onBack, children, footer }: AuthScaffoldProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {hero === 'brand' ? (
            <View style={{ alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.xl }}>
              <BrandTile size={88} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, marginTop: spacing.md }}>{t('common.app_name')}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginBottom: spacing.lg }}>
              {onBack ? (
                <TouchableOpacity
                  onPress={onBack}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.back')}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  {/* RTL: "back" points to the right. */}
                  <Icon name="forward" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              ) : <View style={{ width: 44 }} />}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('common.app_name')}</Text>
                <BrandTile size={34} />
              </View>
            </View>
          )}

          <View style={{ marginBottom: spacing.lg, alignItems: hero === 'brand' ? 'center' : 'flex-start' }}>
            {eyebrow ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.brand, marginBottom: 2, textAlign: hero === 'brand' ? 'center' : 'right' }}>{eyebrow}</Text>
            ) : null}
            <Text style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: 36, color: colors.textPrimary, textAlign: hero === 'brand' ? 'center' : 'right' }}>{title}</Text>
            {subtitle ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, marginTop: spacing.xs, textAlign: hero === 'brand' ? 'center' : 'right' }}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.xl, ...shadows.md }}>
            {children}
          </View>

          {footer ? <View style={{ alignItems: 'center', marginTop: spacing.xl }}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** The white emblem on a small brand-gradient tile — the one brand moment per screen. */
export function BrandTile({ size }: { size: number }) {
  return (
    <LinearGradient
      colors={gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center', ...shadows.sm }}
    >
      <BrandMark size={Math.round(size * 0.56)} />
    </LinearGradient>
  );
}

/** The one inline notice the auth forms use: a mistake, or a done step. */
export function AuthBanner({ tone, text }: { tone: 'danger' | 'success' | 'info'; text: string }) {
  const bg = tone === 'danger' ? colors.dangerLight : tone === 'success' ? colors.successLight : colors.brandTint;
  const fg = tone === 'danger' ? colors.dangerText : tone === 'success' ? colors.successText : colors.infoText;
  const ic = tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.brand;
  const icon: IconName = tone === 'danger' ? 'error' : tone === 'success' ? 'success' : 'info';

  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
      <Icon name={icon} size={20} color={ic} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: fg, textAlign: 'right' }}>{text}</Text>
    </View>
  );
}
