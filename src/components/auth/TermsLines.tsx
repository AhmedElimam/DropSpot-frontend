import { Text, View } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';

/**
 * The clauses of an agreement, as the two consent windows draw them. A document's handful of
 * paragraphs (written by us, a few lines each) — not a list of records, so they are laid out
 * whole inside the window's own scroller rather than windowed.
 */

/** A feature agreement's clauses: numbered, on one card (FeatureTermsPrompt). */
export function NumberedClauses({ lines }: { lines: string[] }) {
  return (
    <View style={{ marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md }}>
      {lines.map((line, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{(i + 1).toLocaleString('ar-EG')}</Text>
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 23, color: colors.textPrimary }}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

/** «ما الجديد» in an updated agreement: one bullet per change (TermsUpdateModal). */
export function BulletLines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, marginTop: 8 }} />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 22, color: colors.textSecondary, textAlign: 'right' }}>{line}</Text>
        </View>
      ))}
    </>
  );
}
