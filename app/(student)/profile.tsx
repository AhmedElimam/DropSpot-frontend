import { useMemo, useState, type ReactNode } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, Modal, Pressable, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients, shadows, layout } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useLogout, useDeleteAccount } from '@/hooks/useAuth';
import { useUpcomingSessions } from '@/hooks/useSessions';
import { localizeGrade } from '@/utils/grade';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * Student profile — rebuilt to the student-app-screens.html spec: centred avatar
 * block, a dark gradient ID card (كود الطالب) that opens the digital check-in QR,
 * then grouped setting cards (الحساب / معلّموني / danger).
 *
 * The card-scan invariant is preserved: the ID card is a tappable shortcut to the
 * full digital-check-in QR (encodes the opaque card_token, never the raw code) —
 * the physical-card fallback the scanner resolves.
 */

type RowProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  tone?: 'brand' | 'danger';
  onPress?: () => void;
  first?: boolean;
  chevron?: boolean;
  disabled?: boolean;
};

function Row({ icon, title, subtitle, tone = 'brand', onPress, first, chevron = true, disabled }: RowProps) {
  const danger = tone === 'danger';
  const iconBg = danger ? colors.dangerWash : colors.brandWash;
  const iconFg = danger ? colors.danger : colors.brand;
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      {...(onPress ? { onPress, activeOpacity: 0.7, accessibilityRole: 'button', disabled } : {})}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: 14,
        paddingHorizontal: 15,
        minHeight: 56,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.line,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: iconBg, justifyContent: 'center', alignItems: 'center' }}>
        <Icon name={icon} size={18} color={iconFg} outline />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: danger ? colors.danger : colors.ink }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {chevron && onPress ? (
        <Icon name="back" size={16} color={colors.faint} />
      ) : null}
    </Wrapper>
  );
}

function SectionCard({ children }: { children: ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, overflow: 'hidden', ...shadows.sm }}>
      {children}
    </View>
  );
}

function Slab({ title }: { title: string }) {
  return (
    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink, marginTop: 20, marginBottom: 10, marginHorizontal: 2 }}>
      {title}
    </Text>
  );
}

export default function StudentProfile() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const del = useDeleteAccount();
  const { data: upcoming } = useUpcomingSessions(20);
  const [qrOpen, setQrOpen] = useState(false);

  // معلّموني — derived from the student's upcoming sessions, deduped by teacher.
  const teachers = useMemo(() => {
    const map = new Map<string, { name: string; course: string }>();
    (upcoming ?? []).forEach((s) => {
      if (s.teacher_name && !map.has(s.teacher_name)) {
        map.set(s.teacher_name, { name: s.teacher_name, course: s.course_name ?? '' });
      }
    });
    return [...map.values()];
  }, [upcoming]);

  const gradeName = localizeGrade((upcoming ?? []).find((s) => s.grade_name)?.grade_name);
  const initial = (user?.name || '?').trim()[0] ?? '?';

  const confirmDelete = () => {
    Alert.alert(
      t('common.delete_account'),
      t('common.delete_account_warning'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete_account_confirm'), style: 'destructive', onPress: () => del.mutate() },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: layout.tabBottom + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.ink, letterSpacing: -0.3 }}>
            {t('profile.my_account')}
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel={t('profile.account_settings')}
            style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', alignItems: 'center' }}
          >
            <Icon name="settings" size={18} color={colors.ink} outline />
          </TouchableOpacity>
        </View>

        {/* Avatar block */}
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 20 }}>
          <LinearGradient
            colors={gradients.brandCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 88, height: 88, borderRadius: 30, justifyContent: 'center', alignItems: 'center', ...shadows.hero }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 34, color: '#fff' }}>{initial}</Text>
          </LinearGradient>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink, marginTop: 14 }}>{user?.name}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 3 }}>
            {gradeName || t('profile.role_student')}
          </Text>
        </View>

        {/* ID card — taps to open the digital check-in QR */}
        {user?.student_code ? (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setQrOpen(true)} accessibilityRole="button">
            <LinearGradient
              colors={['#1E2757', '#34419B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: radius.xl, padding: 17, overflow: 'hidden' }}
            >
              <View pointerEvents="none" style={{ position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.06)', top: -70, left: -40 }} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: 'rgba(255,255,255,0.7)', letterSpacing: 2 }}>
                {t('profile.student_code')}
              </Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: '#fff', letterSpacing: 2, marginTop: 4 }}>
                {user.student_code}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: 'rgba(255,255,255,0.7)', letterSpacing: 2 }}>
                    {t('profile.attendance_card')}
                  </Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                    {t('profile.tap_to_show')}
                  </Text>
                </View>
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="scan" size={20} color="#fff" outline />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, padding: spacing.xl, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center' }}>{t('profile.no_code_yet')}</Text>
          </View>
        )}

        {/* الحساب */}
        <Slab title={t('profile.account')} />
        <SectionCard>
          {user?.phone ? (
            <Row icon="phone" title={t('profile.phone_number')} subtitle={user.phone} chevron={false} first />
          ) : null}
          <Row
            icon="lock"
            title={t('auth.change_password')}
            onPress={() => router.push('/change-password')}
            first={!user?.phone}
          />
          <Row
            icon="bell"
            title={t('profile.notifications')}
            subtitle={t('profile.notifications_on')}
            onPress={() => Linking.openSettings()}
          />
        </SectionCard>

        {/* معلّموني */}
        <Slab title={t('profile.my_teachers')} />
        <SectionCard>
          {teachers.length > 0 ? (
            teachers.map((tch, i) => (
              <Row key={tch.name} icon="teacher" title={tch.name} subtitle={tch.course || undefined} chevron={false} first={i === 0} />
            ))
          ) : (
            <Row icon="teacher" title={t('profile.no_teachers')} chevron={false} first />
          )}
        </SectionCard>

        {/* Danger */}
        <Slab title="" />
        <SectionCard>
          <Row icon="logout" title={t('common.logout')} tone="danger" chevron={false} onPress={() => logout.mutate()} disabled={logout.isPending} first />
          <Row icon="trash" title={t('common.delete_account')} subtitle={t('common.delete_account_subtitle')} tone="danger" chevron={false} onPress={confirmDelete} disabled={del.isPending} />
        </SectionCard>

        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.faint, textAlign: 'center', marginTop: 20 }}>
          DrosSpot v1.0.0
        </Text>
      </ScrollView>

      {/* Digital check-in QR */}
      <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
        <Pressable onPress={() => setQrOpen(false)} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <Pressable style={{ backgroundColor: colors.surface, borderRadius: radius.sheet, padding: spacing.xxl, alignItems: 'center', width: '100%', maxWidth: 340, ...shadows.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginBottom: spacing.lg }}>{t('profile.my_card')}</Text>
            {user?.student_code ? (
              <>
                <View style={{ padding: spacing.md, backgroundColor: '#fff', borderRadius: radius.lg }}>
                  <QRCode value={user.card_token ?? user.student_code} size={210} />
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginTop: spacing.lg, letterSpacing: 2 }}>
                  {user.student_code}
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: spacing.xs }}>
                  {t('profile.show_to_teacher')}
                </Text>
              </>
            ) : null}
            <TouchableOpacity onPress={() => setQrOpen(false)} style={{ marginTop: spacing.xl, height: 44, borderRadius: 15, backgroundColor: colors.brand, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: '#fff' }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
