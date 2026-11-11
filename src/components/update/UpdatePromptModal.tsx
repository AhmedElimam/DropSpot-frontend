import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppModal as Modal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useRose } from '@/hooks/useRose';
import { useTourStore } from '@/tour/store';
import { usePopupSlot } from '@/ui/popupSlot';
import { RosePortrait } from '@/components/rose/RoseStamp';
import { NazerFramed } from '@/components/nazer/NazerFramed';
import { BrandMark } from '@/components/ui/BrandMark';
import { Icon } from '@/components/ui/Icon';
import { Surface } from '@/ui/surfaces';
import { binaryVersion } from '@/utils/binaryVersion';
import { storeLinksFor } from '@/utils/storeLinks';
import { UPDATE_PROMPT_STORAGE_KEY, parseSnooze, updateOffered, updatePromptVoice, updateSnoozed, type UpdateSnooze } from './updatePrompt';

const HEAD = 92;
const BLOCKING_PREFIXES = [
  '/accept-terms', '/change-password', '/verify-own-number', '/impersonate', '/invite', '/login', '/register', '/verify-otp',
  '/forgot-password', '/reset-password', '/welcome', '/whats-new', '/subscription-wall',
];

/** Said «بعدين» since the app was opened: not again before the next opening, whatever the clock says. */
let putAwayThisLaunch = false;

async function openFirst(urls: string[]): Promise<void> {
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // Refused (no store app on this phone) — the next one is the web listing.
    }
  }
}

/**
 * «حدّث التطبيق» — the update that can be put away (founder 2026-11-12: «a popup by مدام روز
 * and الناظر … can be dismissed, for update»).
 *
 * When the server names a newer version on this phone's store (/app-config
 * `latest_app_version`, set at /admin/config after the store publishes it), مدام روز tells the
 * teacher and the assistant, الناظر tells the student and the parent: one button to the store,
 * and «بعدين», which keeps it away for a day. Below the FLOOR the blocking screen speaks
 * instead (AppConfigGate) — this one never stops anybody working.
 */
export function UpdatePromptModal() {
  const { t } = useTranslation();
  const cfg = useAppConfig();
  const role = useAuthStore((s) => s.role);
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  const rose = useRose();
  const touring = useTourStore((s) => s.tour !== null);
  const pathname = usePathname() ?? '';
  const blocked = BLOCKING_PREFIXES.some((p) => pathname.startsWith(p));

  const voice = updatePromptVoice(role);
  const latest = cfg.latest_app_version ?? null;
  const current = binaryVersion();
  const offered = signedIn && voice !== null && updateOffered(current, latest, cfg.min_supported_app_version);

  // `undefined` until the «بعدين» on disk is read: nothing shows before we know.
  const [snooze, setSnooze] = useState<UpdateSnooze | null | undefined>(undefined);
  const [away, setAway] = useState(putAwayThisLaunch);
  useEffect(() => {
    if (!offered) return undefined;
    let live = true;
    AsyncStorage.getItem(UPDATE_PROMPT_STORAGE_KEY)
      .then((raw) => { if (live) setSnooze(parseSnooze(raw)); })
      .catch(() => { if (live) setSnooze(null); });
    return () => { live = false; };
  }, [offered, latest]);

  const later = () => {
    putAwayThisLaunch = true;
    setAway(true);
    if (latest) {
      const next = { version: latest, at: Date.now() };
      setSnooze(next);
      AsyncStorage.setItem(UPDATE_PROMPT_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    }
  };

  const wants = offered && !!latest && snooze !== undefined && !updateSnoozed(snooze, latest, Date.now()) && !away && !touring && !blocked && !impersonating;
  // One popup at a time, a breath after the one before, never over another modal (src/ui/popupSlot.ts).
  const visible = usePopupSlot('app_update', wants);
  if (!offered || !latest || !voice) return null;

  const links = storeLinksFor(Platform.OS, cfg.store, Constants.expoConfig?.android?.package ?? 'com.drosspot.app');
  const speaker = voice === 'rose' ? rose.name : t('nazer.name');

  return (
    <Surface id="app.update_prompt">
      <Modal visible={visible} transparent animationType="fade" onRequestClose={later}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,12,30,0.6)', justifyContent: 'center', padding: spacing.lg }}>
          <View style={{ paddingTop: HEAD / 2 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.lg, paddingTop: HEAD / 2 + spacing.sm, ...shadows.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, textAlign: 'center' }}>{speaker}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 19, lineHeight: 30, color: colors.textPrimary, textAlign: 'center', marginTop: 4 }}>
                {t('update_prompt.title')}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 25, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
                {t(voice === 'rose' ? 'update_prompt.body_rose' : 'update_prompt.body_nazer')}
              </Text>

              {/* From → to, left to right as version numbers read, whatever the page direction. */}
              <View style={{ flexDirection: 'row', direction: 'ltr', alignSelf: 'center', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textTertiary, writingDirection: 'ltr' }}>{current}</Text>
                <Icon name="shapeArrow" size={14} color={colors.textTertiary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand, writingDirection: 'ltr' }}>{latest}</Text>
              </View>

              {links.length > 0 ? (
                <TouchableOpacity onPress={() => { void openFirst(links); }} activeOpacity={0.85} accessibilityRole="button"
                  style={{ marginTop: spacing.lg, minHeight: 52, flexDirection: 'row', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="download" size={18} color={colors.onPrimary} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t(Platform.OS === 'ios' ? 'update.open_app_store' : 'update.open_play_store')}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={later} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary }}>{t('update_prompt.later')}</Text>
              </TouchableOpacity>
            </View>
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
              {voice === 'nazer' ? (
                <NazerFramed size={HEAD + 8} mood="proud" blink={false} />
              ) : (
                <View style={{ width: HEAD, height: HEAD, borderRadius: HEAD / 2, backgroundColor: colors.surface, borderWidth: 4, borderColor: colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...shadows.sm }}>
                  {rose.named ? <RosePortrait size={HEAD - 4} /> : <BrandMark size={40} />}
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </Surface>
  );
}
