import type { ReactNode } from 'react';
import { View, Text, RefreshControl } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { useChatChannels } from '@/hooks/useChat';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { ChatRoomsList } from '@/components/chat/ChatRoomsList';
import { Icon, type IconName } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';
import type { ChatChannelSummary } from '@/api/chat';
import type { RoomId } from '@/chat/room';

const isParentsRoom = (c: ChatChannelSummary) => c.audience === 'parents';

/**
 * «مجتمعنا» once the chat is open (founder 2026-10-12, delivering the coming-soon promise):
 *
 *  - **مجموعات أولياء الأمور** — per course a child is in, the teacher and the parents
 *    talking. The parent writes here; no student is in it;
 *  - **مجموعات أبنائي** — each child's course room, followed: everything the class reads,
 *    nothing to write.
 *
 * The parents' rooms lead: they are the parent's own conversations; the followed rooms are
 * for looking in.
 */
export function ParentRooms() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: channels, refetch } = useChatChannels();
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const open = (room: RoomId) => router.push(`/(parent)/chat/${room}` as Href);
  const unread = (pick: (c: ChatChannelSummary) => boolean) => (channels ?? []).filter(pick).reduce((n, c) => n + (c.unread || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.background, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xl4, paddingHorizontal: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, alignItems: 'center', justifyContent: 'center' }}>
              <BrandMark size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.onHero, letterSpacing: -0.5 }}>{t('community.title')}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20, color: colors.onHeroSoft }}>{t('community.tagline')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl, gap: spacing.xl }}>
          <Section icon="children" title={t('community.parents_rooms')} sub={t('community.parents_rooms_sub')} badge={unread(isParentsRoom)}>
            <ChatRoomsList onOpen={open} filter={isParentsRoom} emptyTitle={t('community.no_rooms')} emptyBody={t('community.no_rooms_body')} />
          </Section>
          <Section icon="eye" title={t('community.children_rooms')} sub={t('community.children_rooms_sub')} badge={unread((c) => !isParentsRoom(c))}>
            <ChatRoomsList onOpen={open} filter={(c) => !isParentsRoom(c)} emptyTitle={t('community.no_rooms')} emptyBody={t('community.no_rooms_body')} />
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ icon, title, sub, badge, children }: { icon: IconName; title: string; sub: string; badge: number; children: ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', ...shadows.sm }}>
          <Icon name={icon} size={17} color={colors.brand} outline={icon === 'eye'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{title}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textTertiary }}>{sub}</Text>
        </View>
        {badge > 0 ? (
          <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.onPrimary }}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadows.sm }}>
        {children}
      </View>
    </View>
  );
}
