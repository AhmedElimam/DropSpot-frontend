import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Alert } from '@/ui/dialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { useAuthStore } from '@/stores/authStore';
import { setImpersonationWrite } from '@/api/impersonation';

/**
 * Persistent, impossible-to-miss banner shown on every screen while a super-admin
 * impersonation session is active on this device. Renders nothing otherwise.
 * "Exit" ends the session (revokes the token) and returns to login; the write
 * toggle is hidden for student targets (read-only always).
 */
export function ImpersonationBanner() {
  const impersonation = useAuthStore((s) => s.impersonation);
  const role = useAuthStore((s) => s.role);
  const leaveImpersonation = useAuthStore((s) => s.leaveImpersonation);
  const setImpersonation = useAuthStore((s) => s.setImpersonation);
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  if (!impersonation?.active) return null;

  // One call: the store revokes the token, restores the admin (or signs out) in a single
  // step, and the root watcher routes and clears the cache. This screen does neither — it
  // used to, racing the API client's own "session over" path into a crash (2026-09-29).
  const exit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await leaveImpersonation();
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
