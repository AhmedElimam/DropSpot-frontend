import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { formatNumber } from '@/utils/format';
import type { ChatChannelSummary } from '@/api/chat';
import { hasBothAudiences, inboxCounts, type InboxFilter } from '@/chat/inbox';

/**
 * The filter chips: all, unread, and — for someone with both kinds of room — the class and the
 * parents. A parent's own room leads for a parent («أولياء الأمور» then «أبنائي»); the class
 * leads for a teacher. Shared by the conversations page and the in-room switcher.
 *
 * Four chips at most, each written out: a fixed row that scrolls sideways on a narrow phone,
 * not a list of server rows (the rooms themselves are the windowed list in ChatInbox.tsx).
 */
export function InboxChips({ list, value, onChange }: { list: ChatChannelSummary[]; value: InboxFilter; onChange: (f: InboxFilter) => void }) {
  const { t } = useTranslation();
  const counts = inboxCounts(list);
  const both = hasBothAudiences(list);
  const parentView = list.some((c) => c.read_only);
  const students = <Chip id="students" label={parentView ? t('chat.filter_children') : t('chat.filter_students')} n={counts.students} value={value} onChange={onChange} />;
  const parents = <Chip id="parents" label={t('chat.filter_parents')} n={counts.parents} value={value} onChange={onChange} />;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 2 }}>
      <Chip id="all" label={t('chat.filter_all')} n={counts.all} value={value} onChange={onChange} />
      <Chip id="unread" label={t('chat.filter_unread')} n={counts.unread} value={value} onChange={onChange} />
      {both ? (parentView ? parents : students) : null}
      {both ? (parentView ? students : parents) : null}
    </ScrollView>
  );
}

function Chip({ id, label, n, value, onChange }: { id: InboxFilter; label: string; n: number; value: InboxFilter; onChange: (f: InboxFilter) => void }) {
  const on = value === id;
  return (
    <TouchableOpacity onPress={() => onChange(id)} activeOpacity={0.8}
      accessibilityRole="tab" accessibilityState={{ selected: on }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.border, ...shadows.sm }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: on ? colors.onPrimary : colors.textSecondary }}>{label}</Text>
      {n > 0 ? (
        <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.22)' : id === 'unread' ? colors.success : colors.surfaceSunken }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: on || id === 'unread' ? colors.onPrimary : colors.textTertiary }}>{formatNumber(n)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
