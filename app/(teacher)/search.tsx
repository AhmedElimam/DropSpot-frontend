import { track } from '@/lib/analytics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { router, useNavigation, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { AddStudentSheet } from '@/components/teacher/AddStudentSheet';
import { ScheduleToolsSheet } from '@/components/teacher/ScheduleToolsSheet';
import { FEATURES, type FeatureEntry } from '@/search/featureIndex';
import { buildSearch, type Indexed } from '@/search/featureSearch';

/** What shows before anything is typed: the places people reach for most. */
const SUGGESTED = ['collect', 'who_paid', 'add_student', 'sessions', 'rose', 'expenses', 'students', 'assistant_actions'];

/**
 * «ابحث في التطبيق» (founder 2026-10-10: «a smart search … any feature or any keywords
 * related to that feature»). Fuzzy over every teacher feature (src/search/featureIndex.ts)
 * by title, everyday words and description, Arabic spelling folded; only what this person
 * can use is in the index. A result opens the screen, or the sheet it lives in.
 */
export default function SearchScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isAssistant, can } = useActiveAbilities();
  const { data: flags } = useFeatureFlags();
  const [q, setQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // The sheets mount the first time they are asked for, never during the screen's arrival.
  const [sheetsMounted, setSheetsMounted] = useState({ add: false, schedule: false });
  const inputRef = useRef<TextInput>(null);
  const navigation = useNavigation();

  // Focus once the fade has ended — raising the keyboard mid-transition is what stuttered.
  useEffect(() => {
    let done = false;
    const focus = () => { if (!done) { done = true; inputRef.current?.focus(); } };
    const unsub = navigation.addListener('transitionEnd' as never, focus);
    const fallback = setTimeout(focus, 350); // a platform that skips the event
    return () => { unsub(); clearTimeout(fallback); };
  }, [navigation]);

  const visible = useMemo(
    () => FEATURES.filter((f) => !f.show || f.show({ isAssistant, can, flags: flags as Record<string, unknown> | undefined })),
    [isAssistant, can, flags],
  );
  const typing = q.trim().length >= 2;
  // The index is built on the first keystroke, not while the screen arrives.
  const search = useMemo(() => (typing ? buildSearch(visible, t) : null), [typing, visible, t]);
  const results: Indexed[] = useMemo(() => {
    if (typing && search) return search(q);
    return SUGGESTED.map((id) => visible.find((f) => f.id === id)).filter(Boolean).map((e) => ({
      entry: e as FeatureEntry, title: t((e as FeatureEntry).titleKey), sub: (e as FeatureEntry).subKey ? t((e as FeatureEntry).subKey!) : '', n_title: '', n_sub: '', n_keywords: [],
    }));
  }, [q, typing, search, visible, t]);

  const open = (e: FeatureEntry) => {
    track('feature_search_open', { feature: e.id, typed: q.trim().length >= 2, position: Math.max(0, results.findIndex((r) => r.entry.id === e.id)) });
    if (e.action === 'add_student') { setSheetsMounted((m) => ({ ...m, add: true })); return setAddOpen(true); }
    if (e.action === 'schedule') { setSheetsMounted((m) => ({ ...m, schedule: true })); return setScheduleOpen(true); }
    if (e.href) router.push(e.href as Href);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* The field — focused on arrival, RTL, with a clear button. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Icon name="forward" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 48, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.brand, ...shadows.sm }}>
          <Icon name="search" size={18} color={colors.brand} />
          <TextInput
            ref={inputRef}
            value={q}
            onChangeText={setQ}
            placeholder={t('app_search.placeholder')}
            placeholderTextColor={colors.textTertiary}
            returnKeyType="search"
            autoCorrect={false}
            onSubmitEditing={() => results[0] && open(results[0].entry)}
            style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }}
          />
          {q ? (
            <TouchableOpacity onPress={() => { setQ(''); inputRef.current?.focus(); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('app_search.clear')}>
              <Icon name="close" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(r) => r.entry.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        ListHeaderComponent={
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>
            {typing ? t('app_search.results', { count: results.length }) : t('app_search.suggested')}
          </Text>
        }
        renderItem={({ item, index }) => {
          const e = item.entry;
          const best = typing && index === 0;
          return (
            <TouchableOpacity onPress={() => open(e)} activeOpacity={0.85} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, marginBottom: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: best ? 1.5 : 1, borderColor: best ? colors.brand : colors.border }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={e.icon} size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                  {item.sub || t(`app_search.area_${e.area}`)}
                </Text>
              </View>
              <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>{t(`app_search.area_${e.area}`)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          typing ? (
            <View style={{ alignItems: 'center', paddingTop: spacing.xl4, paddingHorizontal: spacing.xl }}>
              <Icon name="search" size={40} color={colors.textTertiary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }}>{t('app_search.none', { q: q.trim() })}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>{t('app_search.none_hint')}</Text>
            </View>
          ) : null
        }
      />
      {sheetsMounted.add ? <AddStudentSheet visible={addOpen} onClose={() => setAddOpen(false)} /> : null}
      {sheetsMounted.schedule ? <ScheduleToolsSheet visible={scheduleOpen} onClose={() => setScheduleOpen(false)} /> : null}
    </View>
  );
}
