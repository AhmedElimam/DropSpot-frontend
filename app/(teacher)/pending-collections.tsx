import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router, Redirect, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatEGP } from '@/utils/currency';
import { useAuthStore } from '@/stores/authStore';
import { getPendingCollections, collectFromRoster, type RosterStudent, type CollectKind } from '@/api/pendingCollections';
import { usePullRefresh } from '@/hooks/usePullRefresh';

interface Target {
  studentId: number;
  name: string;
  kind: CollectKind;
  label: string;
  remaining: number;
}

export default function TeacherPendingCollections() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.role);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pending-collections'],
    queryFn: getPendingCollections,
    enabled: role !== 'assistant',
  });
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const [target, setTarget] = useState<Target | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  // FINANCE — never available to an assistant on mobile, even via a direct link.
  // (After all hooks so hook order stays stable.)
  if (role === 'assistant') {
    return <Redirect href={'/(teacher)' as Href} />;
  }

  const openCollect = (tg: Target) => {
    setTarget(tg);
    setAmount(String(tg.remaining));
  };

  const submit = async () => {
    if (!target) return;
    const amt = Number(amount);
    if (!(amt > 0)) return;
    setBusy(true);
    try {
      const res = await collectFromRoster(target.studentId, target.kind, amt);
      await qc.invalidateQueries({ queryKey: ['pending-collections'] });
      setTarget(null);
      Alert.alert('', res.remaining && Number(res.remaining) > 0
        ? t('collections.collected_partial', { amount: res.amount, remaining: res.remaining })
        : t('collections.collected_full'));
    } catch {
      Alert.alert(t('common.error'), t('collections.collect_failed'));
    } finally {
      setBusy(false);
    }
  };

  const Badge = ({ text, color }: { text: string; color: string }) => (
    <View style={{ backgroundColor: color + '1f', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color }}>{text}</Text>
    </View>
  );

  const renderStudent = ({ item }: { item: RosterStudent }) => {
    const bill = item.bill;
    return (
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{item.name}</Text>
          {item.code ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{item.code}</Text> : null}
        </View>

        {/* Session bill */}
        {bill ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }}>
            {bill.settled ? (
              <>
                <Badge text={t('collections.fully_paid')} color={colors.success} />
                <Badge text={`${t('collections.paid')} ${formatEGP(bill.paid)}`} color={colors.success} />
              </>
            ) : (
              <>
                <Badge text={bill.overdue ? t('collections.overdue') : t('collections.due')} color={bill.overdue ? colors.danger : colors.warning} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('collections.remaining')} {formatEGP(bill.total)}</Text>
                {bill.paid > 0 ? <Badge text={`${t('collections.paid')} ${formatEGP(bill.paid)}`} color={colors.success} /> : null}
                <TouchableOpacity
                  onPress={() => openCollect({ studentId: item.student_id, name: item.name, kind: 'bill', label: t('collections.due_bill'), remaining: bill.total })}
                  style={{ marginStart: 'auto', backgroundColor: colors.success, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('collections.collect')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        {/* Booklets */}
        {item.booklets.map((bk) => (
          <View key={`bk-${bk.id}`} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Badge text={t('collections.booklet')} color={colors.info} />
            {bk.course ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{bk.course}</Text> : null}
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('collections.remaining')} {formatEGP(bk.amount)}</Text>
            {bk.paid > 0 ? <Badge text={`${t('collections.paid')} ${formatEGP(bk.paid)}`} color={colors.success} /> : null}
            <TouchableOpacity
              onPress={() => openCollect({ studentId: item.student_id, name: item.name, kind: 'booklet', label: t('collections.due_booklet'), remaining: bk.amount })}
              style={{ marginStart: 'auto', backgroundColor: colors.success, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('collections.collect')}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Bookings */}
        {item.bookings.map((bk) => (
          <View key={`bo-${bk.id}`} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Badge text={t('collections.booking')} color={colors.brand} />
            {bk.course ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{bk.course}</Text> : null}
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('collections.remaining')} {formatEGP(bk.remaining)}</Text>
            {bk.paid > 0 ? <Badge text={`${t('collections.paid')} ${formatEGP(bk.paid)}`} color={colors.success} /> : null}
            <TouchableOpacity
              onPress={() => openCollect({ studentId: item.student_id, name: item.name, kind: 'booking', label: t('collections.due_booking'), remaining: bk.remaining })}
              style={{ marginStart: 'auto', backgroundColor: colors.success, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('collections.collect')}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('collections.title')}</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(s) => String(s.student_id)}
          renderItem={renderStudent}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          ListEmptyComponent={<EmptyState icon="money" title={t('collections.empty')} />}
        />
      )}

      {/* Collect modal — amount input, default = full remainder. */}
      <Modal visible={!!target} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: spacing.xl + insets.bottom }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{target?.label}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.lg }}>{target?.name}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <TextInput
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
                style={{ flex: 1, height: 48, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, textAlign: 'right' }}
              />
              <TouchableOpacity onPress={() => setAmount(String(target?.remaining ?? ''))} style={{ paddingHorizontal: spacing.md, height: 48, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('collections.full')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm }}>{t('collections.partial_hint')}</Text>

            <TouchableOpacity
              onPress={submit}
              disabled={busy || !(Number(amount) > 0)}
              activeOpacity={0.85}
              style={{ marginTop: spacing.lg, minHeight: 48, borderRadius: radius.md, backgroundColor: Number(amount) > 0 ? colors.success : colors.border, justifyContent: 'center', alignItems: 'center' }}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('collections.confirm')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTarget(null)} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
