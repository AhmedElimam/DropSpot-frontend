import { memo } from 'react';
import { View, Text, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useSetChildParticipation, useThreadChildren } from '@/hooks/useThreads';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { haptic } from '@/utils/haptics';
import type { ThreadChildSetting, ThreadParticipation } from '@/api/threads';
import { Sheet } from './ThreadSheets';
import { Segments } from './Segments';
import { InitialsAvatar } from './Avatar';
import { ago } from './format';
import { PARTICIPATION_COPY, PARTICIPATION_ORDER } from './parents';

const ICONS: Record<ThreadParticipation, IconName> = { on: 'note', read_only: 'eye', off: 'lock' };

/**
 * «حكاوي لأولادي» — a parent's say over each child's part in حكاوي (founder 2026-10-15:
 * «parent consent and moderation over their children»). One card per child: who, which grade,
 * which teachers, and a three-way control — مشاركة / قراءة بس / مقفولة — with one line that
 * says exactly what that means. A change moves under the finger and goes back on a refusal.
 */
export function ChildrenConsentSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useThreadChildren(visible);
  const set = useSetChildParticipation();

  const change = (row: ThreadChildSetting, participation: ThreadParticipation) => {
    if (row.participation === participation) return;
    haptic('tick');
    set.mutate({ studentId: row.student_id, participation }, {
      onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
    });
  };

  return (
    <Sheet visible={visible} title={t('threads.consent_title')} icon="shield" onClose={onClose}>
      {/* Why: the parent sees everything, and can stop it any time. */}
      <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandTint }}>
        <Icon name="eye" size={20} color={colors.brand} outline style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 22, color: colors.textPrimary }}>{t('threads.consent_header')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }}>{t('threads.consent_why')}</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
      ) : isError ? (
        <TouchableOpacity onPress={() => refetch()} activeOpacity={0.8} style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg }}>
          <Icon name="refresh" size={22} color={colors.textSecondary} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('common.retry')}</Text>
        </TouchableOpacity>
      ) : !data?.length ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg }}>{t('threads.consent_empty')}</Text>
      ) : (
        data.map((row) => <ChildRow key={row.student_id} row={row} onChange={change} />)
      )}

      {data?.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <Icon name="bell" size={13} color={colors.textTertiary} outline />
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('threads.consent_told')}</Text>
        </View>
      ) : null}
    </Sheet>
  );
}

const ChildRow = memo(function ChildRow({ row, onChange }: { row: ThreadChildSetting; onChange: (row: ThreadChildSetting, p: ThreadParticipation) => void }) {
  const { t } = useTranslation();
  const teachers = row.teachers.map((x) => x.name).filter(Boolean).join('، ');
  const tone = row.participation === 'off' ? colors.danger : row.participation === 'read_only' ? colors.warning : colors.success;
  return (
    <View style={{ padding: spacing.md, gap: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <InitialsAvatar id={row.student_id} name={row.name} size={44} ring={tone} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }} numberOfLines={1}>{row.name}</Text>
          {row.grade ? <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>{row.grade}</Text> : null}
          {teachers ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }} numberOfLines={2}>{t('threads.consent_teachers', { names: teachers })}</Text> : null}
        </View>
      </View>
      <Segments
        value={row.participation}
        onChange={(p) => onChange(row, p)}
        items={PARTICIPATION_ORDER.map((p) => ({ key: p, label: PARTICIPATION_COPY[p].label, icon: ICONS[p], badge: 0 }))}
      />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone, marginTop: 6 }} />
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
          {PARTICIPATION_COPY[row.participation]?.line ?? PARTICIPATION_COPY.on.line}
        </Text>
      </View>
      {row.changed_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>{t('threads.consent_changed', { when: ago(row.changed_at) })}</Text> : null}
    </View>
  );
});
