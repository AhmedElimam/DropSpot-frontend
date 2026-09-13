import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { useChatChannels } from '@/hooks/useChat';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { ChatRoomsList } from '@/components/chat/ChatRoomsList';
import { Icon } from '@/components/ui/Icon';

/**
 * The student's Chat tab — one room per enrolled course (membership is the roster, derived
 * server-side), newest activity first. A tab rather than a card on Home: this is meant to
 * replace the class WhatsApp group, and that is not something you reach through a dashboard.
 */
export default function StudentChatList() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { refetch } = useChatChannels();
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom, backgroundColor: colors.background, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + insets.top, paddingBottom: spacing.xl4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff', letterSpacing: -0.5 }}>{t('chat.title')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm }}>
            <Icon name="eye" size={15} color="rgba(255,255,255,0.7)" outline style={{ marginTop: 3 }} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.72)' }}>
              {t('chat.subtitle')}
            </Text>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadows.sm }}>
            <ChatRoomsList onOpen={(courseId) => router.push(`/(student)/chat/${courseId}` as Href)} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
