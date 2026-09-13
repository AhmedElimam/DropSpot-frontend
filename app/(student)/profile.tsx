import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav, gradients } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/hooks/useAuth';
import { useCoverageStats } from '@/hooks/useAttendance';
import { useQuizzes } from '@/hooks/useQuizzes';
import { formatDate } from '@/utils/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';
import { SupportContact } from '@/components/SupportContact';
import { useQuery } from '@tanstack/react-query';
import { getMyCardStatus } from '@/api/profile';

/** The gold rule the printed card carries — the one mark this screen borrows. */
const GOLD = '#C9A227';

export default function StudentProfile() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { data: coverage, refetch: refetchCoverage } = useCoverageStats();
  const { data: quizzes, refetch: refetchQuizzes } = useQuizzes();
  // Live, not the cached login payload — that can be weeks old on a device that has
  // not signed in since, and the card's state changes without the student doing anything.
  const { data: card, refetch: refetchCard } = useQuery({ queryKey: ['my-card'], queryFn: getMyCardStatus, staleTime: 60_000 });
  const { refreshing, onRefresh } = usePullRefresh(refetchCoverage, refetchQuizzes, refetchCard);
  const cardState = card?.card_state ?? user?.card_state ?? 'none';

  const sessionsAttended = coverage ? coverage.present + coverage.late : 0;
  const now = new Date();
  const quizzesCompleted = (quizzes ?? []).filter(
    (q) => !q.is_active || (q.ends_at ? new Date(q.ends_at) < now : false)
  ).length;
  const attendanceRate = coverage && coverage.total > 0
    ? Math.round(((coverage.present + coverage.late) / coverage.total) * 100)
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.bottomHeight + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl5, alignItems: 'center' }}
        >
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)', marginBottom: spacing.md }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 36, color: '#fff' }}>{(user?.name || '?')[0]}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{user?.name}</Text>
          {/* The student code lives on the card below, where it belongs — it is card
              data, not profile data, and printing it twice on one screen said nothing. */}
          <View style={{ marginTop: spacing.md, backgroundColor: 'rgba(255,255,255,0.18)', paddingVertical: spacing.xs, paddingHorizontal: spacing.lg, borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#fff' }}>{t('profile.role_student')}</Text>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg, gap: spacing.md }}>
          {/* The card block.
              There is NO in-app QR (founder 2026-09-05). The printed card is the only
              scannable credential — handing every student a free digital one undercut the
              card the platform sells. So this screen states where their card stands and,
              when they have none, offers the one action that changes that.

              Light on purpose: the hero above is already a deep-ink gradient, and a second
              dark slab under it read as one heavy mass. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm, overflow: 'hidden' }}>
            <View style={{ height: 3, backgroundColor: cardState === 'in_hand' ? colors.success : GOLD }} />
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <View style={{ width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                backgroundColor: cardState === 'in_hand' ? colors.successLight
                  : cardState === 'preparing' ? colors.warningLight : colors.brandTint }}>
                <Icon
                  name={cardState === 'in_hand' ? 'success' : cardState === 'preparing' ? 'clock' : 'invoices'}
                  size={28}
                  color={cardState === 'in_hand' ? colors.success : cardState === 'preparing' ? colors.warning : colors.brand}
                />
              </View>

              <Text style={{ fontFamily: fonts.bold, fontSize: 16.5, color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }}>
                {cardState === 'in_hand' ? 'بطاقتك معك'
                  : cardState === 'preparing' ? 'بطاقتك قيد التجهيز'
                  : 'لا توجد بطاقة بعد'}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
                {cardState === 'in_hand'
                  ? 'استخدم بطاقتك لتسجيل الحضور. احملها معك في كل حصة، ولو فقدتها بلّغ معلّمك فورًا.'
                  : cardState === 'preparing'
                    ? 'تم اعتماد بطاقتك وهي قيد الطباعة. سجّل حضورك مع معلّمك حتى تستلمها.'
                    : 'تسجيل الحضور يتم ببطاقة دروس سبوت. اطلب بطاقتك، وحتى تصلك سجّل حضورك مع معلّمك.'}
              </Text>

              {user?.student_code ? (
                <View style={{ marginTop: spacing.lg, paddingVertical: 6, paddingHorizontal: spacing.lg, borderRadius: radius.full, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, letterSpacing: 3 }}>{user.student_code}</Text>
                </View>
              ) : null}

              {cardState === 'none' ? (
                <TouchableOpacity
                  onPress={() => router.push('/(student)/order-card' as Href)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  style={{ marginTop: spacing.lg, alignSelf: 'stretch', minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}
                >
                  <Icon name="add" size={17} color="#fff" />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>اطلب بطاقتك</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <Text style={[textPresets.label, { marginBottom: spacing.md, color: colors.textTertiary }]}>
              {t('profile.account')}
            </Text>
            {/* «تأكيد رقم هاتفي» — the way IN to verification now that nothing forces it.
                The automatic wall is off (no SMS is spent on people who never asked), so
                without a row like this the resend button would exist on a screen no one
                could reach. Hidden once the number is proved. */}
            {user?.own_number_verified === false ? (
              <TouchableOpacity
                onPress={() => router.push('/verify-own-number' as Href)}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: spacing.md }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.warningLight, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                  <Icon name="call" size={20} color={colors.warningText} outline />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={textPresets.body}>{t('profile.verify_number')}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>
                    {t('profile.verify_number_hint')}
                  </Text>
                </View>
                <Icon name="back" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => router.push('/notification-preferences' as Href)}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: spacing.md }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                <Icon name="bell" size={20} color={colors.primary} outline />
              </View>
              <Text style={[textPresets.body, { flex: 1 }]}>{t('profile.notifications')}</Text>
              <Icon name="back" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/request-name-correction' as Href)}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                <Icon name="note" size={20} color={colors.primary} outline />
              </View>
              <Text style={[textPresets.body, { flex: 1 }]}>طلب تصحيح الاسم</Text>
              <Icon name="back" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/change-password')}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                <Icon name="lock" size={20} color={colors.primary} outline />
              </View>
              <Text style={[textPresets.body, { flex: 1 }]}>{t('auth.change_password')}</Text>
              <Icon name="back" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
            {/* Tier C — the identity fields a student can never self-edit. Shown as a plain
                note (not a dead control) so the lock is legible and points to the teacher. */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
              <Icon name="lock" size={16} color={colors.textTertiary} outline />
              <Text style={[textPresets.caption, { flex: 1, lineHeight: 18 }]}>
                الكود والصف ورقم ولي الأمر يديرها معلّمك. لتغيير أيٍّ منها، تواصل مع معلّمك.
              </Text>
            </View>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <Text style={[textPresets.label, { marginBottom: spacing.md, color: colors.textTertiary }]}>
              {t('profile.account_info')}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
              <Text style={textPresets.bodySmall}>{t('profile.member_since')}</Text>
              <Text style={[textPresets.bodySmall, { fontFamily: fonts.medium, color: colors.textPrimary }]}>
                {user?.created_at ? formatDate(new Date(user.created_at), { month: 'long', year: 'numeric' }) : '-'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
              <Text style={textPresets.bodySmall}>{t('profile.sessions_attended')}</Text>
              <Text style={[textPresets.bodySmall, { fontFamily: fonts.medium, color: colors.textPrimary }]}>{sessionsAttended}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
              <Text style={textPresets.bodySmall}>{t('profile.quizzes_completed')}</Text>
              <Text style={[textPresets.bodySmall, { fontFamily: fonts.medium, color: colors.textPrimary }]}>{quizzesCompleted}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
              <Text style={textPresets.bodySmall}>{t('attendance.attendance_rate')}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>{attendanceRate}%</Text>
            </View>
          </View>

          <View style={{ marginBottom: spacing.md }}>
            <SupportContact href={'/(student)/support' as Href} />
          </View>

          <TouchableOpacity onPress={() => logout.mutate()} activeOpacity={0.85} style={{ borderRadius: radius.md, overflow: 'hidden' }}>
            <LinearGradient colors={[colors.dangerDark, colors.danger]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ minHeight: 52, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="logout" size={20} color="#fff" outline />
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('common.logout')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <DeleteAccountButton />

          <Text style={[textPresets.caption, { textAlign: 'center', marginTop: spacing.md }]}>DrosSpot v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}
