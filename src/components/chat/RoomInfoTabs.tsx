import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import type { ChatMediaType } from '@/api/chat';

export type RoomInfoTab = 'members' | ChatMediaType;

/**
 * The room page's tabs: the members, then the shelf (photos, files, voice notes, links), each
 * with its count. Five fixed tabs, each written out — a row that scrolls sideways on a narrow
 * phone; the rows under it are the page's windowed list (ChatRoomInfoScreen.tsx).
 */
export function RoomInfoTabs({ value, onChange, counts }: {
  value: RoomInfoTab;
  onChange: (tab: RoomInfoTab) => void;
  counts: { members: number; media: number; files: number; voice: number; links: number };
}) {
  const { t } = useTranslation();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
      <TabChip id="members" icon="people" label={t('chat.tab_members')} n={counts.members} value={value} onChange={onChange} />
      <TabChip id="media" icon="image" label={t('chat.tab_media')} n={counts.media} value={value} onChange={onChange} />
      <TabChip id="files" icon="attach" label={t('chat.tab_files')} n={counts.files} value={value} onChange={onChange} />
      <TabChip id="voice" icon="mic" label={t('chat.tab_voice')} n={counts.voice} value={value} onChange={onChange} />
      <TabChip id="links" icon="link" label={t('chat.tab_links')} n={counts.links} value={value} onChange={onChange} />
    </ScrollView>
  );
}

function TabChip({ id, icon, label, n, value, onChange }: { id: RoomInfoTab; icon: IconName; label: string; n: number; value: RoomInfoTab; onChange: (tab: RoomInfoTab) => void }) {
  const on = value === id;
  return (
    <TouchableOpacity onPress={() => onChange(id)} accessibilityRole="tab" accessibilityState={{ selected: on }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.border }}>
      <Icon name={icon} size={15} color={on ? '#fff' : colors.textSecondary} outline={!on} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? '#fff' : colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: on ? 'rgba(255,255,255,0.8)' : colors.textTertiary }}>{formatNumber(n)}</Text>
    </TouchableOpacity>
  );
}
