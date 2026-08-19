import { View, Text, TouchableOpacity } from 'react-native';
import { colors, spacing, radius } from '@/theme/index';
import { fonts } from '@/theme/typography';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';

interface HeaderBrandBarProps {
  /** Tapping the notifications bell. */
  onBell: () => void;
  /** Unread count for the bell badge. */
  unread?: number;
  /** Logo height in px. */
  logoSize?: number;
}

/**
 * The shared top bar for every role's home hero: the brand logo on the visual
 * LEFT and the notifications bell on the visual RIGHT. The app is force-RTL, so a
 * plain `row` lays children right→left — the bell (first child) sits at the right,
 * the logo (last child) at the left, exactly as intended.
 */
export function HeaderBrandBar({ onBell, unread = 0, logoSize = 56 }: HeaderBrandBarProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
      {/* First child → visual RIGHT in RTL: the notifications bell. */}
      <TouchableOpacity
        onPress={onBell}
        accessibilityRole="button"
        style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' }}
      >
        <Icon name="bell" size={22} color="#fff" outline />
        {unread ? (
          <View style={{ position: 'absolute', top: 6, insetInlineEnd: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {/* Last child → visual LEFT in RTL: the transparent brand logo. */}
      <BrandMark size={logoSize} />
    </View>
  );
}
