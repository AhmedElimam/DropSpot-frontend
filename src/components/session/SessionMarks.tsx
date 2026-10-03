import { memo, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/layout/Avatar';
import { avatarSeed } from '@/components/ui/GeneratedAvatar';
import { formatNumber } from '@/utils/format';

export type SessionKind = 'normal_sheet' | 'quiz_exam';

/** «ورقة» vs «امتحان كبير» — what the marks of this session are. Applies to the whole session. */
export function SessionKindToggle({ value, busy, onChange, compact = false }: {
  value: SessionKind; busy?: boolean; onChange: (v: SessionKind) => void; compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: 3 }}>
        {(['normal_sheet', 'quiz_exam'] as const).map((k) => {
          const on = value === k;
          const tint = k === 'quiz_exam' ? colors.accent : colors.brand;
          return (
            <TouchableOpacity key={k} disabled={busy || on} onPress={() => onChange(k)} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={{ flex: 1, height: compact ? 34 : 38, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: on ? tint : 'transparent' }}>
              <Icon name={k === 'quiz_exam' ? 'trophy' : 'quiz'} size={15} color={on ? (k === 'quiz_exam' ? colors.onAccent : '#fff') : colors.textSecondary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? (k === 'quiz_exam' ? colors.onAccent : '#fff') : colors.textSecondary }}>
                {t(k === 'quiz_exam' ? 'teacher.type_quiz_exam' : 'teacher.type_normal_sheet')}
              </Text>
              {busy && !on ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: colors.textTertiary, marginTop: 4 }}>
        {t(value === 'quiz_exam' ? 'marks_ui.kind_exam_hint' : 'marks_ui.kind_sheet_hint')}
      </Text>
    </View>
  );
}

/** Arabic-Indic digits and the Arabic decimal mark → a number string the server takes. */
export function toLatinNumber(raw: string): string {
  return raw.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace('٫', '.').replace(',', '.');
}

type RowStudent = { student_id: number; name: string | null; status: string; mark: number | null };

/**
 * One row of the «الدرجات» tab: the student and a number field. Saves on «تم» / leaving the
 * field, only when the value changed. Only a student who attended can carry a mark (the
 * server needs their attendance record), so the others show why the field is closed.
 */
export const MarkRow = memo(function MarkRow({ a, max, onSave }: {
  a: RowStudent; max: number | null; onSave: (studentId: number, mark: number | null) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(a.mark != null ? String(a.mark) : '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'invalid' | 'error'>('idle');
  useEffect(() => { setDraft(a.mark != null ? String(a.mark) : ''); }, [a.mark]);
  const attended = a.status === 'present' || a.status === 'late';

  const commit = async () => {
    const raw = toLatinNumber(draft);
    const value = raw === '' ? null : Number(raw);
    if (value === a.mark || (value === null && a.mark === null)) return;
    if (value !== null && (Number.isNaN(value) || value < 0 || (max != null && value > max))) { setState('invalid'); return; }
    setState('saving');
    try { await onSave(a.student_id, value); setState('saved'); } catch { setState('error'); }
  };

  const border = state === 'error' || state === 'invalid' ? colors.danger : state === 'saved' ? colors.success : colors.border;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStartWidth: 4, borderStartColor: a.mark != null ? colors.success : attended ? colors.accent : colors.borderStrong, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm, minHeight: 62, opacity: attended ? 1 : 0.6 }}>
      <Avatar name={a.name ?? '—'} seed={avatarSeed.student(a.student_id, a.name ?? '—')} size={38} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{a.name ?? '—'}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: state === 'error' || state === 'invalid' ? colors.danger : colors.textTertiary, marginTop: 1 }} numberOfLines={1}>
          {state === 'invalid' ? (max != null ? t('marks_ui.bad_mark', { max: formatNumber(max) }) : t('quick_record.bad_mark'))
            : state === 'error' ? t('teacher.grade_failed')
            : !attended ? t('marks_ui.needs_attendance')
            : state === 'saved' ? t('marks_ui.saved') : a.mark != null ? t('marks_ui.recorded') : t('marks_ui.not_yet')}
        </Text>
      </View>
      {attended ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TextInput
            value={draft}
            onChangeText={(v) => { setDraft(v); if (state !== 'idle') setState('idle'); }}
            onEndEditing={commit}
            onSubmitEditing={commit}
            keyboardType="decimal-pad"
            returnKeyType="done"
            placeholder="—"
            placeholderTextColor={colors.textTertiary}
            selectTextOnFocus
            style={{ width: 64, height: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: border, backgroundColor: colors.surfaceSunken, textAlign: 'center', fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, paddingVertical: 0 }}
          />
          <View style={{ width: 34, alignItems: 'center' }}>
            {state === 'saving' ? <ActivityIndicator size="small" color={colors.brand} />
              : state === 'saved' ? <Icon name="success" size={20} color={colors.success} />
              : max != null ? <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary }}>{`/${formatNumber(max)}`}</Text> : null}
          </View>
        </View>
      ) : (
        <Icon name="lock" size={18} color={colors.textTertiary} />
      )}
    </View>
  );
});

/** Top of the «الدرجات» tab: what the marks are, out of how much, and how far along. */
export function MarksHeader({ kind, kindBusy, onKind, max, onMax, done, of }: {
  kind: SessionKind; kindBusy?: boolean; onKind: (k: SessionKind) => void;
  max: number | null; onMax: (v: number | null) => void; done: number; of: number;
}) {
  const { t } = useTranslation();
  const [maxDraft, setMaxDraft] = useState(max != null ? String(max) : '');
  useEffect(() => { setMaxDraft(max != null ? String(max) : ''); }, [max]);
  const saveMax = () => {
    const raw = toLatinNumber(maxDraft);
    const v = raw === '' ? null : Number(raw);
    if (v === max || (v !== null && (Number.isNaN(v) || v < 1))) return;
    onMax(v);
  };
  const pct = of > 0 ? Math.round((done / of) * 100) : 0;
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md }}>
      <SessionKindToggle value={kind} busy={kindBusy} onChange={onKind} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{t('marks_ui.progress', { n: formatNumber(done), of: formatNumber(of) })}</Text>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceSunken, marginTop: 6, overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: 6, backgroundColor: colors.success }} />
          </View>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary, marginBottom: 2 }}>{t('marks_ui.max')}</Text>
          <TextInput value={maxDraft} onChangeText={setMaxDraft} onEndEditing={saveMax} onSubmitEditing={saveMax} keyboardType="decimal-pad" returnKeyType="done"
            placeholder="—" placeholderTextColor={colors.textTertiary}
            style={{ width: 64, height: 38, borderRadius: radius.md, backgroundColor: colors.surfaceSunken, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, paddingVertical: 0 }} />
        </View>
      </View>
    </View>
  );
}
