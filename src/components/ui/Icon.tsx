import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

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
  clock: 'time',
  quiz: 'document-text',
  grades: 'ribbon',
  attendance: 'checkmark-circle',
  present: 'checkmark-circle',
  absent: 'close-circle',
  late: 'time',
  excused: 'information-circle',
  card: 'id-card',
  scan: 'qr-code',
  send: 'send',
  add: 'add',
  back: 'chevron-back',
  forward: 'chevron-forward',
  down: 'chevron-down',
  search: 'search',
  logout: 'log-out',
  warning: 'warning',
  error: 'alert-circle',
  success: 'checkmark-circle',
  info: 'information-circle',
  empty: 'file-tray',
  money: 'cash',
  book: 'book',
  note: 'create',
  trash: 'trash',
  eye: 'eye',
  lock: 'lock-closed',
  phone: 'phone-portrait',
  gps: 'navigate',
  trophy: 'trophy',
  star: 'star',
  language: 'language',
  help: 'help-circle',
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

export function Icon({ name, size = 22, color = '#0F172A', outline = false, style }: IconProps) {
  const base = ICON_MAP[name];
  const glyph = (outline ? `${base}-outline` : base) as IoniconName;
  return <Ionicons name={glyph} size={size} color={color} style={style} />;
}
