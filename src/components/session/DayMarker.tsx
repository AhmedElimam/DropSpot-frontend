import { memo } from 'react';
import { View, Text } from 'react-native';
import { fonts } from '@/theme/typography';
import { formatNumber } from '@/utils/format';
import { PHASE_DOT, PHASE_COUNT, dotPhases } from '@/utils/sessionDays';
import type { SessionPhase } from '@/utils/sessionPhase';

/**
 * The marker under a day: one dot per session coloured by where it stands (up to three),
 * and from four sessions the count instead, so a busy day never reads as a quiet one.
 */
export const DayMarker = memo(function DayMarker({ phases, tone, selected }: { phases?: SessionPhase[]; tone: 'light' | 'dark'; selected?: boolean }) {
  const list = dotPhases(phases);
  const palette = PHASE_DOT()[selected ? 'light' : tone];
  if (list.length > 3) {
    const [bg, fg] = PHASE_COUNT()[selected ? 'light' : tone][list[0]];
    return (
      <View style={{ height: 15, minWidth: 19, paddingHorizontal: 4, borderRadius: 8, marginTop: 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 10, lineHeight: 14, color: fg }}>{formatNumber(list.length)}</Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 3, height: 14, alignItems: 'center', marginTop: 2 }}>
      {list.map((p, i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette[p] }} />)}
    </View>
  );
});
