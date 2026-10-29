import { useEffect, useState } from 'react';
import { I18nManager, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, shadows, spacing } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { arDigits } from '@/components/threads/format';
import type { CommunityAudience, CommunitySpace } from '@/api/community';

const PAD = 4;
const H = 58;
const SIDES: { audience: CommunityAudience; icon: IconName }[] = [
  { audience: 'students', icon: 'kids' },
  { audience: 'parents', icon: 'people' },
];

/**
 * The teacher reads TWO communities (founder 2026-10-29: «some love on the switcher of the
 * parents' and students' community»): two cards on one track — each with its face, its name,
 * how many members, and what is new — and a white card that slides to the one in front. It sits
 * on the hero under the brand-pill segments, so it is drawn the other way round (white on ink)
 * and never reads as a second copy of them. Transform-only spring.
 */
export function AudienceSwitch({ value, onChange, spaces }: { value: CommunityAudience; onChange: (a: CommunityAudience) => void; spaces: CommunitySpace[] }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const still = useReducedMotion();
  const index = Math.max(0, SIDES.findIndex((s) => s.audience === value));
  const slot = width > 0 ? (width - PAD * 2) / SIDES.length : 0;
  const x = useSharedValue(0);
  const dir = I18nManager.isRTL ? -1 : 1;
  useEffect(() => { x.value = still ? withTiming(index * slot * dir, { duration: 0 }) : withSpring(index * slot * dir, { damping: 20, stiffness: 230 }); }, [index, slot, dir, still]); // eslint-disable-line react-hooks/exhaustive-deps
  const card = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', padding: PAD, borderRadius: 20, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder }}
    >
      {slot > 0 ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: PAD, bottom: PAD, start: PAD, width: slot, borderRadius: 16, backgroundColor: colors.surface, ...shadows.sm }, card]} />
      ) : null}
      {SIDES.map(({ audience, icon }) => {
        const on = audience === value;
        const space = spaces.find((s) => s.audience === audience);
        const unread = space?.unread ?? 0;
        const name = t(audience === 'parents' ? 'community_space.audience_parents' : 'community_space.audience_students');
        const members = space ? t(audience === 'parents' ? 'community_space.members_parents' : 'community_space.members_students', { n: arDigits(space.members) }) : '';
        return (
          <Pressable
            key={audience}
            onPress={() => { if (!on) onChange(audience); }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={unread > 0 ? `${name} (${unread})` : name}
            style={{ flex: 1, height: H, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: 16, backgroundColor: slot > 0 || !on ? 'transparent' : colors.surface }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.brandTint : 'rgba(255,255,255,0.10)' }}>
              <Icon name={icon} size={19} color={on ? colors.brand : colors.onHero} outline={!on} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 20, color: on ? colors.textPrimary : colors.onHero }}>{name}</Text>
              {members ? <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 16, color: on ? colors.textSecondary : colors.onHeroSoft }}>{members}</Text> : null}
            </View>
            {unread > 0 ? (
              <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, flexDirection: 'row', direction: 'ltr', alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.brand : colors.danger }}>
                <Text style={{ fontSize: 11, fontWeight: '700', lineHeight: 17, height: 17, color: '#FFFFFF', textAlign: 'center', includeFontPadding: false }}>{unread > 99 ? '99+' : arDigits(unread)}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
