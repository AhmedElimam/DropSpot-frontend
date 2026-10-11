import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Alert } from '@/ui/dialog';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { FormScreen, FormCard, Field, Input, HeaderCount, Banner } from '@/components/ui/Form';
import { getVenues, createVenue, updateVenue, toggleVenue, deleteVenue, setVenueAssistants, type Venue } from '@/api/venues';
import { formatNumber } from '@/utils/format';
import { Surface } from '@/ui/surfaces';

/**
 * أماكن التدريس — the teacher's own list of places. A venue is a NAME and the people who
 * work it: no coordinates, no radius, and it never affects check-in (a course's GPS anchor
 * is a separate setting). Attaching a course to one is optional, everywhere.
 */
export default function TeacherVenues() {
  const { t } = useTranslation();
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
  const fail = (e: any, fallback: string) => Alert.alert(t('staff_ui.save_failed'), e?.response?.data?.message ?? fallback);

  const save = useMutation({
    mutationFn: () => editing ? updateVenue(editing.id, { name: name.trim(), address: address.trim() || null }) : createVenue({ name: name.trim(), address: address.trim() || null }),
    onSuccess: () => { setName(''); setAddress(''); setEditing(null); invalidate(); },
    onError: (e) => fail(e, t('staff_ui.venue_name_conflict')),
  });
  const toggle = useMutation({ mutationFn: (id: number) => toggleVenue(id), onSuccess: invalidate, onError: (e) => fail(e, t('staff_ui.venue_toggle_failed')) });
  const remove = useMutation({ mutationFn: (id: number) => deleteVenue(id), onSuccess: invalidate, onError: (e) => fail(e, t('staff_ui.venue_delete_failed')) });
  const assistants = useMutation({ mutationFn: (v: { id: number; ids: number[] }) => setVenueAssistants(v.id, v.ids), onSuccess: invalidate, onError: (e) => fail(e, t('staff_ui.venue_assistants_failed')) });

  const startEdit = (v: Venue) => { setEditing(v); setName(v.name); setAddress(v.address ?? ''); setExpanded(null); };
  const cancelEdit = () => { setEditing(null); setName(''); setAddress(''); };
  const confirmDelete = (v: Venue) => {
    Alert.alert(t('staff_ui.delete_venue_title'),
      v.courses_count > 0 ? t('staff_ui.delete_venue_linked', { name: v.name, count: v.courses_count }) : t('staff_ui.delete_venue_confirm', { name: v.name }),
      [{ text: t('common.cancel'), style: 'cancel' }, { text: t('staff_ui.delete_btn'), style: 'destructive', onPress: () => remove.mutate(v.id) }]);
  };

  if (isError && !data) return <ErrorState onRetry={refetch} />;
  const venues = data?.locations ?? [];
  const pool = data?.assignable_assistants ?? [];
  const canSave = name.trim().length > 0 && !save.isPending;

  return (
    <Surface id="screen.teacher.venues" screen>
    <FormScreen title={t('manage.venues_title')} subtitle={t('staff_ui.venues_subtitle')} loading={isLoading} scroll={false}
      right={venues.length > 0 ? <HeaderCount n={venues.length} /> : null}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.xxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}>
        <Surface id="teacher.venues.banner"><Banner tone="info" icon="gps" text={t('staff_ui.venues_banner')} /></Surface>

        {/* Add / edit */}
        <Surface id="teacher.venues.form">
        <FormCard icon={editing ? 'note' : 'add'} title={editing ? t('form_ui.editing', { name: editing.name }) : t('form_ui.new_venue')} tint={editing ? colors.accent : colors.brand}
          action={editing ? (
            <TouchableOpacity onPress={cancelEdit} hitSlop={8}><Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{t('common.cancel')}</Text></TouchableOpacity>
          ) : undefined}>
          <Field label={t('staff_ui.venue_name_label')} required first>
            <Input value={name} onChangeText={setName} placeholder={t('staff_ui.venue_name_ph')} maxLength={120} />
          </Field>
          <Field label={t('staff_ui.address')} hint={t('form_ui.optional')}>
            <Input value={address} onChangeText={setAddress} placeholder={t('staff_ui.venue_address_ph')} maxLength={255} />
          </Field>
          <Surface id="teacher.venues.save_button">
          <View style={{ marginTop: spacing.md }}>
            <Button title={editing ? t('staff_ui.save_edit_btn') : t('staff_ui.add_venue_btn')} onPress={() => canSave && save.mutate()} disabled={!canSave} loading={save.isPending} variant={editing ? 'accent' : 'primary'} />
          </View>
          </Surface>
        </FormCard>
        </Surface>

        <Surface id="teacher.venues.list">
        {venues.length === 0 ? (
          <EmptyState icon="gps" title={t('staff_ui.no_venues_title')} message={t('staff_ui.no_venues_msg')} />
        ) : venues.map((v) => {
          const open = expanded === v.id;
          const assigned = new Set(v.assistants.map((a) => a.id));
          const tint = v.is_active ? colors.success : colors.warning;
          return (
            <View key={v.id} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: open ? colors.brand : colors.border, borderStartWidth: 5, borderStartColor: tint, marginBottom: spacing.sm, overflow: 'hidden' }}>
              <TouchableOpacity onPress={() => setExpanded(open ? null : v.id)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ expanded: open }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, opacity: v.is_active ? 1 : 0.7 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tint + '1A', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="gps" size={22} color={tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{v.name}</Text>
                    {!v.is_active ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 1, borderRadius: radius.full, backgroundColor: colors.warningLight }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.warningText }}>{t('form_ui.inactive')}</Text>
                      </View>
                    ) : null}
                  </View>
                  {v.address ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{v.address}</Text> : null}
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary, marginTop: 3 }} numberOfLines={1}>
                    {t('form_ui.courses_n', { n: formatNumber(v.courses_count) })} · {v.assistants.length ? v.assistants.map((a) => a.name).join('، ') : t('form_ui.no_assistants')}
                  </Text>
                </View>
                <Icon name="down" size={18} color={colors.textTertiary} style={open ? { transform: [{ rotate: '180deg' }] } : undefined} />
              </TouchableOpacity>

              {open ? (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: spacing.md, backgroundColor: colors.surfaceSunken }}>
                  <Surface id="teacher.venues.assistants_picker">
                  {pool.length > 0 ? (
                    <View>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('form_ui.venue_assistants')}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        {pool.map((a) => {
                          const on = assigned.has(a.id);
                          return (
                            <TouchableOpacity key={a.id} disabled={assistants.isPending} activeOpacity={0.8} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                              onPress={() => assistants.mutate({ id: v.id, ids: on ? [...assigned].filter((x) => x !== a.id) : [...assigned, a.id] })}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.border }}>
                              <Icon name={on ? 'success' : 'add'} size={13} color={on ? '#fff' : colors.textTertiary} />
                              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: on ? '#fff' : colors.textSecondary }}>{a.name}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary }}>{t('staff_ui.no_assistants_yet_hint')}</Text>
                  )}
                  </Surface>
                  <Surface id="teacher.venues.actions">
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Surface id="teacher.venues.edit_button"><Action label={t('staff_ui.edit_btn')} icon="note" onPress={() => startEdit(v)} /></Surface>
                    <Surface id="teacher.venues.toggle_button"><Action label={v.is_active ? t('staff_ui.deactivate_btn') : t('staff_ui.activate_btn')} icon={v.is_active ? 'clock' : 'success'} busy={toggle.isPending} onPress={() => toggle.mutate(v.id)} /></Surface>
                    <Surface id="teacher.venues.delete_button"><Action label={t('staff_ui.delete')} icon="trash" tone={colors.danger} busy={remove.isPending} onPress={() => confirmDelete(v)} /></Surface>
                  </View>
                  </Surface>
                </View>
              ) : null}
            </View>
          );
        })}
        </Surface>
      </ScrollView>
    </FormScreen>
    </Surface>
  );
}

function Action({ label, icon, onPress, tone, busy }: { label: string; icon: IconName; onPress: () => void; tone?: string; busy?: boolean }) {
  const c = tone ?? colors.textSecondary;
  return (
    <TouchableOpacity onPress={onPress} disabled={busy} activeOpacity={0.8} accessibilityRole="button"
      style={{ flex: 1, minHeight: 42, borderRadius: radius.lg, borderWidth: 1, borderColor: tone ? tone + '55' : colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }}>
      {busy ? <ActivityIndicator size="small" color={c} /> : <Icon name={icon} size={15} color={c} />}
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: c }}>{label}</Text>
    </TouchableOpacity>
  );
}
