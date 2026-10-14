import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

/** Binding and finishing — drawn in their own section (ShopFinishes), so not repeated here. */
export const FINISH_CAPS = ['staple', 'spiral', 'glue', 'punch', 'laminate', 'cover'];

const ICON: Record<string, IconName> = {
  color: 'brush', color_hq: 'image', duplex: 'transfer', a5: 'document', a3: 'document',
  glossy: 'flash', heavy: 'book', special_paper: 'card',
  rush: 'flash', bulk: 'pricetag', delivery: 'delivery', extras: 'add',
  staple: 'attendance', spiral: 'refresh', glue: 'book', punch: 'shapeCircle', laminate: 'shield', cover: 'book',
};
const GROUPS: { key: string; caps: string[] }[] = [
  { key: 'print', caps: ['color', 'color_hq', 'duplex', 'a5', 'a3'] },
  { key: 'paper', caps: ['glossy', 'heavy', 'special_paper'] },
  { key: 'finish', caps: FINISH_CAPS },
  { key: 'service', caps: ['rush', 'bulk', 'delivery', 'extras'] },
];

/**
 * «تقدر تطبع» (founder 2026-10-14: «some love on تقدر تطبع»): what the shop can do, in the
 * groups a teacher thinks in — the printing, the paper, the service — each a row of small
 * tiles with a coloured mark, colour drawn as the four inks. The shop's own note sits under
 * it as a quote from the shop. Binding is left to its own drawn section when `skipFinishes`.
 */
export function ShopCapabilities({ caps, labels, notes, skipFinishes }: { caps: string[]; labels: Record<string, string>; notes?: string | null; skipFinishes?: boolean }) {
  const { t } = useTranslation();
  const tint: Record<string, { bg: string; fg: string }> = {
    print: { bg: colors.brandTint, fg: colors.brand },
    paper: { bg: colors.accentLight, fg: colors.accentText },
    finish: { bg: colors.warningLight, fg: colors.warningText },
    service: { bg: colors.successLight, fg: colors.successText },
  };
  const known = new Set(GROUPS.flatMap((g) => g.caps));
  const unknown = caps.filter((c) => !known.has(c));
  const groups = GROUPS
    .filter((g) => !(skipFinishes && g.key === 'finish'))
    .map((g) => ({ ...g, caps: [...g.caps.filter((c) => caps.includes(c)), ...(g.key === 'service' ? unknown : [])] }))
    .filter((g) => g.caps.length);

  return (
    <View>
      {groups.map((g, gi) => (
        <View key={g.key} style={{ marginTop: gi === 0 ? 0 : spacing.md }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textTertiary, marginBottom: 6 }}>{t(`print.caps_group_${g.key}`)}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {g.caps.map((c) => (
              <View key={c} style={{ flexBasis: '46%', flexGrow: 1, maxWidth: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 10, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderLight }}>
                {c === 'color' || c === 'color_hq' ? <Inks /> : (
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: tint[g.key]?.bg ?? colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={ICON[c] ?? 'success'} size={14} color={tint[g.key]?.fg ?? colors.textSecondary} />
                  </View>
                )}
                <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }} numberOfLines={2}>{labels[c] ?? c}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      {notes ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: groups.length ? spacing.md : 0, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandTint, borderStartWidth: 3, borderStartColor: colors.brand }}>
          <Icon name="storefront" size={16} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.brand, marginBottom: 2 }}>{t('print.caps_from_shop')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textPrimary }}>{notes}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Colour, drawn as the four inks — cyan, magenta, yellow, black — overlapping. */
export function Inks() {
  const dot = (bg: string, top: number, start: number) => (
    <View style={{ position: 'absolute', top, start, width: 14, height: 14, borderRadius: 7, backgroundColor: bg, opacity: 0.9, ...shadows.sm }} />
  );
  return (
    <View style={{ width: 28, height: 28 }}>
      {dot('#00AEEF', 1, 1)}
      {dot('#EC008C', 1, 13)}
      {dot('#FFD400', 13, 1)}
      {dot('#231F20', 13, 13)}
    </View>
  );
}
