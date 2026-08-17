import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { fonts } from '@/theme/typography';
import { useAuthStore, resolveRole } from '@/stores/authStore';
import { stopImpersonation, setImpersonationWrite } from '@/api/impersonation';

/**
 * Persistent, impossible-to-miss banner shown on every screen while a super-admin
 * impersonation session is active on this device. Renders nothing otherwise.
 * "Exit" ends the session (revokes the token) and returns to login; the write
 * toggle is hidden for student targets (read-only always).
 */
export function ImpersonationBanner() {
  const impersonation = useAuthStore((s) => s.impersonation);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setSession = useAuthStore((s) => s.setSession);
  const setImpersonation = useAuthStore((s) => s.setImpersonation);
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  if (!impersonation?.active) return null;

  const exit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Revoke the impersonation token server-side FIRST, while it is still the
      // active bearer — so the revoke lands on THAT token and never on the admin's
      // restored token (the race that used to force a re-login). Bounded so a
      // slow/dead network can't hang Exit; if it doesn't finish, the impersonation
      // token simply expires on its own (fail-closed).
      await Promise.race([
        stopImpersonation().catch(() => {}),
        new Promise<void>((resolve) => setTimeout(resolve, 5000)),
      ]);

      await setImpersonation(null);
      qc.clear();

      // If a super-admin started this from the in-app picker, restore their own
      // session — BOTH access and refresh token — so Exit returns to the picker and
      // the restored session can still refresh. Otherwise (QR hand-off) log out.
      const adminToken = await SecureStore.getItemAsync('imp_admin_token');
      if (adminToken) {
        const adminRefresh = await SecureStore.getItemAsync('imp_admin_refresh');
        const adminUserRaw = await SecureStore.getItemAsync('imp_admin_user');
        await SecureStore.deleteItemAsync('imp_admin_token');
        await SecureStore.deleteItemAsync('imp_admin_refresh');
        await SecureStore.deleteItemAsync('imp_admin_user');
        await setTokens(adminToken, adminRefresh ?? '');
        if (adminUserRaw) {
          const adminUser = JSON.parse(adminUserRaw);
          await setSession(adminUser, resolveRole(adminUser));
        }
        router.replace('/(admin)/impersonate' as Href);
      } else {
        await logout();
        router.replace('/(auth)/login');
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleWrite = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = !impersonation.write;
      await setImpersonationWrite(next);
      await setImpersonation({ ...impersonation, write: next });
    } catch {
      Alert.alert('تعذّر تغيير الوضع');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        backgroundColor: '#b91c1c',
        paddingTop: insets.top + 6,
        paddingBottom: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Text style={{ flex: 1, color: '#fff', fontFamily: fonts.bold, fontSize: 13 }} numberOfLines={1}>
        تتصفّح بحساب: {impersonation.name} · {impersonation.write ? 'كتابة' : 'قراءة فقط'}
      </Text>

      {role !== 'student' && (
        <TouchableOpacity
          onPress={toggleWrite}
          disabled={busy}
          style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 6 }}
        >
          <Text style={{ color: '#fff', fontFamily: fonts.medium, fontSize: 12 }}>
            {impersonation.write ? 'إيقاف الكتابة' : 'تفعيل الكتابة'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={exit}
        disabled={busy}
        style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fff', borderRadius: 6, minWidth: 52, alignItems: 'center' }}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#b91c1c" />
        ) : (
          <Text style={{ color: '#b91c1c', fontFamily: fonts.bold, fontSize: 12 }}>خروج</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
