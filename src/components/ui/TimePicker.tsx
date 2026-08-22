import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius } from '@/theme/index';
import { fonts } from '@/theme/typography';
import { Icon } from '@/components/ui/Icon';

/**
 * App-wide time picker (replaces free-text HH:mm inputs). Presents a 12-hour wheel
 * (hour · minute · ص/م) so a time is ALWAYS valid — no keyboard, no regex failures —
 * and displays it in 12-hour Arabic. The VALUE it emits stays 24-hour "HH:mm" so the
 * backend contract (date_format:H:i) is unchanged. Minutes step by 5 (class times);
 * an existing odd minute is preserved as a selectable option.
 */

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,…,55
const arNum = (n: number) => n.toLocaleString('ar-EG');
const pad = (n: number) => String(n).padStart(2, '0');
const VALID = /^\d{1,2}:\d{2}$/;

function to24(h12: number, min: number, pm: boolean): string {
  let h = h12 % 12;
  if (pm) h += 12;
  return `${pad(h)}:${pad(min)}`;
}

function parse(value?: string | null): { h12: number; min: number; pm: boolean } {
  if (value && VALID.test(value)) {
    const [H, M] = value.split(':').map(Number);
    return { h12: H % 12 === 0 ? 12 : H % 12, min: M, pm: H >= 12 };
  }
  return { h12: 4, min: 0, pm: true }; // sensible default: 4:00 م (typical class time)
}

/** "HH:mm" (24h) → localized 12-hour Arabic, e.g. "٤:٣٠ م". Empty when unset/invalid. */
export function formatTime12(value?: string | null): string {
  if (!value || !VALID.test(value)) return '';
  const [H, M] = value.split(':').map(Number);
  return new Date(2000, 0, 1, H, M).toLocaleTimeString('ar-EG', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

interface Props {
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Paints the field border red (caller-driven validation). */
  invalid?: boolean;
}

export function TimePicker({ value, onChange, placeholder, invalid }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [h12, setH] = useState(4);
  const [min, setMin] = useState(0);
  const [pm, setPm] = useState(true);

  const display = formatTime12(value);
  const minutes = MINUTES.includes(min) ? MINUTES : [...MINUTES, min].sort((a, b) => a - b);

  const openPicker = () => {
    const p = parse(value);
    setH(p.h12); setMin(p.min); setPm(p.pm);
    setOpen(true);
  };
  const confirm = () => { onChange(to24(h12, min, pm)); setOpen(false); };

  const chip = (active: boolean) => ({
    paddingHorizontal: spacing.md, minWidth: 52, minHeight: 44, justifyContent: 'center' as const, alignItems: 'center' as const,
    borderRadius: radius.md, borderWidth: 1,
    borderColor: active ? colors.brand : colors.border,
    backgroundColor: active ? colors.brand : colors.surface,
  });
  const chipTxt = (active: boolean) => ({ fontFamily: fonts.bold, fontSize: 16, color: active ? '#fff' : colors.textSecondary });

  return (
    <>
      <TouchableOpacity
        onPress={openPicker}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          minHeight: 52, backgroundColor: colors.surface, borderWidth: 1,
          borderColor: invalid ? colors.danger : colors.borderStrong,
          borderRadius: radius.lg, paddingHorizontal: spacing.lg,
        }}
      >
        <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: display ? colors.textPrimary : colors.textTertiary }}>
          {display || placeholder || t('time_picker.placeholder')}
        </Text>
        <Icon name="clock" size={20} color={colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.lg }}>
              {t('time_picker.title')}
            </Text>

            {/* Hour */}
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('time_picker.hour')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
              {HOURS.map((hh) => (
                <TouchableOpacity key={hh} onPress={() => setH(hh)} style={chip(hh === h12)}>
                  <Text style={chipTxt(hh === h12)}>{arNum(hh)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Minute */}
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm }}>{t('time_picker.minute')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
              {minutes.map((mm) => (
                <TouchableOpacity key={mm} onPress={() => setMin(mm)} style={chip(mm === min)}>
                  <Text style={chipTxt(mm === min)}>{mm.toLocaleString('ar-EG', { minimumIntegerDigits: 2 })}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* AM / PM */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <TouchableOpacity onPress={() => setPm(false)} style={[chip(!pm), { flex: 1 }]}>
                <Text style={chipTxt(!pm)}>{t('time_picker.am')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPm(true)} style={[chip(pm), { flex: 1 }]}>
                <Text style={chipTxt(pm)}>{t('time_picker.pm')}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
              <TouchableOpacity onPress={() => setOpen(false)} style={{ flex: 1, minHeight: 52, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textSecondary }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirm} style={{ flex: 1, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
