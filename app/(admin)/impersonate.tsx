import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList, ActivityIndicator, Switch, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { colors, spacing, radius } from '@/theme/index';
import { fonts } from '@/theme/typography';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore, resolveRole } from '@/stores/authStore';
import {
  listImpersonatableUsers, startImpersonationForUser, type ImpersonatableRole, type ImpersonatableUser,
} from '@/api/impersonation';

const ROLES: { key: ImpersonatableRole; label: string }[] = [
  { key: 'teacher', label: 'معلّم' },
  { key: 'assistant', label: 'مساعد' },
  { key: 'parent', label: 'وليّ أمر' },
  { key: 'student', label: 'طالب' },
];

export default function ImpersonatePicker() {
  const insets = useSafeAreaInsets();
  const admin = useAuthStore((s) => s.user);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setSession = useAuthStore((s) => s.setSession);
  const setImpersonation = useAuthStore((s) => s.setImpersonation);
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<ImpersonatableRole>('teacher');
  const [q, setQ] = useState('');
  const [write, setWrite] = useState(false);
  const [starting, setStarting] = useState(false);

  const { data: users = [], isFetching } = useQuery({
    queryKey: ['imp-users', role, q],
    queryFn: () => listImpersonatableUsers(role, q),
    enabled: open,
  });

  const start = (u: ImpersonatableUser) => {
    const canWrite = role !== 'student' && write; // students are read-only always
    Alert.alert(
      'بدء التصفّح',
      `التصفّح بحساب ${u.name}${canWrite ? ' (وضع الكتابة)' : ' (قراءة فقط)'}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'بدء',
          onPress: async () => {
            if (starting) return;
            setStarting(true);
            try {
              // Stash the super-admin's own session so "Exit" returns here. BOTH
              // tokens are saved: the impersonation swap below sets refresh_token to
              // '' (an impersonation session is deliberately unrefreshable), so
              // without stashing the admin's real refresh_token the restored admin
              // session couldn't refresh and the next 401 would force a re-login.
              const currentToken = await SecureStore.getItemAsync('access_token');
              const currentRefresh = await SecureStore.getItemAsync('refresh_token');
              await SecureStore.setItemAsync('imp_admin_token', currentToken ?? '');
              await SecureStore.setItemAsync('imp_admin_refresh', currentRefresh ?? '');
              await SecureStore.setItemAsync('imp_admin_user', JSON.stringify(admin));

              const res = await startImpersonationForUser(u.id, canWrite);
              await setTokens(res.tokens.access_token, res.tokens.refresh_token ?? '');
              await setSession(res.user, resolveRole(res.user));
              await setImpersonation({ active: true, name: res.impersonation.name, write: res.impersonation.write });
              qc.clear();
              setOpen(false);
              router.replace('/');
            } catch {
              Alert.alert('تعذّر بدء التصفّح');
            } finally {
              setStarting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.xs }}>
        أداة الدعم — التصفّح بحساب
      </Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, marginBottom: spacing.xxl }}>
        اختر مستخدمًا لبدء جلسة تصفّح مؤقتة. قراءة فقط افتراضيًا، وكل إجراء يُسجَّل باسمك.
      </Text>

      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        style={{ backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}
      >
        <Icon name="profile" size={20} color={colors.textInverse} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse }}>اختيار مستخدم للتصفّح</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => { logout(); router.replace('/(auth)/login'); }} style={{ marginTop: spacing.xl, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary }}>تسجيل الخروج</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + spacing.md }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Icon name="forward" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>اختر مستخدمًا</Text>
          </View>

          {/* Role filter chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            {ROLES.map((r) => {
              const active = r.key === role;
              return (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => setRole(r.key)}
                  style={{
                    paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.lg,
                    backgroundColor: active ? colors.brand : colors.surfaceSunken,
                    borderWidth: 1, borderColor: active ? colors.brand : colors.border,
                  }}
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: active ? colors.textInverse : colors.textSecondary }}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Search */}
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="بحث بالاسم أو الرقم"
            placeholderTextColor={colors.textTertiary}
            style={{
              marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg,
              paddingHorizontal: spacing.lg, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 16,
              color: colors.textPrimary, textAlign: 'right', borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
            }}
          />

          {/* Write-mode toggle (never for students) */}
          {role !== 'student' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary }}>
                وضع الكتابة (كل إجراء يُسجَّل)
              </Text>
              <Switch value={write} onValueChange={setWrite} />
            </View>
          )}

          {isFetching ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.brand} />
          ) : (
            <FlatList
              data={users}
              keyExtractor={(u) => String(u.id)}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
              ListEmptyComponent={
                <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xl }}>
                  لا يوجد مستخدمون.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => start(item)}
                  disabled={starting}
                  style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{item.name}</Text>
                    {!!item.phone && (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary }}>{item.phone}</Text>
                    )}
                  </View>
                  <Icon name="back" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
