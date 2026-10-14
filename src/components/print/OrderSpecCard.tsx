import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, gradients, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { OrderSection, OrderChip } from '@/components/print/OrderSection';
import type { PrintJob, PrintOptions } from '@/api/print';

type Tile = { icon: IconName; caption: string; value: string };

/** The spec as tiles: from the options' labels when they are here, else the job's own line. */
function specTiles(j: PrintJob, o: PrintOptions | undefined, t: (k: string) => string): Tile[] {
  if (!o) return j.spec_label ? [{ icon: 'print', caption: t('print.order_spec_word'), value: j.spec_label }] : [];
  const label = (list: { key: string; label: string }[] | undefined, key: string | number | undefined) =>
    key == null ? null : list?.find((c) => String(c.key) === String(key))?.label ?? null;
  const size = j.spec.size ?? 'A4';
  const out: Tile[] = [{ icon: 'document', caption: t('print.size'), value: label(o.sizes, size) ?? size }];
  const paper = label(o.papers, j.spec.paper);
  if (paper) out.push({ icon: 'empty', caption: t('print.paper'), value: paper });
  const ink = label(o.inks, j.spec.ink);
  if (ink) out.push({ icon: 'brush', caption: t('print.ink'), value: ink });
  const sides = label(o.sides, j.spec.sides);
  if (sides) out.push({ icon: 'transfer', caption: t('print.sides'), value: sides });
  if (j.spec.finish && j.spec.finish !== 'none') {
    const f = label(o.finishes, j.spec.finish);
    if (f) out.push({ icon: 'book', caption: t('print.finish'), value: f });
  }
  return out;
}

/** One number of the formula, with its unit under it; the result is filled navy. */
function Term({ n, unit, result }: { n: number; unit: string; result?: boolean }) {
  const fg = result ? colors.onPrimary : colors.textPrimary;
  return (
    <View style={{ flex: result ? 1.25 : 1, alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: 4, borderRadius: radius.lg,
      backgroundColor: result ? colors.brand : colors.surface, borderWidth: result ? 0 : 1, borderColor: colors.borderLight }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: result ? 22 : 19, lineHeight: result ? 30 : 27, color: fg }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {formatNumber(n)}
      </Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: fg, opacity: result ? 0.85 : 1 }} numberOfLines={1}>{unit}</Text>
    </View>
  );
}

function Op({ sign }: { sign: string }) {
  return <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.brand, opacity: 0.7, paddingHorizontal: 2 }}>{sign}</Text>;
}

/**
 * «المواصفة» (founder 2026-10-14: «needs some love»): the file as a document tile, the sum
 * spelled out — copies × pages = printed pages — the spec as a grid of small icon tiles,
 * then rush, the shop's extras and the course as chips.
 */
export function OrderSpecCard({ j, options }: { j: PrintJob; options: PrintOptions | undefined }) {
  const { t } = useTranslation();
  const tiles = specTiles(j, options, t);
  const chips: { text: string; icon: IconName; tone: 'accent' | 'brand' | 'plain' }[] = [];
  if (j.spec.rush) chips.push({ text: t('print.line_rush_plain'), icon: 'flash', tone: 'accent' });
  for (const x of j.extras ?? []) chips.push({ text: x.name, icon: 'add', tone: 'plain' });

  return (
    <OrderSection icon="document" title={t('print.order_spec_title')} tint={{ bg: colors.brandTint, fg: colors.brand }}>
      {/* The file */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: 48, height: 58, borderRadius: 10, borderTopEndRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="document" size={20} color={colors.onPrimary} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 9.5, color: colors.onPrimary, opacity: 0.9, marginTop: 1 }}>PDF</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 21, color: colors.textPrimary }} numberOfLines={2}>{j.file_name || j.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <Icon name="document" size={13} color={colors.textTertiary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{t('print.order_file_pages_n', { n: formatNumber(j.pages) })}</Text>
          </View>
        </View>
      </View>

      {/* The sum */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brandTint }}>
        <Term n={j.copies} unit={t('print.order_unit_copies')} />
        <Op sign="×" />
        <Term n={j.pages} unit={t('print.order_unit_pages')} />
        <Op sign="=" />
        <Term n={j.copies * j.pages} unit={t('print.order_unit_printed')} result />
      </View>

      {/* The spec */}
      {tiles.length ? (
        <>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textTertiary, marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('print.order_spec_word')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {tiles.map((x, i) => (
              <View key={i} style={{ flexBasis: tiles.length === 1 ? '100%' : tiles.length === 2 || tiles.length === 4 ? '46%' : '30%', flexGrow: 1, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderLight }}>
                <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                  <Icon name={x.icon} size={15} color={colors.brand} />
                </View>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }} numberOfLines={1}>{x.caption}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 19, color: colors.textPrimary }} numberOfLines={2}>{x.value}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {chips.length || j.course ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md }}>
          {chips.map((x, i) => <OrderChip key={i} text={x.text} icon={x.icon} tone={x.tone} />)}
          {j.course ? <OrderChip text={`${t('print.course')}: ${j.course.name}`} icon="sessions" tone="brand" /> : null}
        </View>
      ) : null}
    </OrderSection>
  );
}
