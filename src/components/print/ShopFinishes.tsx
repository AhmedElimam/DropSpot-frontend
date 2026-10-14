import { View, Text } from 'react-native';
import Svg, { Rect, Line, Circle, Path, Ellipse } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { formatNumber } from '@/utils/format';
import type { MenuFinish } from '@/api/print';

/** The copies the hint line prices — a usual class size. */
const EXAMPLE_COPIES = 50;

/**
 * «التجليد (لكل نسخة)» (founder 2026-10-14: «some love on التجليد لكل نسخة»): each binding the
 * shop offers as a card with a small drawing of it — the staple in the corner, the spiral's
 * rings, the glued spine, the punched holes, the laminate's shine, the coloured cover — its
 * name, and what it adds to every copy, the lowest marked «الأوفر». Under them one line of
 * arithmetic a teacher can feel: «٥٠ نسخة سلك = ١٢٥ ج».
 */
export function ShopFinishes({ finishes, label, egp }: { finishes: MenuFinish[]; label: (k: string) => string; egp: string }) {
  const { t } = useTranslation();
  const list = finishes.filter((f) => f.kind !== 'none');
  if (!list.length) return null;
  const low = Math.min(...list.map((f) => f.price_per_copy));
  const lowCount = list.filter((f) => f.price_per_copy === low).length;
  const n2 = (v: number) => formatNumber(v, { maximumFractionDigits: 2 });
  const example = list.find((f) => f.kind === 'spiral') ?? list[0];

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {list.map((f) => {
          const best = list.length > 1 && f.price_per_copy === low && lowCount === 1;
          return (
            <View key={f.kind} style={{ flexBasis: '46%', flexGrow: 1, maxWidth: '50%', borderRadius: radius.lg, borderWidth: best ? 1.5 : 1, borderColor: best ? colors.success : colors.borderLight, backgroundColor: colors.surfaceSunken, padding: spacing.sm, alignItems: 'center' }}>
              {best ? (
                <View style={{ position: 'absolute', top: 6, end: 6, paddingHorizontal: 7, height: 20, borderRadius: 10, backgroundColor: colors.successLight, justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.successText }}>{t('print.finish_best')}</Text>
                </View>
              ) : null}
              <View style={{ width: 72, height: 60, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                <BindingArt kind={f.kind} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginTop: 8 }} numberOfLines={1}>{label(f.kind)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 2 }}>
                {f.price_per_copy > 0 ? (
                  <>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: best ? colors.successText : colors.brand }}>+{n2(f.price_per_copy)}</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>{t('print.finish_unit', { egp })}</Text>
                  </>
                ) : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.successText }}>{t('print.finish_free')}</Text>}
              </View>
            </View>
          );
        })}
      </View>
      {example.price_per_copy > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.brandTint }}>
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.brand, lineHeight: 18 }}>
            {t('print.finish_example', { n: formatNumber(EXAMPLE_COPIES), f: label(example.kind), total: n2(example.price_per_copy * EXAMPLE_COPIES), egp })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** A small drawing of a bound copy: a stack of sheets, then what this binding does to it (spine on the right). */
export function BindingArt({ kind, size = 56 }: { kind: string; size?: number }) {
  const paper = colors.surface;
  const edge = colors.border;
  const ink = colors.textTertiary;
  const metal = colors.textSecondary;
  const gold = colors.accent;
  const brand = colors.brand;
  // a stack of three sheets, the top one with text lines
  const stack = (
    <>
      <Rect x={14} y={12} width={34} height={42} rx={3} fill={paper} stroke={edge} strokeWidth={1.5} />
      <Rect x={11} y={9} width={34} height={42} rx={3} fill={paper} stroke={edge} strokeWidth={1.5} />
      <Rect x={8} y={6} width={34} height={42} rx={3} fill={paper} stroke={edge} strokeWidth={1.5} />
      {[16, 22, 28, 34].map((y) => <Line key={y} x1={14} y1={y} x2={y === 34 ? 28 : 36} y2={y} stroke={ink} strokeWidth={2} strokeLinecap="round" opacity={0.45} />)}
    </>
  );
  // Arabic books are bound on the right: the drawing is mirrored so the spine sits there.
  return (
    <View style={{ transform: [{ scaleX: -1 }] }}>
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {kind === 'cover' ? (
        <>
          <Rect x={14} y={12} width={34} height={42} rx={3} fill={paper} stroke={edge} strokeWidth={1.5} />
          <Rect x={8} y={6} width={36} height={44} rx={3} fill={gold} />
          <Rect x={14} y={14} width={24} height={6} rx={2} fill="#fff" opacity={0.9} />
          <Line x1={14} y1={26} x2={32} y2={26} stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
          <Rect x={8} y={6} width={5} height={44} rx={2} fill="#000" opacity={0.12} />
        </>
      ) : kind === 'glue' ? (
        <>
          {stack}
          {/* the glued spine down the start edge */}
          <Rect x={4} y={5} width={8} height={46} rx={2} fill={brand} />
          <Line x1={8} y1={9} x2={8} y2={47} stroke="#fff" strokeWidth={1} opacity={0.35} />
        </>
      ) : (
        <>
          {stack}
          {kind === 'staple' ? (
            <Path d="M11 15 L19 9" stroke={metal} strokeWidth={3} strokeLinecap="round" />
          ) : null}
          {kind === 'spiral' ? (
            <>
              <Rect x={6} y={6} width={4} height={42} fill={paper} />
              {[10, 16, 22, 28, 34, 40, 46].map((y) => <Ellipse key={y} cx={8} cy={y} rx={4.5} ry={2.2} fill="none" stroke={metal} strokeWidth={1.8} />)}
            </>
          ) : null}
          {kind === 'punch' ? (
            <>
              {[14, 27, 40].map((y) => <Circle key={y} cx={12} cy={y} r={2.6} fill={colors.surfaceSunken} stroke={edge} strokeWidth={1.2} />)}
            </>
          ) : null}
          {kind === 'laminate' ? (
            <>
              <Rect x={5} y={3} width={40} height={48} rx={5} fill="#8FD3FF" opacity={0.22} stroke="#5BB8F0" strokeWidth={1.4} />
              <Path d="M30 6 L42 6 L18 48 L6 48 Z" fill="#fff" opacity={0.45} />
            </>
          ) : null}
        </>
      )}
    </Svg>
    </View>
  );
}
