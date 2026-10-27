import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetModal } from '@/components/ui/SheetModal';
import { Field, Input, Chips } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { openTicketWithParent } from '@/api/tickets';
import type { StudentParent } from '@/api/students';
import { getFriendlyErrorMessage } from '@/utils/errors';

/**
 * From the student page: the teacher (or an assistant) opens a ticket with the student's parent
 * (founder 2026-10-21). The parent answers in the app; the status stays the teacher's to set. A
 * parent who never activated gets one SMS with the activation link, so the closing alert says
 * which way it went.
 */
export function OpenTicketSheet({ visible, onClose, studentId, studentName, parents }: {
  visible: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
  parents: StudentParent[];
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [parentId, setParentId] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Fresh each opening; the primary parent is picked unless the teacher chooses another.
  useEffect(() => {
    if (!visible) return;
    setParentId((parents.find((p) => p.is_primary) ?? parents[0])?.id ?? null);
    setSubject('');
    setMessage('');
  }, [visible, parents]);

  const canSend = subject.trim().length > 0 && message.trim().length > 0 && !busy;

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      const r = await openTicketWithParent({ student_id: studentId, parent_id: parentId ?? undefined, subject: subject.trim(), description: message.trim() });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      onClose();
      Alert.alert(
        t('tickets.opened_title'),
        t(r.parent_reached_by === 'sms' ? 'tickets.opened_by_sms' : 'tickets.opened_in_app', { name: r.parent_name ?? studentName }),
        [
          { text: t('common.ok'), style: 'cancel' },
          { text: t('tickets.open_ticket'), onPress: () => router.push(`/(teacher)/tickets/${r.id}` as Href) },
        ],
      );
    } catch (e) {
      Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetModal visible={visible} onClose={() => !busy && onClose()} avoidKeyboard style={{ backgroundColor: colors.background, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <Icon name="tickets" size={20} color={colors.brand} />
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('tickets.open_with_parent')}</Text>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.md }}>
        {t('tickets.open_with_parent_hint', { name: studentName })}
      </Text>

      {parents.length > 1 ? (
        <Field label={t('tickets.to_parent')} first>
          <Chips options={parents.map((p) => ({ key: p.id, label: p.name ?? '—' }))} value={parentId} onChange={setParentId} />
        </Field>
      ) : null}
      <Field label={t('tickets.subject')} required first={parents.length <= 1}>
        <Input value={subject} onChangeText={setSubject} placeholder={t('tickets.subject_placeholder')} maxLength={255} />
      </Field>
      <Field label={t('tickets.message')} required>
        <Input value={message} onChangeText={setMessage} placeholder={t('tickets.message_placeholder')} multiline maxLength={5000} />
      </Field>

      <TouchableOpacity onPress={send} disabled={!canSend} activeOpacity={0.85} accessibilityRole="button"
        style={{ marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, opacity: canSend ? 1 : 0.5 }}>
        {busy ? <ActivityIndicator color="#fff" /> : <Icon name="send" size={18} color="#fff" />}
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('tickets.submit')}</Text>
      </TouchableOpacity>
    </SheetModal>
  );
}
