import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Alert } from '@/ui/dialog';
import { ScrollView } from '@/components/ui/Refreshable';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { useChildren } from '@/hooks/useChildren';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import client from '@/api/client';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { DistinguishedBadge } from '@/components/DistinguishedBadge';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { PageHero } from '@/components/ui/PageHero';
import { formatTime12 } from '@/components/ui/TimePicker';
import { formatNumber } from '@/utils/format';
import type { Child } from '@/api/children';

type ChildTeacher = Child['teachers'][number];
/** One teacher, and every child of this family who studies with them. */
type TeacherCard = { teacher: ChildTeacher; children: { child: Child; entry: ChildTeacher }[] };

/**
 * «المعلّمون» — the family's teachers (founder 2026-10-06: «some love on the parent's teachers
 * tab»). Teacher-first: one card per teacher with their logo and badge, and for each child who
 * studies with them, the courses and weekly slot and how the child attends there. Writing to
 * the teacher is one tap (a ticket, prefilled); removing a teacher is there, but quiet.
 */
export default function ParentTeachers() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: children, isLoading, refetch } = useChildren();
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const queryClient = useQueryClient();
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const removeMutation = useMutation({
    mutationFn: async ({ studentId, teacherId }: { studentId: number; teacherId: number }) => {
      const { data } = await client.post('/parents/remove-teacher', { student_id: studentId, teacher_id: teacherId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      setRemovingKey(null);
    },
    onError: (error) => {
      setRemovingKey(null);
      Alert.alert(t('common.error'), getFriendlyErrorMessage(error));
    },
  });

  const confirmRemove = (child: Child, teacher: ChildTeacher) => {
    Alert.alert(
      t('parent.confirm_remove_title'),
      t('parent.confirm_remove_desc', { name: teacher.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('parent.remove'),
          style: 'destructive',
          onPress: () => {
            setRemovingKey(`${child.id}:${teacher.id}`);
            removeMutation.mutate({ studentId: Number(child.student_id), teacherId: Number(teacher.id) });
          },
        },
      ],
    );
  };

  const list = children ?? [];
  const cards = useMemo<TeacherCard[]>(() => {
    const byId = new Map<string, TeacherCard>();
    for (const child of list) {
      for (const entry of child.teachers ?? []) {
        const card = byId.get(entry.id) ?? { teacher: entry, children: [] };
        card.children.push({ child, entry });
        byId.set(entry.id, card);
      }
    }
    return [...byId.values()];
  }, [list]);
  const courseCount = cards.reduce((n, c) => n + c.children.reduce((m, x) => m + (x.entry.courses?.length ?? 0), 0), 0);
  const many = list.length > 1;

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg, backgroundColor: colors.background, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <PageHero
          title={t('parent.teachers')}
          subtitle={many ? 'معلّمو أبنائك، وما يدرسه كلٌّ منهم معهم' : 'معلّمو ابنك، وما يدرسه معهم'}
          action={{ icon: 'ticket', label: t('parent.tickets_chip'), accessibilityLabel: t('parent.teacher_tickets_title'), onPress: () => router.push('/(parent)/tickets') }}
          stats={cards.length ? [
            { value: formatNumber(cards.length), label: 'معلّم' },
            { value: formatNumber(courseCount), label: 'مقرر' },
            ...(many ? [{ value: formatNumber(list.length), label: 'أبناء' }] : []),
          ] : undefined}
        />

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl4 }} />
        ) : !list.length ? (
          <EmptyState icon="children" title={t('parent.no_children')} />
        ) : !cards.length ? (
          <EmptyState icon="teacher" title={t('parent.no_teachers')} />
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4, gap: spacing.lg }}>
            {cards.map((card) => (
              <TeacherCardView key={card.teacher.id} card={card} showChildName={many} removingKey={removingKey}
                onTicket={(child) => router.push({ pathname: '/(parent)/tickets/create', params: { child: child.id, teacher: card.teacher.id } } as unknown as Href)}
                onRemove={confirmRemove} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TeacherCardView({ card, showChildName, removingKey, onTicket, onRemove }: {
  card: TeacherCard; showChildName: boolean; removingKey: string | null;
  onTicket: (child: Child) => void; onRemove: (child: Child, teacher: ChildTeacher) => void;
}) {
  const { t } = useTranslation();
  const { teacher } = card;
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadows.sm }}>
      {/* Who: the teacher's own logo when they set one, their name, the distinguished badge. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg }}>
        {teacher.logo_url ? (
          <Image source={{ uri: teacher.logo_url }} style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.surfaceSunken }} contentFit="cover" accessibilityLabel={teacher.name} />
        ) : (
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.brand }}>{(teacher.name ?? '؟').trim().charAt(0)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }} numberOfLines={2}>{teacher.name}</Text>
          {teacher.is_distinguished_member ? <View style={{ marginTop: 4, alignSelf: 'flex-start' }}><DistinguishedBadge size="sm" /></View> : null}
        </View>
      </View>

      {/* For each child who studies with them: the courses, when, and how they attend. */}
      {card.children.map(({ child, entry }) => {
        const att = entry.attendance;
        const rate = att && att.held > 0 ? att.attended / att.held : null;
        const tone = rate == null ? colors.textTertiary : rate >= 0.9 ? colors.success : rate >= 0.75 ? colors.brand : colors.warning;
        const removing = removingKey === `${child.id}:${teacher.id}`;
        return (
          <View key={child.id} style={{ borderTopWidth: 1, borderTopColor: colors.borderLight, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm, opacity: removing ? 0.5 : 1 }}>
            {showChildName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="child" size={15} color={colors.textSecondary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textSecondary }}>{child.name}</Text>
              </View>
            ) : null}

            {(entry.courses ?? []).length > 0 ? (entry.courses ?? []).map((c, i) => (
              <View key={`${c.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="book" size={15} color={colors.brand} outline />
                </View>
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{c.name ?? '—'}</Text>
                {c.day ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Icon name="clock" size={12} color={colors.textSecondary} />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{[c.day, formatTime12(c.time)].filter(Boolean).join(' · ')}</Text>
                  </View>
                ) : null}
              </View>
            )) : null}

            {att && att.held > 0 ? (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{`حضر ${formatNumber(att.attended)} من ${formatNumber(att.held)} حصة`}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: tone }}>{`${formatNumber(Math.round((rate ?? 0) * 100))}٪`}</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceSunken, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.round((rate ?? 0) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: tone }} />
                </View>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
              <TouchableOpacity onPress={() => onTicket(child)} activeOpacity={0.85} accessibilityRole="button"
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42, borderRadius: radius.lg, backgroundColor: colors.brand }}>
                <Icon name="ticket" size={16} color={colors.onPrimary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.onPrimary }}>تواصل مع المعلّم</Text>
              </TouchableOpacity>
              {removing ? (
                <ActivityIndicator size="small" color={colors.danger} style={{ paddingHorizontal: spacing.md }} />
              ) : (
                <TouchableOpacity onPress={() => onRemove(child, teacher)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${t('parent.remove')} ${teacher.name}`}
                  style={{ minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.dangerText }}>{t('parent.remove')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
