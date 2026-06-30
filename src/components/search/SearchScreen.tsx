import { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows } from '@/theme/index';
import { SearchBar } from '@/components/layout/SearchBar';
import { router } from 'expo-router';
import { useSearch } from '@/hooks/useSearch';

interface SearchScreenProps {
  userType?: 'student' | 'parent';
}

const MOCK_STUDENTS = [
  { id: '1', name: 'يوسف أحمد', code: '2024001', grade: 'الصف الثالث الإعدادي' },
  { id: '2', name: 'مريم علي', code: '2024002', grade: 'الصف الأول الإعدادي' },
  { id: '3', name: 'أحمد خالد', code: '2024003', grade: 'الصف الثاني الإعدادي' },
  { id: '4', name: 'سارة عمر', code: '2024004', grade: 'الصف الثالث الإعدادي' },
];

export function SearchScreen({ userType }: SearchScreenProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { results, isLoading, hasSearched, search } = useSearch();

  const handleSearch = (text: string) => {
    setQuery(text);
    search(text);
  };

  const showMockData = !query.trim() && !hasSearched;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <SearchBar value={query} onChangeText={handleSearch} placeholder={t('search.placeholder')} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isLoading && <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xxxl }} />}

        {!isLoading && hasSearched && results.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
            <Text style={{ fontSize: 40, marginBottom: spacing.md }}>{'🔍'}</Text>
            <Text style={textPresets.bodySmall}>{t('search.no_results')}</Text>
          </View>
        )}

        {!isLoading && hasSearched && results.length > 0 && (
          <>
            <Text style={[textPresets.bodySmall, { marginBottom: spacing.md }]}>
              {t('search.results_for', { query })}
            </Text>
            {results.map((r: any) => {
              if (r.type === 'student') {
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={{ padding: spacing.md, backgroundColor: colors.white, borderRadius: radius.md, marginBottom: spacing.sm, ...shadows.sm }}
                  >
                    <Text style={textPresets.body}>{r.name}</Text>
                    {r.subtitle && <Text style={textPresets.caption}>{r.subtitle}</Text>}
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity key={r.id} style={{ padding: spacing.md, backgroundColor: colors.white, borderRadius: radius.md, marginBottom: spacing.sm, ...shadows.sm }}>
                  <Text style={textPresets.body}>{r.name}</Text>
                  {r.subtitle && <Text style={textPresets.caption}>{r.subtitle}</Text>}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {showMockData && MOCK_STUDENTS.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={{ padding: spacing.md, backgroundColor: colors.white, borderRadius: radius.md, marginBottom: spacing.sm, ...shadows.sm }}
          >
            <Text style={textPresets.body}>{s.name}</Text>
            <Text style={textPresets.caption}>{s.grade}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
