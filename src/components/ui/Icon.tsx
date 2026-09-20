// Import the ONE family directly, never the '@expo/vector-icons' barrel: Metro does no
// tree-shaking, so the barrel drags every family's font file (MaterialCommunityIcons alone
// is 1.3 MB) into the APK as assets the app never draws.
import Ionicons from '@expo/vector-icons/Ionicons';
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
  terms: 'document-text',
  chat: 'chatbubbles',
  check: 'checkmark',
  attach: 'attach',
  camera: 'camera',
  mic: 'mic',
  play: 'play',
  pause: 'pause',
  flag: 'flag',
  block: 'ban',
  mute: 'mic-off',
  bellOff: 'notifications-off',
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
  phone: 'phone-portrait',
  gps: 'navigate',
  trophy: 'trophy',
  star: 'star',
  language: 'language',
  help: 'help-circle',
  close: 'close',
  download: 'download',
  'person-remove': 'person-remove',
  // Threads («النقاشات»): question feed, votes, timer, the answer video and the recorder.
  threads: 'chatbox-ellipses',
  question: 'help-circle',
  thumbUp: 'thumbs-up',
  thumbDown: 'thumbs-down',
  timer: 'timer',
  video: 'videocam',
  stop: 'stop-circle',
  shield: 'shield-checkmark',
  people: 'people',
  flipCamera: 'camera-reverse',
  lightbulb: 'bulb',
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
