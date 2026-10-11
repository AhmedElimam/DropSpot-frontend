import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { Alert } from '@/ui/dialog';
import { ScrollView } from '@/components/ui/Refreshable';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { SelectField } from '@/components/ui/SelectField';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { PageHero } from '@/components/ui/PageHero';
import {
  getSupportCategories, getMyAdminTickets, createAdminTicket, type AdminTicket,
} from '@/api/adminTickets';
import { Surface } from '@/ui/surfaces';

const MIN_MESSAGE = 20;

/**
 * The family-facing Resolution Center (parent + student): pick a reason, write the
 * problem, and it lands in the admins' queue as a real ticket they can work and answer.
 *
 * This replaced "here is our email address and phone number" (founder 2026-09-05). A
 * mail draft leaves no record on either side; a ticket has a status the sender can watch,
 * which is why the sent list lives on the same screen rather than behind another tap.
 *
 * There is no subject field on purpose: the chosen reason becomes the title, so sending a
 * problem is a pick and a sentence.
 */
export function SupportCenter({ title }: { title: string }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [category, setCategory] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const categories = useQuery({ queryKey: ['support-categories'], queryFn: getSupportCategories });
  const tickets = useQuery({ queryKey: ['my-admin-tickets'], queryFn: getMyAdminTickets });
  const { refreshing, onRefresh } = usePullRefresh(tickets.refetch, categories.refetch);

  const remaining = MIN_MESSAGE - message.trim().length;
  const canSend = !!category && remaining <= 0 && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await createAdminTicket({ category: category!, message: message.trim() });
      setMessage('');
      setCategory(null);
      qc.invalidateQueries({ queryKey: ['my-admin-tickets'] });
      Alert.alert('', t('family_ui.support_sent_body'));
    } catch {
      Alert.alert(t('common.error'), t('family_ui.support_send_failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Surface id="screen.family.support" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Surface id="family.support.hero"><PageHero title={title} onBack={true} compact /></Surface>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <Surface id="family.support.compose_card">
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.xs }}>{t('family_ui.contact_admin')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.lg }}>
              {t('family_ui.support_intro')}
            </Text>

            <Surface id="family.support.reason_select">
            <SelectField
              label={t('resolution.ticket_reason')}
              placeholder={categories.isLoading ? t('family_ui.support_loading') : t('resolution.ticket_reason_ph')}
              value={category}
              options={categories.data ?? []}
              onChange={setCategory}
              emptyHint={t('family_ui.support_categories_empty')}
            />
            </Surface>

            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.lg, marginBottom: spacing.xs }}>{t('support.message')}</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              placeholder={t('family_ui.support_message_ph')}
              placeholderTextColor={colors.textTertiary}
              style={{
                backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
                padding: spacing.md, minHeight: 120, fontFamily: fonts.regular, fontSize: 15, lineHeight: 24,
                color: colors.textPrimary, textAlign: 'right', textAlignVertical: 'top',
              }}
            />
            {remaining > 0 && message.length > 0 ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: spacing.xs }}>
                {t('family_ui.support_min_chars', { count: remaining })}
              </Text>
            ) : null}

            {/* Enabled-but-validated would be kinder here, but the two rules are visible
                above the button (a reason, and a long-enough message), so a disabled
                button never leaves the sender guessing what is missing. */}
            <Surface id="family.support.send_button">
            <TouchableOpacity
              onPress={send}
              disabled={!canSend}
              activeOpacity={0.85}
              style={{
                minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.primary,
                justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg,
                opacity: canSend ? 1 : 0.5,
              }}
            >
              {sending ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('family_ui.support_send')}</Text>
              )}
            </TouchableOpacity>
            </Surface>
          </View>
          </Surface>

          <Surface id="family.support.my_messages">
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.xl, marginBottom: spacing.sm }}>{t('family_ui.support_my_messages')}</Text>

          {tickets.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : !(tickets.data ?? []).length ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary }}>{t('family_ui.support_no_messages')}</Text>
          ) : (
            (tickets.data ?? []).map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)
          )}
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
    </Surface>
  );
}

function TicketRow({ ticket }: { ticket: AdminTicket }) {
  const { t } = useTranslation();
  const resolved = ticket.status === 'resolved';

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>
          {ticket.category_label ?? ticket.subject}
        </Text>
        <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, backgroundColor: (resolved ? colors.success : colors.warning) + '20' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, lineHeight: 16, color: resolved ? colors.success : colors.warning }}>
            {resolved ? t('support.status_resolved') : t('complaints.status_pending')}
          </Text>
        </View>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }} numberOfLines={3}>{ticket.message}</Text>
      <Surface id="family.support.admin_reply">
      {ticket.admin_note ? (
        <View style={{ marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textTertiary, marginBottom: 2 }}>{t('family_ui.support_admin_reply')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textPrimary }}>{ticket.admin_note}</Text>
        </View>
      ) : null}
      </Surface>
    </View>
  );
}
