import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { foldForSearch } from '@/utils/format';

const SEARCH_FROM = 6;

/**
 * Narrow a teacher's groups by grade (chips, when there is more than one) and by name (a
 * search field, once there are more than a handful). Used where a group is chosen to add
 * students: fast register and the invitation link.
 */
export function useGroupFilter<T>(items: T[], name: (x: T) => string, grade: (x: T) => string | null | undefined) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const grades = useMemo(() => {
    const seen = new Set<string>();
    for (const x of items) { const g = grade(x); if (g) seen.add(g); }
    return [...seen];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  const filtered = useMemo(() => {
    const q = foldForSearch(query.trim());
    return items.filter((x) => (!chosen || grade(x) === chosen) && (!q || foldForSearch(name(x)).includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, chosen, query]);
  return { grades, grade: chosen, setGrade: setChosen, query, setQuery, filtered, searchable: items.length > SEARCH_FROM };
}

export function GroupFilter({ grades, grade, onGrade, query, onQuery, searchable }: {
  grades: string[];
  grade: string | null;
  onGrade: (g: string | null) => void;
  query: string;
  onQuery: (q: string) => void;
  searchable: boolean;
}) {
  const { t } = useTranslation();
  if (grades.length < 2 && !searchable) return null;
  return (
    <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
      {searchable ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingHorizontal: spacing.md }}>
          <Icon name="search" size={17} color={colors.textTertiary} />
          <TextInput value={query} onChangeText={onQuery} placeholder={t('group_filter.search')} placeholderTextColor={colors.textTertiary}
            style={{ flex: 1, height: 42, marginStart: spacing.sm, fontFamily: fonts.regular, fontSize: 14.5, color: colors.textPrimary, textAlign: 'right' }} />
          {query ? <TouchableOpacity onPress={() => onQuery('')} hitSlop={8} accessibilityLabel={t('common.close')}><Icon name="close" size={15} color={colors.textTertiary} /></TouchableOpacity> : null}
        </View>
      ) : null}
      {grades.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[null, ...grades].map((g) => {
            const on = grade === g;
            return (
              <TouchableOpacity key={g ?? 'all'} onPress={() => onGrade(g)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={{ paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brand : colors.surface }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: on ? colors.onPrimary : colors.textSecondary }}>{g ?? t('group_filter.all')}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
