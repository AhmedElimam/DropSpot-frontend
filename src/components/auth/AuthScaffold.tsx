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
 * The auth screens' layout: the deep-ink blue fills the WHOLE screen (founder 2026-10-02:
 * «make the background of register and login the blue color» — the warm-paper canvas under
 * the card was the part he did not like), with the white form card sitting on it. The
 * header is SHORT on the inner screens (back button + title) and tall only on login, so the
 * first field still lands within the first screen on a 5.5" phone.
 */
export function AuthScaffold({ title, subtitle, eyebrow, hero = 'compact', onBack, children, footer }: AuthScaffoldProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const tall = hero === 'brand';

  return (
    <LinearGradient colors={gradients.auth} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor={gradients.auth[0]} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + spacing.xxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              paddingTop: insets.top + spacing.sm,
              paddingBottom: spacing.xl,
              paddingHorizontal: spacing.xl,
            }}
          >
            {/* Top row: back (inner screens) + the small lockup. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
              {onBack ? (
                <TouchableOpacity
                  onPress={onBack}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.back')}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}
                >
                  {/* RTL: "back" points to the right. */}
                  <Icon name="forward" size={22} color="#fff" />
                </TouchableOpacity>
              ) : <View style={{ width: 44 }} />}
              {!tall ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: 'rgba(255,255,255,0.9)' }}>{t('common.app_name')}</Text>
                  <BrandMark tint="#fff" size={26} />
                </View>
              ) : null}
            </View>

            {tall ? (
              <View style={{ alignItems: 'center', marginTop: spacing.md }}>
                <BrandMark tint="#fff" size={96} />
              </View>
            ) : null}

            <View style={{ marginTop: tall ? spacing.lg : spacing.md, alignItems: tall ? 'center' : 'flex-start' }}>
              {eyebrow ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.72)', marginBottom: 2, textAlign: tall ? 'center' : 'auto' }}>{eyebrow}</Text>
              ) : null}
              <Text style={{ fontFamily: fonts.bold, fontSize: tall ? 28 : 24, lineHeight: tall ? 40 : 34, color: '#fff', textAlign: tall ? 'center' : 'auto' }}>{title}</Text>
              {subtitle ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: 'rgba(255,255,255,0.78)', marginTop: spacing.xs, textAlign: tall ? 'center' : 'auto' }}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>

          {/* The form card, white on the blue. */}
          <View style={{ marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.xl, ...shadows.md }}>
            {children}
          </View>

          {footer ? <View style={{ alignItems: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg }}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/** Footer text on the blue: the muted white the header's subtitle uses. */
export const AUTH_FOOTER_TEXT = 'rgba(255,255,255,0.78)';
export const AUTH_FOOTER_LINK = '#FFFFFF';

/** The white emblem on a small brand-gradient tile — the one brand moment per screen. */
export function BrandTile({ size }: { size: number }) {
  return (
    <LinearGradient
      colors={gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center', ...shadows.sm }}
    >
      <BrandMark tint="#fff" size={Math.round(size * 0.56)} />
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
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: fg }}>{text}</Text>
    </View>
  );
}
