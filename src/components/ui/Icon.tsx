import { memo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { colors } from '@/theme/index';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Semantic icon names → Ionicons. Screens never reference raw glyph names,
 * so the whole app can swap an icon in one place. No emojis in UI.
 */
const ICON_MAP = {
  home: 'home',
  children: 'people',
  child: 'person',
  teacher: 'school',
  tickets: 'chatbubbles',
  ticket: 'chatbubble-ellipses',
  invoices: 'card',
  reports: 'stats-chart',
  settings: 'settings',
  profile: 'person-circle',
  bell: 'notifications',
  call: 'call',
  location: 'location',
  calendar: 'calendar',
  sessions: 'calendar-number',
  /** A lesson in progress — the sessions tab (founder 2026-10-03: not the numbered calendar). */
  lesson: 'easel',
  /** The parent's أبنائي centre tab (founder 2026-10-03: not the generic two-heads icon). */
  kids: 'happy',
  clock: 'time',
  quiz: 'document-text',
  chat: 'chatbubbles',
  grades: 'ribbon',
  attendance: 'checkmark-circle',
  present: 'checkmark-circle',
  absent: 'close-circle',
  late: 'time',
  excused: 'information-circle',
  card: 'id-card',
  scan: 'qr-code',
  send: 'send',
  transfer: 'swap-horizontal',
  add: 'add',
  // Direction glyphs. NOTE the names are historical and read backwards: screens use
  // `back` for a ROW's disclosure chevron and `forward` for the HEADER back button.
  // RTL convention (founder 2026-10-04, reversing the 10-03 swap — «arrows look reversed»):
  // the header back button points RIGHT (`forward` → chevron-forward) and a row's
  // disclosure points LEFT (`back` → chevron-back). The week navigators rely on this too
  // (previous week on the right, pointing right). Change here, never per screen.
  back: 'chevron-back',
  forward: 'chevron-forward',
  down: 'chevron-down',
  up: 'chevron-up',
  search: 'search',
  logout: 'log-out',
  warning: 'warning',
  refresh: 'refresh',
  error: 'alert-circle',
  success: 'checkmark-circle',
  info: 'information-circle',
  empty: 'file-tray',
  money: 'cash',
  book: 'book',
  note: 'create',
  trash: 'trash',
  eye: 'eye',
  eyeOff: 'eye-off',
  mail: 'mail',
  lock: 'lock-closed',
  /** A 15-day billing exemption (founder 2026-10-04). */
  shield: 'shield-checkmark',
  phone: 'phone-portrait',
  gps: 'navigate',
  trophy: 'trophy',
  star: 'star',
  language: 'language',
  help: 'help-circle',
  close: 'close',
  offline: 'cloud-offline',
  download: 'download',
  'person-remove': 'person-remove',
  /** «اعتراض على الدرجة»: photograph the paper, pick it, draw on it, undo a line. */
  camera: 'camera',
  image: 'image',
  brush: 'brush',
  undo: 'arrow-undo',
  // Threads («النقاشات») — also the student's «مجموعاتي» coming-soon tab.
  threads: 'chatbox-ellipses',
  question: 'help-circle',
  thumbUp: 'thumbs-up',
  play: 'play',
} as const;

export type IconName = keyof typeof ICON_MAP;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Filled (default) or outline variant */
  outline?: boolean;
  style?: ComponentProps<typeof Ionicons>['style'];
}

// memo: a pure leaf whose props are primitives, rendered in roughly 400 places —
// several per list row. Without it every icon on screen re-rendered whenever its screen
// did, which on a roster or a session list is hundreds of wasted renders per keystroke
// or poll tick (Android slowness, 2026-09-22).
export const Icon = memo(function Icon({ name, size = 22, color, outline = false, style }: IconProps) {
  const base = ICON_MAP[name];
  const glyph = (outline ? `${base}-outline` : base) as IoniconName;
  return <Ionicons name={glyph} size={size} color={color ?? colors.textPrimary} style={style} />;
});
