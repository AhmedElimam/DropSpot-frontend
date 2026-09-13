import { View, Text } from 'react-native';
import { fonts } from '@/theme/typography';
import { spacing, radius } from '@/theme/index';
import { chat } from '@/theme/chat';
import { formatDayDate, relativeDay } from '@/utils/format';

/**
 * «اليوم» / «أمس» / the full date — the floating pill every chat app puts between days. It
 * is what makes a long scroll navigable without timestamps on every row.
 */
export function DateChip({ date }: { date: string }) {
  const label = relativeDay(date) ?? formatDayDate(date);
  if (!label) return null;

  return (
    <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
      <View
        style={{
          backgroundColor: chat.chip,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 4,
          shadowColor: '#000',
          shadowOpacity: 0.07,
          shadowRadius: 1,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        }}
      >
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: chat.chipText }}>{label}</Text>
      </View>
    </View>
  );
}

/** True when two messages fall on different calendar days (→ a chip goes between them). */
export function isNewDay(previous: string | undefined, current: string): boolean {
  if (!previous) return true;
  const a = new Date(previous);
  const b = new Date(current);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return a.getFullYear() !== b.getFullYear() || a.getMonth() !== b.getMonth() || a.getDate() !== b.getDate();
}
