import { View, Text, TouchableOpacity } from 'react-native';
import { colors, spacing, radius } from '@/theme/index';
import { fonts } from '@/theme/typography';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';
import { TourTarget } from '@/tour/TourTarget';

interface HeaderBrandBarProps {
  /** Tapping the notifications bell. */
  onBell: () => void;
  /** Unread count for the bell badge. */
  unread?: number;
  /** Logo height in px. */
  logoSize?: number;
  /**
   * Optional QR / attendance-scanner button beside the bell (teacher + assistant home).
   * The scanner used to be a tab; it now lives here so the bar keeps fewer, clearer tabs.
   */
  onScan?: () => void;
  /** Badge on the scanner button: offline scans waiting to sync or to be decided. */
  scanBadge?: number;
}

// A function, not a constant: the hero tokens change with the scheme (light: ink on mist,
// dark: white on navy) and a module-level object would keep the values of first import.
const iconButton = () => ({ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, justifyContent: 'center', alignItems: 'center' } as const);

function Badge({ count }: { count: number }) {
  return (
    <View style={{ position: 'absolute', top: 6, insetInlineEnd: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

/**
 * The shared top bar for every role's home hero: the brand logo on the visual
 * LEFT and the notifications bell on the visual RIGHT. The app is force-RTL, so a
 * plain `row` lays children right→left — the bell (first child) sits at the right,
 * the logo (last child) at the left, exactly as intended.
 */
export function HeaderBrandBar({ onBell, unread = 0, logoSize = 56, onScan, scanBadge = 0 }: HeaderBrandBarProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
      {/* First child → visual RIGHT in RTL: the notifications bell, then (optionally) the scanner. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TourTarget id="header:bell"><TouchableOpacity onPress={onBell} accessibilityRole="button" accessibilityLabel="الإشعارات" style={iconButton()}>
          <Icon name="bell" size={22} color={colors.onHero} outline />
          {unread ? <Badge count={unread} /> : null}
        </TouchableOpacity></TourTarget>
        {onScan ? (
          <TourTarget id="header:scan"><TouchableOpacity onPress={onScan} accessibilityRole="button" accessibilityLabel="الكاميرا" style={iconButton()}>
            <Icon name="scan" size={22} color={colors.onHero} outline />
            {scanBadge ? <Badge count={scanBadge} /> : null}
          </TouchableOpacity></TourTarget>
        ) : null}
      </View>

      {/* Last child → visual LEFT in RTL: the transparent brand logo. */}
      <BrandMark size={logoSize} />
    </View>
  );
}
