import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { usePauseSessions } from '@/hooks/useTeacherSessionHistory';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Pause a date RANGE — bulk-cancels every not-yet-completed session between two
 * dates (inclusive), scoped to the teacher's courses. Parity with the web
 * sessions "إيقاف فترة". Dates are YYYY-MM-DD with quick presets; no extra dep.
 */
export default function PausePeriodScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pause = usePauseSessions();

  const [from, setFrom] = useState(iso(new Date()));
  const [to, setTo] = useState(iso(new Date()));

  const fromValid = DATE_RE.test(from) && !Number.isNaN(Date.parse(from));
  const toValid = DATE_RE.test(to) && !Number.isNaN(Date.parse(to));
  const orderValid = !fromValid || !toValid || to >= from;
  const canSubmit = fromValid && toValid && orderValid && !pause.isPending;

  const preset = (days: number) => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);
    setFrom(iso(start));
    setTo(iso(end));
  };

  const submit = () => {
    if (!canSubmit) return;
    Alert.alert(t('teacher.pause_confirm_title'), t('teacher.pause_confirm_hint', { from, to }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('teacher.pause_period'),
        style: 'destructive',
        onPress: () =>
          pause.mutate(
            { from, to },
            {
              onSuccess: (res) =>
                Alert.alert(t('teacher.pause_period'), t('teacher.pause_done', { count: res.cancelled }), [
                  { text: t('common.ok'), onPress: () => router.back() },
                ]),
              onError: () => Alert.alert(t('common.error'), t('teacher.pause_failed')),
            },
          ),
      },
    ]);
  };

  const field = (label: string, value: string, onChange: (v: string) => void, valid: boolean) => (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: valid ? colors.border : colors.danger, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 50, fontFamily: fonts.medium, fontSize: 16, color: colors.textPrimary, textAlign: 'center', letterSpacing: 1 }}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.pause_period')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.warningLight, borderRadius: radius.lg, padding: spacing.md }}>
          <Icon name="warning" size={18} color={colors.warning} />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('teacher.pause_intro')}</Text>
        </View>

        {/* Presets */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg }}>
          <Preset label={t('teacher.preset_today')} onPress={() => preset(0)} />
          <Preset label={t('teacher.preset_week')} onPress={() => preset(6)} />
          <Preset label={t('teacher.preset_two_weeks')} onPress={() => preset(13)} />
        </View>

        {field(t('teacher.pause_from'), from, setFrom, fromValid)}
        {field(t('teacher.pause_to'), to, setTo, toValid || !toValid)}
        {!orderValid ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: spacing.sm }}>{t('teacher.pause_order_error')}</Text>
        ) : null}

        <View style={{ marginTop: spacing.xl }}>
          <Button title={t('teacher.pause_period')} onPress={submit} loading={pause.isPending} disabled={!canSubmit} variant="destructive" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Preset({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: spacing.lg, height: 40, justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  );
}
