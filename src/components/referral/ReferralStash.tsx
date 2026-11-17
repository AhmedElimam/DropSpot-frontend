import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Surface } from '@/ui/surfaces';
import { Alert } from '@/ui/dialog';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { formatNumber } from '@/utils/format';
import { useActivateReferralReward } from '@/hooks/useReferral';
import { referralReward, referralStash, type ReferralInfo, type ReferralReward } from '@/api/referral';
import { activateConfirmText, stashRowLabels } from './stash';

/** Rows shown before «عرض الكل». */
const PREVIEW = 5;

/**
 * «مخزن كروت QR» (founder 2026-11-17): every invited teacher who activates earns the inviter a
 * batch of free teacher QR cards. A batch waits here with no expiry until «فعّلها الآن»; then it
 * is made and printed, and valid for a year from that day. The page around it scrolls, so the
 * rows are a non-scrolling FlatList, the first few shown until «عرض الكل».
 */
export function ReferralStash({ info, card }: { info: ReferralInfo; card: ViewStyle }) {
  const { t } = useTranslation();
  const reward = referralReward(info);
  const rows = referralStash(info);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rows : rows.slice(0, PREVIEW);
  const activate = useActivateReferralReward();
  const [busyId, setBusyId] = useState<number | null>(null);

  const confirm = (item: ReferralReward) => {
    if (activate.isPending) return;
    Alert.alert(t('referral.activate_title'), activateConfirmText(item, reward.months, t, new Date(), reward.cards), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('referral.activate_now'),
        onPress: () => {
          setBusyId(item.id);
          activate.mutate(item.id, {
            onSuccess: (res) => Alert.alert(t('referral.activated_title'), res.message || t('referral.activated_body')),
            onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
            onSettled: () => setBusyId(null),
          });
        },
      },
    ]);
  };

  return (
    <Surface id="teacher.referral.stash">
    <View style={card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="scan" size={19} color={colors.brand} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('referral.stash_title')}</Text>
      </View>

      {rows.length === 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: spacing.md }}>
          {t('referral.stash_empty', { n: formatNumber(reward.cards, { maximumFractionDigits: 0 }) })}
        </Text>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => String(r.id)}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          initialNumToRender={PREVIEW}
          maxToRenderPerBatch={10}
          windowSize={5}
          style={{ marginTop: spacing.md }}
          ItemSeparatorComponent={Gap}
          renderItem={({ item }) => (
            <StashRow item={item} fallbackCards={reward.cards} busy={busyId === item.id} disabled={activate.isPending} onActivate={() => confirm(item)} />
          )}
        />
      )}

      {!showAll && rows.length > PREVIEW ? (
        <TouchableOpacity onPress={() => setShowAll(true)} style={{ paddingTop: spacing.md, alignItems: 'center' }} accessibilityRole="button">
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('referral.stash_show_all', { n: formatNumber(rows.length) })}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
    </Surface>
  );
}

function Gap() {
  return <View style={{ height: spacing.sm }} />;
}

function StashRow({ item, fallbackCards, busy, disabled, onActivate }: {
  item: ReferralReward; fallbackCards: number; busy: boolean; disabled: boolean; onActivate: () => void;
}) {
  const { t } = useTranslation();
  const l = stashRowLabels(item, t, fallbackCards);
  const waiting = l.tone === 'waiting';
  const badgeBg = l.tone === 'delivered' ? colors.successLight : colors.warningLight;
  const badgeInk = l.tone === 'delivered' ? colors.successText : colors.warningText;

  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: waiting ? colors.brand : colors.borderLight, backgroundColor: waiting ? colors.brandTint : colors.surfaceSunken, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={waiting ? 'gift' : 'card'} size={20} color={waiting ? colors.brand : colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{l.title}</Text>
          {l.sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{l.sub}</Text> : null}
        </View>
        {l.badge ? (
          <View style={{ borderRadius: radius.full, backgroundColor: badgeBg, paddingHorizontal: spacing.sm, paddingVertical: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: badgeInk }}>{l.badge}</Text>
          </View>
        ) : null}
      </View>
      {l.validity ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
          <Icon name="success" size={15} color={colors.successText} />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{l.validity}</Text>
        </View>
      ) : null}
      {waiting ? (
        <TouchableOpacity onPress={onActivate} disabled={disabled} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${t('referral.activate_now')} — ${l.title}`}
          style={{ marginTop: spacing.md, minHeight: 46, borderRadius: radius.lg, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, opacity: disabled && !busy ? 0.6 : 1 }}>
          {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="unlock" size={17} color={colors.onPrimary} />}
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onPrimary }}>{t('referral.activate_now')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
