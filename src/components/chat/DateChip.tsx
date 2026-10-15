import { View, Text } from 'react-native';
import { fonts } from '@/theme/typography';
import { spacing, radius, shadows } from '@/theme/index';
import { chat } from '@/theme/chat';
import { formatDayDate, relativeDay } from '@/utils/format';

/**
 * «اليوم» / «أمس» / the full date between days — what makes a long scroll navigable without
 * a timestamp on every row. A plain surface pill in the product's own chrome.
 */
export function DateChip({ date }: { date: string }) {
  const label = relativeDay(date) ?? formatDayDate(date);
  if (!label) return null;

  return (
    <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
      <View
        style={{
          backgroundColor: chat.chipBg,
          borderWidth: 1,
          borderColor: chat.chipBorder,
          borderRadius: radius.full,
          paddingHorizontal: spacing.md,
          paddingVertical: 5,
          ...shadows.sm,
        }}
      >
        <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: chat.chipText }}>{label}</Text>
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
