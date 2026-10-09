import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { formatTime } from '@/utils/format';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { deleteActions, requeueAction, type OutboxAction } from '@/db/outbox';
import { syncNow } from '@/db/autoSync';
import { uuid } from '@/utils/uuid';

function hhmm(iso: string): string {
  try {
    return formatTime(iso);
  } catch {
    return '—';
  }
}

function Row({ a, children }: { a: OutboxAction; children?: React.ReactNode }) {
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{a.label}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{hhmm(a.created_at)}</Text>
      </View>
      {a.last_error ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.dangerText, marginTop: 4 }}>{a.last_error}</Text> : null}
      {children}
    </View>
  );
}

/**
 * Actions taken with no connection, waiting to be sent in order (src/db/outbox.ts). They go
 * on their own when the connection returns; «إرسال الآن» is for the person who wants to watch.
 */
export function PendingActionsSection({ actions, onChange }: { actions: OutboxAction[]; onChange: () => Promise<void> }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await syncNow(); await onChange(); } finally { setBusy(false); }
  };
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.primary, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <Icon name="refresh" size={20} color={colors.primary} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.primary }}>{t('offline.actions_title', { count: actions.length })}</Text>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>{t('offline.actions_hint')}</Text>
      <View style={{ gap: spacing.sm }}>
        {actions.map((a) => <Row key={a.id} a={a} />)}
      </View>
      <TouchableOpacity onPress={send} disabled={busy} activeOpacity={0.8} accessibilityRole="button"
        style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }}>
        {busy ? <ActivityIndicator color={colors.textInverse} /> : <Icon name="send" size={16} color={colors.textInverse} />}
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textInverse }}>{t('offline.sync_now')}</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Actions the server refused on replay: parked for a decision like rejected scans — retry or drop. */
export function RejectedActionsSection({ actions, onChange }: { actions: OutboxAction[]; onChange: () => Promise<void> }) {
  const { t } = useTranslation();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.danger, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <Icon name="error" size={20} color={colors.dangerText} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.dangerText }}>{t('offline.rejected_actions_title', { count: actions.length })}</Text>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>{t('offline.rejected_actions_hint')}</Text>
      <View style={{ gap: spacing.sm }}>
        {actions.map((a) => (
          <Row key={a.id} a={a}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <TouchableOpacity onPress={async () => { await requeueAction(a.id, uuid()); await onChange(); }} activeOpacity={0.8}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary }}>
                <Icon name="refresh" size={16} color={colors.primary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>{t('teacher.rejected_requeue')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => { await deleteActions([a.id]); await onChange(); }} activeOpacity={0.8}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border }}>
                <Icon name="trash" size={16} color={colors.textSecondary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{t('teacher.rejected_dismiss')}</Text>
              </TouchableOpacity>
            </View>
          </Row>
        ))}
      </View>
    </View>
  );
}
