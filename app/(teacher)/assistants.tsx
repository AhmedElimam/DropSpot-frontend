import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Switch, RefreshControl, KeyboardAvoidingView, Alert } from 'react-native';
import { router, Redirect, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuthStore } from '@/stores/authStore';
import {
  useAssistants,
  useInviteAssistant,
  useCreateAssistant,
  useUpdateAbilities,
  useSetVenueScope,
  useToggleAssistant,
  useRemoveAssistant,
} from '@/hooks/useAssistants';
import type { ManagedAssistant, AbilityDef } from '@/api/assistants';
import { usePullRefresh } from '@/hooks/usePullRefresh';

const STATUS_META: Record<string, { key: string; variant: BadgeVariant }> = {
  accepted: { key: 'assistants.status_active', variant: 'success' },
  pending: { key: 'assistants.status_pending', variant: 'warning' },
  rejected: { key: 'assistants.status_rejected', variant: 'danger' },
};

function apiMsg(e: any, fallback: string): string {
  return e?.response?.data?.message ?? fallback;
}

function AssistantCard({ a, catalog, takeaway, venues }: { a: ManagedAssistant; catalog: AbilityDef[]; takeaway: string[]; venues: { id: number; name: string }[] }) {
  const { t } = useTranslation();
  const updateAbilities = useUpdateAbilities();
  const setScope = useSetVenueScope();
  const toggle = useToggleAssistant();
  const remove = useRemoveAssistant();
  const meta = STATUS_META[a.status] ?? STATUS_META.pending;
  const isInvite = a.status === 'pending';

  const confirmRemove = () => {
    Alert.alert(
      t(isInvite ? 'assistants.cancel_invite_title' : 'assistants.remove_title'),
      isInvite ? t('assistants.cancel_invite_body') : t('assistants.remove_body', { name: a.name ?? '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t(isInvite ? 'assistants.cancel_invite' : 'assistants.remove'),
          style: 'destructive',
          onPress: () => remove.mutate(a.id, {
            onError: (e) => Alert.alert(t('assistants.remove_failed'), apiMsg(e, t('assistants.remove_failed'))),
          }),
        },
      ],
    );
  };
  const showInactive = a.status === 'accepted' && !a.is_active;

  const sharedWith = a.shared_with ?? 0;

  const grant = (key: string) => {
    const next = a.abilities.includes(key) ? a.abilities.filter((x) => x !== key) : [...a.abilities, key];
    updateAbilities.mutate({ id: a.id, abilities: next });
  };

  const toggleAbility = (key: string) => {
    const turningOn = !a.abilities.includes(key);
    // Granting a takeaway-file ability to a SHARED assistant takes one deliberate extra
    // step: the PDF leaves the platform with a person who also works for other teachers,
    // and revoking the ability later cannot reach a file already on their phone.
    if (turningOn && takeaway.includes(key) && sharedWith > 0) {
      Alert.alert(
        'مساعد مشترك',
        'هذا المساعد يعمل مع معلّمين آخرين. تقرير الطالب ملف كامل يخرج من المنصة ويبقى معه، ولا يمكن سحبه بعد ذلك حتى لو أوقفت الصلاحية.\n\nهل تريد منحه هذه الصلاحية؟',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'امنح الصلاحية', style: 'destructive', onPress: () => grant(key) },
        ],
      );

      return;
    }
    grant(key);
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{a.name ?? '—'}</Text>
            <Badge label={showInactive ? t('assistants.status_inactive') : t(meta.key)} variant={showInactive ? 'default' : meta.variant} size="sm" />
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{a.phone ?? ''}</Text>
        </View>
        {/* Active toggle only meaningful once the assistant accepted. */}
        {a.status === 'accepted' ? (
          toggle.isPending && toggle.variables === a.id ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Switch value={a.is_active} onValueChange={() => toggle.mutate(a.id)} />
          )
        ) : null}
      </View>

      {sharedWith > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.warningLight, borderWidth: 1, borderColor: colors.warning }}>
          <Icon name="info" size={16} color={colors.warning} />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }}>
            مساعد مشترك — يعمل أيضًا مع {sharedWith === 1 ? 'معلّم آخر' : `${sharedWith} معلّمين آخرين`}. ننصح بعدم منحه صلاحية إصدار تقارير PDF.
          </Text>
        </View>
      ) : null}

      {/* WHERE they work — separate from WHAT they may do. A teacher with two centres
          gives the same abilities to two assistants and still keeps each to their own
          place: outside their venues they see no students, no dues, and collect nothing.
          Choosing NO venue is not a cage — an unpinned assistant works everywhere (founder). */}
      {venues.length > 0 && a.status === 'accepted' ? (
        <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginBottom: spacing.sm }}>أماكن العمل</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => setScope.mutate({ id: a.id, allVenues: true })}
              disabled={setScope.isPending}
              activeOpacity={0.8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: a.all_venues ? colors.primaryLight : colors.surfaceSunken, borderWidth: 1, borderColor: a.all_venues ? colors.primary : colors.border }}
            >
              <Icon name={a.all_venues ? 'success' : 'add'} size={13} color={a.all_venues ? colors.primary : colors.textTertiary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: a.all_venues ? colors.primary : colors.textSecondary }}>كل الأماكن</Text>
            </TouchableOpacity>
            {venues.map((v) => {
              const on = !a.all_venues && (a.venue_ids ?? []).includes(v.id);
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => {
                    const current = a.all_venues ? [] : (a.venue_ids ?? []);
                    const next = on ? current.filter((x) => x !== v.id) : [...current, v.id];
                    setScope.mutate({ id: a.id, allVenues: false, venues: next });
                  }}
                  disabled={setScope.isPending}
                  activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? colors.primaryLight : colors.surfaceSunken, borderWidth: 1, borderColor: on ? colors.primary : colors.border }}
                >
                  <Icon name={on ? 'success' : 'add'} size={13} color={on ? colors.primary : colors.textTertiary} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: on ? colors.primary : colors.textSecondary }}>{v.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: spacing.sm }}>
            {a.all_venues
              ? 'يعمل في كل الأماكن — وأي مكان تضيفه لاحقًا. اختر مكانًا لتقييده.'
              : 'خارج أماكنه لا يرى الطالب ولا تحصيلاته. وإلغاء كل الأماكن يعيده للعمل في كل الأماكن.'}
          </Text>
        </View>
      ) : null}

      {/* Ability chips — tap to grant/revoke (disabled while a pending invite). */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
        {catalog.map((ab) => {
          const on = a.abilities.includes(ab.key);
          return (
            <TouchableOpacity
              key={ab.key}
              onPress={() => toggleAbility(ab.key)}
              disabled={updateAbilities.isPending}
              activeOpacity={0.8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? colors.primaryLight : colors.surfaceSunken, borderWidth: 1, borderColor: on ? colors.primary : colors.border }}
            >
              <Icon name={on ? 'success' : 'add'} size={13} color={on ? colors.primary : colors.textTertiary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: on ? colors.primary : colors.textSecondary }}>{ab.label}</Text>
              {takeaway.includes(ab.key) ? (
                <Icon name="download" size={12} color={sharedWith > 0 ? colors.warning : colors.textTertiary} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* End the relationship — quiet, at the foot of the card, always behind a confirm. */}
      <TouchableOpacity
        onPress={confirmRemove}
        disabled={remove.isPending}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: spacing.md, paddingVertical: 6 }}
      >
        {remove.isPending ? <ActivityIndicator size="small" color={colors.danger} /> : <Icon name="trash" size={15} color={colors.danger} />}
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.danger }}>{t(isInvite ? 'assistants.cancel_invite' : 'assistants.remove')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TeacherAssistants() {
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);
  const { data, isLoading, refetch } = useAssistants();
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const invite = useInviteAssistant();
  const create = useCreateAssistant();

  const [phone, setPhone] = useState('');
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [cFirst, setCFirst] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cPass, setCPass] = useState('');
  const [createErr, setCreateErr] = useState<string | null>(null);

  // Assistant management is teacher-only; an assistant is bounced (backend also 403s).
  if (role === 'assistant') return <Redirect href={'/(teacher)' as Href} />;

  const catalog = data?.all_abilities ?? [];
  const takeaway = data?.takeaway_abilities ?? [];
  const venues = data?.venues ?? [];

  const submitInvite = () => {
    if (phone.trim().length < 6) return;
    setInviteErr(null);
    invite.mutate(phone.trim(), {
      onSuccess: () => setPhone(''),
      onError: (e) => setInviteErr(apiMsg(e, 'تعذّرت الدعوة')),
    });
  };

  const submitCreate = () => {
    if (cFirst.trim().length < 2 || cPhone.trim().length < 6 || cPass.length < 6) return;
    setCreateErr(null);
    create.mutate(
      { first_name: cFirst.trim(), phone_number: cPhone.trim(), password: cPass },
      {
        onSuccess: () => { setCFirst(''); setCPhone(''); setCPass(''); setShowCreate(false); },
        onError: (e) => setCreateErr(apiMsg(e, 'تعذّر الإنشاء')),
      },
    );
  };

  const field = {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, height: 48, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const,
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>المساعدون</Text>
      </View>

      <ScrollView
        // The tab bar floats over the content (position: absolute), so its height has to
        // be part of the padding or the last assistant card sits underneath it.
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Invite an existing assistant by phone */}
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.sm }}>دعوة مساعد قائم</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TextInput value={phone} onChangeText={setPhone} placeholder="رقم هاتف المساعد" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" style={{ ...field, flex: 1 }} />
            <TouchableOpacity onPress={submitInvite} disabled={invite.isPending} activeOpacity={0.85} style={{ paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', minWidth: 84 }}>
              {invite.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>دعوة</Text>}
            </TouchableOpacity>
          </View>
          {inviteErr ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.danger, marginTop: spacing.sm }}>{inviteErr}</Text> : null}
        </View>

        {/* Create a brand-new assistant account */}
        <TouchableOpacity onPress={() => setShowCreate((v) => !v)} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, marginBottom: showCreate ? spacing.sm : spacing.lg }}>
          <Icon name={showCreate ? 'down' : 'add'} size={18} color={colors.brand} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand }}>إنشاء حساب مساعد جديد</Text>
        </TouchableOpacity>
        {showCreate ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm }}>
            <TextInput value={cFirst} onChangeText={setCFirst} placeholder="اسم المساعد" placeholderTextColor={colors.textTertiary} style={field} />
            <TextInput value={cPhone} onChangeText={setCPhone} placeholder="رقم الهاتف" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" style={field} />
            <PasswordInput value={cPass} onChangeText={setCPass} placeholder="كلمة المرور (6 أحرف على الأقل)" placeholderTextColor={colors.textTertiary} style={field} />
            {createErr ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.danger }}>{createErr}</Text> : null}
            <TouchableOpacity onPress={submitCreate} disabled={create.isPending} activeOpacity={0.85} style={{ minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xs }}>
              {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>إنشاء</Text>}
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.md }}>مساعدوك</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : !data?.assistants.length ? (
          <EmptyState icon="children" title="لا يوجد مساعدون" message="ادعُ مساعدًا قائمًا أو أنشئ حسابًا جديدًا." />
        ) : (
          data.assistants.map((a) => <AssistantCard key={a.id} a={a} catalog={catalog} takeaway={takeaway} venues={venues} />)
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
