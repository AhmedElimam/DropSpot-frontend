import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/ErrorState';
import { getVenues, createVenue, updateVenue, toggleVenue, deleteVenue, setVenueAssistants, type Venue } from '@/api/venues';

/**
 * أماكن التدريس — the teacher's own list of places, on mobile.
 *
 * A venue is a NAME and the people who work it: no coordinates, no radius, and it never
 * affects check-in (a course's GPS anchor is a separate setting). Its whole job is to
 * let a teacher group courses by where they teach them and say which assistants work
 * each place. Attaching a course to one is optional, everywhere.
 *
 * This screen existed only on the web dashboard, which is why the venue dropdown on the
 * course forms looked broken to a teacher who works from the phone: with no way to
 * create a venue there, the list was always empty and the field never appeared.
 */
export default function TeacherVenues() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({ queryKey: ['venues'], queryFn: getVenues });

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [editing, setEditing] = useState<Venue | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['venues'] });
    // The course forms read their dropdown from this list.
    qc.invalidateQueries({ queryKey: ['course-form-options'] });
  };

  const fail = (e: any, fallback: string) =>
    Alert.alert('تعذّر الحفظ', e?.response?.data?.message ?? fallback);

  const save = useMutation({
    mutationFn: () => editing
      ? updateVenue(editing.id, { name: name.trim(), address: address.trim() || null })
      : createVenue({ name: name.trim(), address: address.trim() || null }),
    onSuccess: () => { setName(''); setAddress(''); setEditing(null); invalidate(); },
    onError: (e) => fail(e, 'تحقّق من الاسم — لا يمكن تكرار مكان بنفس الاسم.'),
  });

  const toggle = useMutation({
    mutationFn: (id: number) => toggleVenue(id),
    onSuccess: invalidate,
    onError: (e) => fail(e, 'تعذّر تغيير حالة المكان.'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteVenue(id),
    onSuccess: invalidate,
    onError: (e) => fail(e, 'تعذّر حذف المكان.'),
  });

  const assistants = useMutation({
    mutationFn: (v: { id: number; ids: number[] }) => setVenueAssistants(v.id, v.ids),
    onSuccess: invalidate,
    onError: (e) => fail(e, 'تعذّر تحديث المساعدين.'),
  });

  const startEdit = (v: Venue) => {
    setEditing(v);
    setName(v.name);
    setAddress(v.address ?? '');
  };

  const confirmDelete = (v: Venue) => {
    Alert.alert(
      'حذف المكان',
      v.courses_count > 0
        ? `«${v.name}» مرتبط بـ ${v.courses_count} مقرر. الحذف يفكّ الارتباط فقط — المقررات تكمل عملها كما هي.`
        : `حذف «${v.name}»؟`,
      [{ text: 'إلغاء', style: 'cancel' }, { text: 'احذف', style: 'destructive', onPress: () => remove.mutate(v.id) }],
    );
  };

  if (isLoading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.brand} /></View>;
  }
  if (isError) return <ErrorState onRetry={refetch} />;

  const venues = data?.locations ?? [];
  const pool = data?.assignable_assistants ?? [];
  const canSave = name.trim().length > 0 && !save.isPending;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <TouchableOpacity onPress={() => router.back()}><Icon name="forward" size={26} color={colors.textSecondary} /></TouchableOpacity>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>أماكن التدريس</Text>
          <View style={{ width: 26 }} />
        </View>

        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 22, color: colors.textSecondary, marginBottom: spacing.lg }}>
          أماكنك التي تدرّس فيها — تنظّم بها مقرراتك وتحدّد أي مساعد يعمل في كل مكان.
          لا علاقة لها بموقع تسجيل الحضور، وربط المقرر بمكان اختياري دائمًا.
        </Text>

        {/* Add / edit */}
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadows.sm, marginBottom: spacing.lg }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.md }}>
            {editing ? `تعديل «${editing.name}»` : 'مكان جديد'}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="اسم المكان — مثال: سنتر النور"
            placeholderTextColor={colors.textTertiary}
            maxLength={120}
            style={field}
          />
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="العنوان (اختياري)"
            placeholderTextColor={colors.textTertiary}
            maxLength={255}
            style={[field, { marginTop: spacing.sm }]}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            {editing ? (
              <TouchableOpacity
                onPress={() => { setEditing(null); setName(''); setAddress(''); }}
                style={{ flex: 1, minHeight: 46, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary }}>إلغاء</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => canSave && save.mutate()}
              disabled={!canSave}
              activeOpacity={0.85}
              style={{ flex: 2, minHeight: 46, borderRadius: radius.lg, backgroundColor: canSave ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm }}
            >
              {save.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Icon name={editing ? 'success' : 'add'} size={17} color="#fff" />}
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{editing ? 'احفظ التعديل' : 'أضِف المكان'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {venues.length === 0 ? (
          <View style={{ alignItems: 'center', padding: spacing.xl }}>
            <Icon name="gps" size={34} color={colors.textTertiary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }}>
              لا أماكن بعد — أضِف أول مكان من الأعلى، وسيظهر بعدها في صفحة إنشاء المقرر.
            </Text>
          </View>
        ) : null}

        {venues.map((v) => {
          const open = expanded === v.id;
          const assigned = new Set(v.assistants.map((a) => a.id));

          return (
            <View key={v.id} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm, marginBottom: spacing.md, opacity: v.is_active ? 1 : 0.6, overflow: 'hidden' }}>
              <View style={{ padding: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{v.name}</Text>
                      {!v.is_active ? (
                        <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.warningLight }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.warning }}>موقوف</Text>
                        </View>
                      ) : null}
                    </View>
                    {v.address ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{v.address}</Text>
                    ) : null}
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginTop: 4 }}>
                      {v.courses_count} مقرر · {v.assistants.length ? v.assistants.map((a) => a.name).join('، ') : 'لا مساعدين'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setExpanded(open ? null : v.id)} accessibilityRole="button" hitSlop={8}>
                    <Icon name="down" size={18} color={colors.textTertiary} style={open ? { transform: [{ rotate: '180deg' }] } : undefined} />
                  </TouchableOpacity>
                </View>
              </View>

              {open ? (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, gap: spacing.md }}>
                  {pool.length > 0 ? (
                    <View>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary, marginBottom: spacing.sm }}>مساعدو هذا المكان</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        {pool.map((a) => {
                          const on = assigned.has(a.id);
                          return (
                            <TouchableOpacity
                              key={a.id}
                              disabled={assistants.isPending}
                              onPress={() => {
                                const next = on ? [...assigned].filter((x) => x !== a.id) : [...assigned, a.id];
                                assistants.mutate({ id: v.id, ids: next });
                              }}
                              activeOpacity={0.8}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? colors.primaryLight : colors.surfaceSunken, borderWidth: 1, borderColor: on ? colors.primary : colors.border }}
                            >
                              <Icon name={on ? 'success' : 'add'} size={13} color={on ? colors.primary : colors.textTertiary} />
                              <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: on ? colors.primary : colors.textSecondary }}>{a.name}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary }}>
                      لا مساعدين لديك بعد — أضِفهم من «المساعدون» ثم أسندهم لأماكنهم.
                    </Text>
                  )}

                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Action label="تعديل" icon="note" onPress={() => startEdit(v)} />
                    <Action label={v.is_active ? 'إيقاف' : 'تفعيل'} icon="clock" onPress={() => toggle.mutate(v.id)} />
                    <Action label="حذف" icon="trash" tone={colors.danger} onPress={() => confirmDelete(v)} />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Action({ label, icon, onPress, tone }: { label: string; icon: IconName; onPress: () => void; tone?: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ flex: 1, minHeight: 42, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }}
    >
      <Icon name={icon} size={15} color={tone ?? colors.textSecondary} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: tone ?? colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  );
}

const field = {
  backgroundColor: colors.surfaceSunken,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.lg,
  paddingHorizontal: spacing.md,
  height: 48,
  fontFamily: fonts.medium,
  fontSize: 15,
  color: colors.textPrimary,
  textAlign: 'right',
} as const;
