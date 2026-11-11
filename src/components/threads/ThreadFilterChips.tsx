import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { arDigits, type ThreadFilter } from './format';

/**
 * The feed's filter chips: everything, open, waiting for the teacher, answered — and تكات once
 * there is one. Five chips at most, each written out: a fixed row that scrolls sideways on a
 * narrow phone, not a list of server rows (the posts are the windowed list in ThreadsFeed.tsx).
 * It bleeds to the screen's edges through the feed's side gutter (`bleed`).
 */
export function ThreadFilterChips({ value, onChange, counts, staff, bleed }: {
  value: ThreadFilter;
  onChange: (f: ThreadFilter) => void;
  counts: Record<ThreadFilter, number>;
  /** Teacher / assistant: «waiting for you», not «waiting for the teacher». */
  staff: boolean;
  bleed: number;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -bleed, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: bleed, gap: spacing.sm, paddingVertical: 2 }}
    >
      <FilterChip id="all" label={t('threads.filter_all')} icon="threads" count={counts.all} value={value} onChange={onChange} />
      <FilterChip id="open" label={t('threads.filter_open')} icon="timer" count={counts.open} value={value} onChange={onChange} />
      <FilterChip id="waiting" label={staff ? t('threads.filter_waiting_teacher') : t('threads.filter_waiting')} icon="hourglass" count={counts.waiting} value={value} onChange={onChange} />
      <FilterChip id="answered" label={t('threads.filter_answered')} icon="success" count={counts.answered} value={value} onChange={onChange} />
      {counts.notes > 0 ? <FilterChip id="notes" label={t('threads.filter_notes')} icon="lightbulb" count={counts.notes} value={value} onChange={onChange} /> : null}
    </ScrollView>
  );
}

function FilterChip({ id, label, icon, count, value, onChange }: { id: ThreadFilter; label: string; icon: IconName; count: number; value: ThreadFilter; onChange: (f: ThreadFilter) => void }) {
  const active = value === id;
  return (
    <TouchableOpacity
      onPress={() => { if (!active) onChange(id); }}
      activeOpacity={0.8}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: spacing.md, borderRadius: radius.full,
        backgroundColor: active ? colors.brand : colors.surface, borderWidth: 1, borderColor: active ? colors.brand : colors.border,
      }}
    >
      <Icon name={icon} size={14} color={active ? colors.onPrimary : colors.textTertiary} outline={!active} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? colors.onPrimary : colors.textSecondary }}>{label}</Text>
      {count > 0 ? (
        <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? 'rgba(255,255,255,0.22)' : colors.surfaceSunken }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: active ? colors.onPrimary : colors.textTertiary }}>{arDigits(count)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
