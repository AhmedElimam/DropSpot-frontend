import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal as Modal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, isDark } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { LiveMap, type MapPoint, MAP_BG } from '@/components/LiveMap';
import type { Destination } from '@/api/print';

export type PickedPlace = { lat: number; lng: number; name: string | null; address: string; details: string };

/**
 * «حدد مكان التوصيل» — Talabat's picker (founder 2026-10-14): the map fills the screen, a pin
 * stays in the middle, the teacher moves the map under it (or taps one of their venues, or
 * «موقعي»), the street name reads back live, and a line of details («الدور التالت، جنب
 * الصيدلية») goes with it to the driver.
 */
export function PlacePicker({ visible, onClose, onPick, mapsKey, venues, initial }: {
  visible: boolean; onClose: () => void; onPick: (p: PickedPlace) => void;
  mapsKey?: string | null; venues: Destination[]; initial?: PickedPlace | null;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [at, setAt] = useState<MapPoint | null>(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [address, setAddress] = useState<string | null>(initial?.address ?? null);
  const [looking, setLooking] = useState(false);
  const [name, setName] = useState<string | null>(initial?.name ?? null);
  const [details, setDetails] = useState(initial?.details ?? '');
  const [jump, setJump] = useState<(MapPoint & { nonce: number }) | null>(null);

  const goVenue = (v: Destination) => { setName(v.name); setJump({ lat: v.lat, lng: v.lng, nonce: Date.now() }); if (v.address) setDetails((d) => d || v.address || ''); };
  const confirm = () => {
    if (!at) return;
    onPick({ lat: at.lat, lng: at.lng, name, address: address || t('print.picked_point'), details: details.trim() });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: isDark() ? MAP_BG.dark : MAP_BG.light }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <LiveMap picker mapsKey={mapsKey} rounded={false} height="100%" style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0 }}
          start={initial ? { lat: initial.lat, lng: initial.lng } : venues[0] ? { lat: venues[0].lat, lng: venues[0].lng } : null}
          centerTo={jump} controlsBottom={370}
          onMoving={() => { setLooking(true); setName(null); }}
          onCenter={(p) => setAt(p)}
          onAddress={(p) => { setLooking(false); setAddress(p.text); }} />

        {/* only a close button over the map (founder 2026-10-14: no banner on maps) */}
        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.back')}
          style={{ position: 'absolute', top: insets.top + 8, start: spacing.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadows.md }}>
          <Icon name="close" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: insets.bottom + spacing.md, ...shadows.lg }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, marginBottom: spacing.sm }}>{t('print.pick_title')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="location" size={20} color={colors.accentText} />
            </View>
            <View style={{ flex: 1, minHeight: 40, justifyContent: 'center' }}>
              {name ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.accentText }}>{name}</Text> : null}
              {looking ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><ActivityIndicator size="small" color={colors.primary} /><Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{t('print.pick_reading')}</Text></View>
              ) : (
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary, lineHeight: 21 }} numberOfLines={2}>{address || (at ? t('print.picked_point') : t('print.pick_move'))}</Text>
              )}
            </View>
          </View>

          {venues.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: spacing.sm }}>
              {venues.map((v) => (
                <TouchableOpacity key={v.id} onPress={() => goVenue(v)} accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: name === v.name ? colors.brand : colors.surface, borderWidth: 1, borderColor: name === v.name ? colors.brand : colors.border }}>
                  <Icon name="book" size={14} color={name === v.name ? colors.onPrimary : colors.textSecondary} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: name === v.name ? colors.onPrimary : colors.textSecondary }}>{v.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : <View style={{ height: spacing.sm }} />}

          <Input value={details} onChangeText={setDetails} placeholder={t('print.pick_details_ph')} maxLength={200} />
          <View style={{ marginTop: spacing.md }}><Button title={t('print.pick_confirm')} onPress={confirm} disabled={!at || looking} /></View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
