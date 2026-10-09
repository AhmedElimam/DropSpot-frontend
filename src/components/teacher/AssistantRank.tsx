import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing, FadeIn, ZoomIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming,
} from 'react-native-reanimated';
import { fonts } from '@/theme/typography';
import { Icon } from '@/components/ui/Icon';
import type { AssistantRank } from '@/utils/assistantRank';

const GOLD = '#C9A227';

/** The rank as a small pill: its stars and its title, in its metal. Pops when the rank changes. */
export function RankBadge({ rank, size = 'sm' }: { rank: AssistantRank; size?: 'sm' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <Animated.View key={rank.key} entering={ZoomIn.springify().damping(14)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: lg ? 8 : 5, alignSelf: 'flex-start', paddingHorizontal: lg ? 14 : 9, paddingVertical: lg ? 7 : 3, borderRadius: 999, backgroundColor: rank.tint, borderWidth: 1, borderColor: rank.color + '66' }}>
      {rank.level > 0 ? (
        <View style={{ flexDirection: 'row', gap: 1 }}>
          {Array.from({ length: rank.level }, (_, i) => <Icon key={i} name="star" size={lg ? 14 : 10} color={rank.color} />)}
        </View>
      ) : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: lg ? 15 : 11.5, color: rank.color }}>{rank.title}</Text>
    </Animated.View>
  );
}

/**
 * The moment a teacher recruits (founder 2026-10-09): the new assistant's name and number in
 * the middle, two gold lines drawing in from both edges to meet them, then the rank their
 * permissions earn, star by star. A tap — or three and a half seconds — and it is gone.
 */
export function RecruitCelebration({ who, onDone }: {
  who: { name: string; phone: string | null; rank: AssistantRank; invited: boolean } | null;
  onDone: () => void;
}) {
  const still = useReducedMotion();
  const lines = useSharedValue(0);
  const pop = useSharedValue(0);
  const words = useSharedValue(0);

  useEffect(() => {
    if (!who) return;
    lines.value = 0; pop.value = 0; words.value = 0;
    const ease = Easing.out(Easing.cubic);
    lines.value = still ? 1 : withTiming(1, { duration: 620, easing: ease });
    pop.value = still ? 1 : withDelay(380, withSpring(1, { damping: 11, stiffness: 150 }));
    words.value = still ? 1 : withDelay(560, withTiming(1, { duration: 420, easing: ease }));
    const t = setTimeout(onDone, 3600);
    return () => clearTimeout(t);
  }, [who, still, lines, pop, words, onDone]);

  // Each line grows from its own edge toward the name.
  const fromStart = useAnimatedStyle(() => ({ transform: [{ scaleX: lines.value }], opacity: lines.value }));
  const circle = useAnimatedStyle(() => ({ transform: [{ scale: 0.4 + 0.6 * pop.value }], opacity: pop.value }));
  const text = useAnimatedStyle(() => ({ opacity: words.value, transform: [{ translateY: (1 - words.value) * 14 }] }));

  if (!who) return null;
  const initials = who.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(' ');

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, { zIndex: 50 }]}>
      <Pressable onPress={onDone} accessibilityRole="button" accessibilityLabel={`${who.name} — ${who.rank.title}`}
        style={{ flex: 1, backgroundColor: 'rgba(10,14,39,0.97)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <Animated.Text style={[{ fontFamily: fonts.bold, fontSize: 14, color: GOLD, letterSpacing: 0.3, marginBottom: 22 }, text]}>
          {who.invited ? 'الدعوة في الطريق إلى فريقك' : 'انضمّ إلى فريقك'}
        </Animated.Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
          <Animated.View style={[{ flex: 1, height: 2, backgroundColor: GOLD, transformOrigin: 'right' }, fromStart]} />
          <Animated.View style={[{ width: 92, height: 92, borderRadius: 46, marginHorizontal: 14, backgroundColor: '#34419B', borderWidth: 3, borderColor: GOLD, alignItems: 'center', justifyContent: 'center' }, circle]}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: '#FFFFFF' }}>{initials}</Text>
          </Animated.View>
          <Animated.View style={[{ flex: 1, height: 2, backgroundColor: GOLD, transformOrigin: 'left' }, fromStart]} />
        </View>

        <Animated.View style={[{ alignItems: 'center', marginTop: 22 }, text]}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#FFFFFF', textAlign: 'center' }} numberOfLines={2}>{who.name}</Text>
          {who.phone ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: 'rgba(242,239,230,0.74)', marginTop: 6, writingDirection: 'ltr' }}>
              {who.phone}
            </Text>
          ) : null}
          <View style={{ marginTop: 18 }}>
            <RankBadge rank={{ ...who.rank, color: who.rank.key === 'right_hand' ? GOLD : who.rank.color, tint: 'rgba(255,255,255,0.08)' }} size="lg" />
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(242,239,230,0.6)', marginTop: 14, textAlign: 'center' }}>
            رتبته من صلاحياته — تتغيّر كلما منحته أو سحبت منه صلاحية.
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
