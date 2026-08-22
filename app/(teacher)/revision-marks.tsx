import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { getRevisionAttendees, recordRevisionMark, type RevisionAttendee } from '@/api/revisions';
import { usePullRefresh } from '@/hooks/usePullRefresh';

/**
 * §2 — mark-entry sheet for a merged (revision) big exam. Lists the instance's attendees
 * with a mark input each, capped at the exam's max_mark. Reached from the revisions list
 * for a quiz_exam revision.
 */
export default function RevisionMarks() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ revisionId?: string; instanceId?: string; title?: string; maxMark?: string }>();
  const revisionId = Number(params.revisionId);
  const instanceId = Number(params.instanceId);
  const maxMark = params.maxMark ? Number(params.maxMark) : null;

  const q = useQuery({
    queryKey: ['revision-attendees', revisionId, instanceId],
    queryFn: () => getRevisionAttendees(revisionId, instanceId),
    enabled: !!revisionId && !!instanceId,
  });

  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  const save = async (a: RevisionAttendee) => {
    const raw = drafts[a.student_id] ?? (a.mark !== null ? String(a.mark) : '');
    const num = raw.trim() === '' ? null : Number(raw);
    if (num !== null && (isNaN(num) || num < 0 || (maxMark !== null && num > maxMark))) return;
    setSaving(a.student_id);
    try {
      await recordRevisionMark(revisionId, instanceId, a.student_id, num);
      await q.refetch();
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }} numberOfLines={1}>{params.title || t('teacher.exam_marks')}</Text>
          {maxMark != null ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('teacher.exam_out_of')}: {maxMark}</Text> : null}
        </View>
      </View>

      {q.isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <FlatList
          data={q.data?.attendees ?? []}
          keyExtractor={(a) => String(a.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const val = drafts[item.student_id] ?? (item.mark !== null ? String(item.mark) : '');
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{item.student_name}</Text>
                  {item.is_guest ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{t('teacher.guest')}</Text> : null}
                </View>
                <TextInput
                  value={val}
                  onChangeText={(v) => setDrafts((d) => ({ ...d, [item.student_id]: v.replace(/[^0-9.]/g, '') }))}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor={colors.textTertiary}
                  style={{ width: 80, height: 42, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, textAlign: 'center' }}
                />
                <TouchableOpacity onPress={() => save(item)} disabled={saving === item.student_id} style={{ width: 44, height: 42, borderRadius: radius.md, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center' }}>
                  {saving === item.student_id ? <ActivityIndicator color="#fff" /> : <Icon name="success" size={20} color="#fff" />}
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={<EmptyState icon="children" title={t('teacher.exam_no_attendees')} message="" />}
        />
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
