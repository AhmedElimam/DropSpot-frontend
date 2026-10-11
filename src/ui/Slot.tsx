import { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAppConfigStore } from '@/stores/appConfigStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { useAuthStore } from '@/stores/authStore';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { fonts } from '@/theme/typography';
import { evaluateCondition } from './conditions';
import { surfaceContext } from './surfaces';
import { runPopupAction } from './serverPopup';
import type { UiBlock, UiPopupButton, UiTone } from '@/config/defaults';

/**
 * A SLOT is a place a screen leaves open for UI the BACKEND adds (server config/mobile_ui.php
 * → `slots`, served in /app-config as `ui.slots`). Nothing shows until backend code puts a
 * block there; then a notice, a card with buttons, or a button appears at the next foreground —
 * no store release, no OTA. Ids are listed in docs/MOBILE_SLOTS.md (scripts/list-surfaces.py).
 *
 *   <Slot id="teacher.home.top" />
 *   <Slot id="teacher.student_profile.bottom" ctx={{ student }} />
 *
 * A block's `when` is evaluated on the phone against what the app knows (role, online, the
 * assistant's abilities) plus the screen's `ctx`, like a surface condition. A block with an
 * `id` is switched off by `hidden` as `<slot>#<id>`. Buttons run the same actions as popup
 * buttons, including `api:` — so a whole new feature can be an endpoint plus a block.
 */
export function resolveSlot(id: string, ctx: Record<string, unknown> | undefined, ui: { slots?: Record<string, UiBlock[]>; hidden?: string[] } | undefined, online: boolean, role: string | null): UiBlock[] {
  const blocks = ui?.slots?.[id];
  if (!Array.isArray(blocks) || !blocks.length) return [];
  const hidden = ui?.hidden ?? [];
  if (hidden.includes(id)) return [];
  const scope = { ...surfaceContext(), online, role, ...(ctx ?? {}) };
  return blocks.filter((b) => {
    if (!b || typeof b !== 'object' || !['notice', 'card', 'button'].includes(b.type)) return false;
    if (b.id && hidden.includes(`${id}#${b.id}`)) return false;
    if (b.when && evaluateCondition(b.when, scope) === false) return false;
    return true;
  });
}

export function useSlot(id: string, ctx?: Record<string, unknown>): UiBlock[] {
  const ui = useAppConfigStore((s) => s.config.ui);
  const online = useOfflineStore((s) => s.online);
  const role = useAuthStore((s) => s.role);
  return resolveSlot(id, ctx, ui, online, role);
}

const TONE: Record<UiTone, () => { bg: string; fg: string; border: string; icon: IconName }> = {
  info: () => ({ bg: colors.infoLight, fg: colors.infoText, border: colors.info, icon: 'info' }),
  success: () => ({ bg: colors.successLight, fg: colors.successText, border: colors.success, icon: 'success' }),
  warning: () => ({ bg: colors.warningLight, fg: colors.warningText, border: colors.warning, icon: 'warning' }),
  danger: () => ({ bg: colors.dangerLight, fg: colors.dangerText, border: colors.danger, icon: 'error' }),
  brand: () => ({ bg: colors.brandTint, fg: colors.brandDeep, border: colors.brand, icon: 'info' }),
};

function tone(b: UiBlock) {
  return (TONE[b.tone ?? 'info'] ?? TONE.info)();
}

function BlockButton({ b, primary }: { b: UiPopupButton; primary: boolean }) {
  const destructive = b.style === 'destructive';
  const fg = destructive ? colors.dangerText : primary ? colors.textInverse : colors.primary;
  const bg = destructive ? colors.dangerLight : primary ? colors.primary : 'transparent';
  return (
    <TouchableOpacity onPress={() => runPopupAction(b.action, b)} activeOpacity={0.8} accessibilityRole="button"
      style={{ flex: 1, minHeight: 44, borderRadius: radius.md, backgroundColor: bg, borderWidth: primary || destructive ? 0 : 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: fg }} numberOfLines={1}>{b.label}</Text>
    </TouchableOpacity>
  );
}

function Notice({ b }: { b: UiBlock }) {
  const t = tone(b);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: t.bg, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderWidth: 1, borderColor: t.border }}>
      <Icon name={(b.icon as IconName) || t.icon} size={18} color={t.fg} />
      <View style={{ flex: 1 }}>
        {b.title ? <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: t.fg }}>{b.title}</Text> : null}
        {b.body ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: t.fg }}>{b.body}</Text> : null}
      </View>
      {b.buttons?.[0] ? (
        <TouchableOpacity onPress={() => runPopupAction(b.buttons![0].action, b.buttons![0])} hitSlop={8} accessibilityRole="button" style={{ minHeight: 32, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: t.fg, textDecorationLine: 'underline' }}>{b.buttons[0].label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function CardBlock({ b }: { b: UiBlock }) {
  const t = tone(b);
  const rose = b.persona === 'rose';
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={rose ? 'teacher' : ((b.icon as IconName) || t.icon)} size={18} color={t.fg} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{b.title}</Text>
      </View>
      {b.body ? <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: spacing.sm }}>{b.body}</Text> : null}
      {b.buttons?.length ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          {b.buttons.slice(0, 3).map((btn, i) => <BlockButton key={`${btn.label}-${i}`} b={btn} primary={i === 0 && btn.style !== 'cancel'} />)}
        </View>
      ) : null}
    </View>
  );
}

function Block({ b }: { b: UiBlock }) {
  if (b.type === 'notice') return <Notice b={b} />;
  if (b.type === 'card') return <CardBlock b={b} />;
  const btn = b.buttons?.[0];
  if (!btn) return null;
  return <View style={{ flexDirection: 'row' }}><BlockButton b={btn} primary={btn.style !== 'cancel'} /></View>;
}

export const Slot = memo(function Slot({ id, ctx, style }: { id: string; ctx?: Record<string, unknown>; style?: { marginTop?: number; marginBottom?: number; marginHorizontal?: number } }) {
  const blocks = useSlot(id, ctx);
  if (!blocks.length) return null;
  return (
    <View style={{ gap: spacing.sm, ...style }}>
      {blocks.map((b, i) => <Block key={`${b.id ?? b.type}-${i}`} b={b} />)}
    </View>
  );
});
