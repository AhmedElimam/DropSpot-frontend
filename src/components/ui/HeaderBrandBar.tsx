import type { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, isRevisionTheme } from '@/theme/index';
import { fonts } from '@/theme/typography';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';
import { TourTarget } from '@/tour/TourTarget';
import { Surface } from '@/ui/surfaces';

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
  /** «ابحث في التطبيق» — the feature search (teacher / assistant home). */
  onSearch?: () => void;
  /**
   * When set, each button becomes a backend-switchable surface named `<prefix>.<bell|scan|search|brand>`
   * (the teacher home passes "teacher.header"). Absent: nothing is wrapped (student / parent homes).
   */
  surfacePrefix?: string;
  /** Beside the logo (teacher home: the «وضع المراجعة» switch chip). */
  beside?: ReactNode;
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
 * the logo (last child) at the left, exactly as intended. (The connection status lives
 * under each home's greeting — ConnectionLine.)
 */
export function HeaderBrandBar({ onBell, unread = 0, logoSize = 56, onScan, scanBadge = 0, onSearch, surfacePrefix, beside }: HeaderBrandBarProps) {
  const { t } = useTranslation();
  // Ids the teacher home declares (for scripts/list-surfaces.py):
  // <Surface id="teacher.header.bell"> <Surface id="teacher.header.scan"> <Surface id="teacher.header.search"> <Surface id="teacher.header.brand">
  const surface = (name: string, node: ReactNode) => (surfacePrefix ? <Surface id={`${surfacePrefix}.${name}`}>{node}</Surface> : node);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
      {/* First child → visual RIGHT in RTL: the notifications bell, then (optionally) the scanner. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {surface('bell', <TourTarget id="header:bell"><TouchableOpacity onPress={onBell} accessibilityRole="button" accessibilityLabel={t('misc_ui.notifications')} style={iconButton()}>
          <Icon name="bell" size={22} color={colors.onHero} outline />
          {unread ? <Badge count={unread} /> : null}
        </TouchableOpacity></TourTarget>)}
        {onScan ? surface('scan', (
          <TourTarget id="header:scan"><TouchableOpacity onPress={onScan} accessibilityRole="button" accessibilityLabel={t('misc_ui.camera')} style={iconButton()}>
            <Icon name="scan" size={22} color={colors.onHero} outline />
            {scanBadge ? <Badge count={scanBadge} /> : null}
          </TouchableOpacity></TourTarget>
        )) : null}
        {onSearch ? surface('search', (
          <TourTarget id="header:search"><TouchableOpacity onPress={onSearch} accessibilityRole="button" accessibilityLabel={t('misc_ui.search_app')} style={iconButton()}>
            <Icon name="search" size={21} color={colors.onHero} outline />
          </TouchableOpacity></TourTarget>
        )) : null}
      </View>

      {/* Last child → visual LEFT in RTL: the transparent brand logo, and what sits beside it.
          In «وضع المراجعة» the day hero is deep indigo, so the emblem takes the hero's white. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 }}>
        {beside}
        {surface('brand', <BrandMark size={beside ? Math.min(logoSize, 48) : logoSize} tint={isRevisionTheme() ? colors.onHero : undefined} />)}
      </View>
    </View>
  );
}
