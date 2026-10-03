import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
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
import { ThemeRow } from '@/components/ThemeRow';
import { useQuery } from '@tanstack/react-query';
import { getMyCardStatus } from '@/api/profile';
import { PageHero } from '@/components/ui/PageHero';
import { avatarSeed } from '@/components/ui/GeneratedAvatar';

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
  // The phone QR is the card's own credential and exists ONLY once the card is in hand
  // (founder 2026-10-03: a fallback when the card is forgotten or lost — never a substitute
  // for a card that was not issued). Hidden behind a tap so it is not on screen by default.
  const qrValue = cardState === 'in_hand' ? card?.card_token ?? null : null;
  const [showQr, setShowQr] = useState(false);
  const cardTone = cardState === 'in_hand' ? { fg: colors.success, bg: colors.successLight, icon: 'success' as const }
    : cardState === 'preparing' ? { fg: colors.warning, bg: colors.warningLight, icon: 'clock' as const }
    : cardState === 'ordered' ? { fg: colors.brand, bg: colors.brandTint, icon: 'clock' as const }
    : { fg: colors.brand, bg: colors.brandTint, icon: 'invoices' as const };

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
        <PageHero title={user?.name ?? ''} avatar={avatarSeed.student(user?.student_id, avatarSeed.user(user?.id, user?.name ?? '?'))}>
        {/* The student code lives on the card below, where it belongs — it is card data, not profile data. */}
        <View style={{ alignSelf: 'flex-start', marginTop: spacing.md, backgroundColor: colors.onHeroChip, paddingVertical: spacing.xs, paddingHorizontal: spacing.lg, borderRadius: radius.full, borderWidth: 1, borderColor: colors.onHeroChipBorder }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.onHero }}>{t('profile.role_student')}</Text>
        </View>
        </PageHero>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4, gap: spacing.md }}>
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
              <View style={{ width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: cardTone.bg }}>
                <Icon name={cardTone.icon} size={28} color={cardTone.fg} />
              </View>

              <Text style={{ fontFamily: fonts.bold, fontSize: 16.5, color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }}>
                {cardState === 'in_hand' ? 'بطاقتك معك'
                  : cardState === 'preparing' ? 'بطاقتك قيد التجهيز'
                  : cardState === 'ordered' ? 'طلب بطاقتك قيد المراجعة'
                  : 'لا توجد بطاقة بعد'}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
                {cardState === 'in_hand'
                  ? 'استخدم بطاقتك لتسجيل الحضور. احملها معك في كل حصة، ولو فقدتها بلّغ معلّمك فورًا.'
                  : cardState === 'preparing'
                    ? 'تم اعتماد بطاقتك وهي قيد الطباعة. سجّل حضورك مع معلّمك حتى تستلمها.'
                    : cardState === 'ordered'
                      ? 'وصل طلبك وهو بانتظار اعتماد الإدارة. سنخبرك عند اعتماده، وحتى تصلك البطاقة سجّل حضورك مع معلّمك.'
                      : 'تسجيل الحضور يتم ببطاقة دروس سبوت. اطلب بطاقتك، وحتى تصلك سجّل حضورك مع معلّمك.'}
              </Text>

              {/* Where the order stands, in the admin's own words, so the student sees it move. */}
              {(cardState === 'ordered' || cardState === 'preparing') && card?.order_status_label ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, backgroundColor: cardTone.bg, borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: spacing.md }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: cardTone.fg }} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: cardTone.fg }}>{card.order_status_label}</Text>
                  {card.ordered_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>· {formatDate(new Date(card.ordered_at), { day: 'numeric', month: 'short' })}</Text> : null}
                </View>
              ) : null}
              {cardState === 'in_hand' && card?.card_released_at ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textTertiary, marginTop: spacing.sm }}>
                  استلمتها في {formatDate(new Date(card.card_released_at), { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              ) : null}

              {qrValue ? (
                <View style={{ alignSelf: 'stretch', marginTop: spacing.lg, alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => setShowQr((v) => !v)} activeOpacity={0.85} accessibilityRole="button"
                    style={{ alignSelf: 'stretch', minHeight: 46, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, backgroundColor: colors.brandTint, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
                    <Icon name="scan" size={18} color={colors.brand} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.brand }}>{showQr ? 'إخفاء رمز البطاقة' : 'نسيت بطاقتك؟ اعرض رمزها'}</Text>
                  </TouchableOpacity>
                  {showQr ? (
                    <>
                      {/* Scanners want dark modules on white whatever the app's scheme. */}
                      <View style={{ marginTop: spacing.md, backgroundColor: '#FFFFFF', padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border }}>
                        <QRCode value={qrValue} size={188} backgroundColor="#FFFFFF" color="#171C3B" />
                      </View>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.md }}>
                        هذا هو رمز بطاقتك نفسه — يمسحه المعلم عند الباب إن نسيت البطاقة أو فقدتها. لا تشاركه مع أحد.
                      </Text>
                    </>
                  ) : null}
                </View>
              ) : null}

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
                  <Icon name="add" size={17} color={colors.onPrimary} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onPrimary }}>اطلب بطاقتك</Text>
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
            <ThemeRow />
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
