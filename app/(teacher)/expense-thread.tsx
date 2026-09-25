import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { fonts } from '@/theme/typography';
import { formatDateTime, formatShortDate, formatNumber } from '@/utils/format';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { getExpenseThread, replyToThread } from '@/api/cash';

/**
 * The question thread on one expense (weekly review §7). Two-way: the teacher asks, the
 * assistant answers — optionally with a receipt photo — and the thread stays attached to
 * the expense permanently. Answering never decides anything: the item stays «عليه سؤال»
 * until the teacher accepts or rejects it. Only the teacher and the expense's own
 * assistant can open it (server-enforced).
 */
export default function ExpenseThreadScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eid = Number(id);
  const { data, isLoading } = useQuery({ queryKey: ['expense-thread', eid], queryFn: () => getExpenseThread(eid), enabled: eid > 0 });
  const [body, setBody] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => replyToThread(eid, body.trim(), imageUri),
    onSuccess: (res) => {
      qc.setQueryData(['expense-thread', eid], res);
      qc.invalidateQueries({ queryKey: ['cash-review'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      setBody(''); setImageUri(null);
    },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) setImageUri(res.assets[0].uri);
  };

  const e = data?.expense;
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('review.question_title')}</Text>
          {e ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{formatNumber(e.amount, { maximumFractionDigits: 2 })} {t('insights.egp')} · {e.category_label} · {formatShortDate(e.expense_date)}</Text> : null}
        </View>
      </View>

      {isLoading || !data ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
          {e?.note ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>{e.note}</Text> : null}
          {data.messages.map((m) => (
            <View key={m.id} style={{ alignSelf: m.is_me ? 'flex-start' : 'flex-end', maxWidth: '85%', backgroundColor: m.is_me ? colors.brand + '14' : colors.surface, borderWidth: 1, borderColor: m.is_me ? colors.brand + '33' : colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textTertiary }}>{m.author}</Text>
              {m.body ? <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, marginTop: 2, lineHeight: 22 }}>{m.body}</Text> : null}
              {m.attachment_url ? (
                <Image source={{ uri: m.attachment_url }} style={{ width: 220, height: 220, borderRadius: radius.md, marginTop: spacing.sm, backgroundColor: colors.surfaceSunken }} contentFit="cover" cachePolicy="none" />
              ) : null}
              {m.created_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>{formatDateTime(m.created_at)}</Text> : null}
            </View>
          ))}

          {data.can_reply ? (
            <View style={{ marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginBottom: 6 }}>{t('review.reply_title')}</Text>
              <TextInput value={body} onChangeText={setBody} multiline maxLength={1000} placeholder={t('review.reply_placeholder')} placeholderTextColor={colors.textTertiary}
                style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'right', minHeight: 64 }} />
              <TouchableOpacity onPress={pick} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
                <Icon name="download" size={16} color={colors.brand} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{imageUri ? t('review.attached') : t('review.attach')}</Text>
              </TouchableOpacity>
              <Button title={t('review.reply_send')} onPress={() => send.mutate()} disabled={body.trim() === '' && !imageUri} loading={send.isPending} style={{ marginTop: spacing.sm }} />
            </View>
          ) : (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: spacing.md, textAlign: 'center' }}>{t('review.no_reply')}</Text>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
