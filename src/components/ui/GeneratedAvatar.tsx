import { memo, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';

/**
 * A little vector character generated from a seed — the same seed always gives the same
 * character on the same backdrop, so a person keeps theirs across every screen without
 * uploading a photo. Founder 2026-10-03: no initials («sometimes make a weird name»), not
 * humanised, «something like robot and carrot, some fruits and some animals». Twenty
 * flat characters drawn from circles, ellipses and a few paths, each on one of eight
 * Sanad backdrops (never one that drowns the character). Behind the character sits the
 * first version's tilted colour blob — a rounded shape in a second colour, rotated and
 * pushed off-centre by the seed — and the character leans a few degrees with it (founder:
 * «I also like the first avatar's impression and angles»). Pure SVG, no network, cheap
 * enough for a roster row.
 *
 * The seed must be the SAME for one person everywhere: `avatarSeed.student(id)` for a
 * student (students.id) and `avatarSeed.user(id)` for a teacher/assistant/parent
 * (users.id), never the display name — a name formats differently from screen to screen.
 */
const SIZE = 36;

// Sanad-friendly backdrops: ink indigo, apricot, muted green, coral, teal, gold — no purple.
const PALETTE = ['#34419B', '#E7913A', '#1F9366', '#E9655C', '#2A9DB0', '#C9A227', '#4A57B5', '#D97B22'];
const INK = '#1A2140';
const CREAM = '#FFF7EA';

/** One canonical seed per person, shared by every screen that draws them. */
export const avatarSeed = {
  student: (id: number | string | null | undefined, fallback = '?') => (id === null || id === undefined || id === '' ? fallback : `student-${id}`),
  user: (id: number | string | null | undefined, fallback = '?') => (id === null || id === undefined || id === '' ? fallback : `user-${id}`),
};

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  // Scramble: sequential ids («student-41», «student-42») differ in one character, which the
  // rolling hash leaves in the low digits only; two mixing rounds spread it over all of them.
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return h >>> 0;
}

export type AvatarCharacter =
  | 'robot' | 'carrot' | 'apple' | 'pear' | 'strawberry' | 'banana' | 'watermelon' | 'mushroom' | 'cactus' | 'rocket'
  | 'cat' | 'dog' | 'fox' | 'owl' | 'panda' | 'frog' | 'bee' | 'penguin' | 'lion' | 'chick';

/** Every character, with the backdrop indices it would vanish against. */
const CHARACTERS: { key: AvatarCharacter; avoid: number[] }[] = [
  { key: 'robot', avoid: [] },
  { key: 'carrot', avoid: [1, 3, 7] },
  { key: 'apple', avoid: [1, 3, 7] },
  { key: 'pear', avoid: [2, 5] },
  { key: 'strawberry', avoid: [1, 3, 7] },
  { key: 'banana', avoid: [1, 5, 7] },
  { key: 'watermelon', avoid: [2, 3] },
  { key: 'mushroom', avoid: [3] },
  { key: 'cactus', avoid: [2] },
  { key: 'rocket', avoid: [3] },
  { key: 'cat', avoid: [1, 7] },
  { key: 'dog', avoid: [1, 7] },
  { key: 'fox', avoid: [1, 3, 7] },
  { key: 'owl', avoid: [7] },
  { key: 'panda', avoid: [] },
  { key: 'frog', avoid: [2] },
  { key: 'bee', avoid: [5] },
  { key: 'penguin', avoid: [] },
  { key: 'lion', avoid: [1, 5, 7] },
  { key: 'chick', avoid: [1, 5] },
];

export interface AvatarFeatures {
  character: AvatarCharacter;
  backgroundColor: string;
  /** The tilted blob behind the character — a second colour, never the backdrop's. */
  wrapperColor: string;
  wrapperTranslateX: number;
  wrapperTranslateY: number;
  wrapperRotate: number;
  wrapperScale: number;
  isCircle: boolean;
  /** The character's own lean, in degrees. */
  tilt: number;
  offsetX: number;
  offsetY: number;
}

const digit = (n: number, place: number) => Math.floor((n / 10 ** place) % 10);

export function avatarFeatures(seed: string): AvatarFeatures {
  const n = hashCode(seed || '?');
  const c = CHARACTERS[n % CHARACTERS.length];
  const allowed = PALETTE.map((_, i) => i).filter((i) => !c.avoid.includes(i));
  const bgIdx = allowed[Math.floor(n / CHARACTERS.length) % allowed.length];
  const others = allowed.filter((i) => i !== bgIdx);
  const wrapIdx = others[digit(n, 3) % others.length] ?? (bgIdx + 1) % PALETTE.length;
  // The blob is pushed towards one corner so it reads as a shape, not a second backdrop.
  const dx = 6 + (digit(n, 4) % 7); // 6..12
  const dy = 6 + (digit(n, 5) % 7);
  return {
    character: c.key,
    backgroundColor: PALETTE[bgIdx],
    wrapperColor: PALETTE[wrapIdx],
    wrapperTranslateX: digit(n, 6) % 2 === 0 ? dx : -dx,
    wrapperTranslateY: digit(n, 7) % 2 === 0 ? dy : -dy,
    wrapperRotate: (digit(n, 8) * 36 + digit(n, 2) * 3) % 360,
    wrapperScale: 1 + (digit(n, 1) % 4) / 10, // 1.0..1.3
    isCircle: digit(n, 2) % 2 === 0,
    tilt: -12 + (digit(n, 9) % 9) * 3, // -12..12
    offsetX: -1 + (digit(n, 4) % 3), // -1..1
    offsetY: -1 + (digit(n, 5) % 3),
  };
}

// ---- the characters (36×36 canvas) ----

const CHARACTER_ART: Record<AvatarCharacter, () => ReactNode> = {
  robot: () => (
    <>
      <Path d="M18 10 V6" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={18} cy={5} r={1.9} fill="#E9655C" />
      <Rect x={6.5} y={15} width={2.6} height={6} rx={1} fill="#8E9BB8" />
      <Rect x={26.9} y={15} width={2.6} height={6} rx={1} fill="#8E9BB8" />
      <Rect x={9} y={10} width={18} height={16} rx={4} fill="#C7D0E2" />
      <Rect x={12.5} y={15} width={3.6} height={3.6} rx={0.9} fill={INK} />
      <Rect x={19.9} y={15} width={3.6} height={3.6} rx={0.9} fill={INK} />
      <Rect x={13} y={21.2} width={10} height={2} rx={1} fill={INK} />
    </>
  ),
  carrot: () => (
    <>
      <Path d="M18 32 L11 14 Q18 10 25 14 Z" fill="#F08A2E" />
      <Path d="M13.5 18 H20.5 M15 23 H19.5 M16.8 27.5 H18.6" stroke="#C96A14" strokeWidth={1.3} strokeLinecap="round" />
      <Path d="M18 13 C15 9 12 8 9.5 5 C14 6 16.5 9 18 13 Z" fill="#2E9E62" />
      <Path d="M18 13 C18 8 19 5.5 20 3 C21.5 6.5 20.5 10 18 13 Z" fill="#3BB573" />
      <Path d="M18 13 C21 9 24 8 27.5 6.5 C23.5 7.5 20.5 10 18 13 Z" fill="#2E9E62" />
    </>
  ),
  apple: () => (
    <>
      <Path d="M18 12 C12 8 7 12 8 19 C9 26 13 30 16 29 C17 28.5 19 28.5 20 29 C23 30 27 26 28 19 C29 12 24 8 18 12 Z" fill="#E4433A" />
      <Path d="M18 12 L19 7" stroke="#6B4423" strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M19 9 C21 6 24 6 26.5 7 C24 9.2 21 10 19 9 Z" fill="#2E9E62" />
      <Ellipse cx={13} cy={17.5} rx={1.5} ry={3} fill={CREAM} opacity={0.55} />
    </>
  ),
  pear: () => (
    <>
      <Path d="M18 9 C20 9 21 12 21 14 C22 17 27 20 26 25 C25 30.5 11 30.5 10 25 C9 20 14 17 15 14 C15 12 16 9 18 9 Z" fill="#B9C94A" />
      <Path d="M18 9 L19 5" stroke="#6B4423" strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M19 7 C21 5 23 5 25.5 6 C23.5 7.8 21 8.2 19 7 Z" fill="#2E9E62" />
      <Ellipse cx={14} cy={23} rx={1.4} ry={2.6} fill={CREAM} opacity={0.45} />
    </>
  ),
  strawberry: () => (
    <>
      <Path d="M18 31 C12 28 8 22 9 15 C10 11 14 10 18 11 C22 10 26 11 27 15 C28 22 24 28 18 31 Z" fill="#E4433A" />
      {[[14, 17], [18, 16], [22, 17], [13, 22], [18, 21], [23, 22], [16, 26], [20, 26]].map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={0.9} fill={CREAM} />
      ))}
      <Path d="M18 11 L13 7 L17 9 L18 3.5 L19 9 L23 7 Z" fill="#2E9E62" />
    </>
  ),
  banana: () => (
    <>
      <Path d="M8 12 C8 22 16 29.5 28 27.5 L29 24.5 C19 25.5 12 19 11 11 Z" fill="#F2C94C" />
      <Path d="M8 12 L11 11" stroke="#6B4423" strokeWidth={2} strokeLinecap="round" />
      <Path d="M28 27.5 L29 24.5" stroke="#6B4423" strokeWidth={2} strokeLinecap="round" />
      <Path d="M11 14 C12 20 17 25 24 26" stroke="#E0B23A" strokeWidth={1} fill="none" strokeLinecap="round" />
    </>
  ),
  watermelon: () => (
    <>
      <Path d="M4 13 A14 14 0 0 0 32 13 Z" fill="#2E9E62" />
      <Path d="M6 13 A12 12 0 0 0 30 13 Z" fill={CREAM} />
      <Path d="M7.5 13 A10.5 10.5 0 0 0 28.5 13 Z" fill="#E9534A" />
      {[[14, 17], [18, 19.5], [22, 17], [16, 22], [20, 22]].map(([x, y]) => (
        <Ellipse key={`${x}-${y}`} cx={x} cy={y} rx={0.9} ry={1.4} fill={INK} />
      ))}
    </>
  ),
  mushroom: () => (
    <>
      <Path d="M6 18 C6 7.5 30 7.5 30 18 Z" fill="#E4433A" />
      <Circle cx={12} cy={14} r={1.8} fill={CREAM} />
      <Circle cx={18} cy={11} r={2} fill={CREAM} />
      <Circle cx={24} cy={14} r={1.8} fill={CREAM} />
      <Rect x={13.5} y={17} width={9} height={13} rx={3.5} fill={CREAM} />
      <Circle cx={16.2} cy={23} r={0.9} fill={INK} />
      <Circle cx={19.8} cy={23} r={0.9} fill={INK} />
      <Path d="M16.5 26 Q18 27.6 19.5 26" stroke={INK} strokeWidth={0.9} fill="none" strokeLinecap="round" />
    </>
  ),
  cactus: () => (
    <>
      <Path d="M11 27 H25 L23.5 33 H12.5 Z" fill="#C96A14" />
      <Rect x={10} y={25} width={16} height={3} rx={1} fill="#E8884A" />
      <Path d="M14.5 19 H11 V12" stroke="#3E9E5A" strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d="M21.5 15 H25 V8" stroke="#3E9E5A" strokeWidth={4} strokeLinecap="round" fill="none" />
      <Rect x={14.5} y={7} width={7} height={19} rx={3.5} fill="#3E9E5A" />
      <Circle cx={18} cy={6.8} r={2.4} fill="#E9655C" />
      <Circle cx={16.5} cy={12} r={0.6} fill={CREAM} />
      <Circle cx={19.5} cy={16} r={0.6} fill={CREAM} />
      <Circle cx={16.5} cy={20} r={0.6} fill={CREAM} />
    </>
  ),
  rocket: () => (
    <>
      <Polygon points="13,20 8,28 13,26" fill="#E4433A" />
      <Polygon points="23,20 28,28 23,26" fill="#E4433A" />
      <Path d="M15 26 Q18 34 21 26 Z" fill="#F08A2E" />
      <Path d="M16.5 26 Q18 31 19.5 26 Z" fill="#F2C94C" />
      <Path d="M18 4 C24 9 25 18 23 26 H13 C11 18 12 9 18 4 Z" fill={CREAM} />
      <Path d="M18 4 C21 6.5 22 9 22.5 11 H13.5 C14 9 15 6.5 18 4 Z" fill="#E4433A" />
      <Circle cx={18} cy={16} r={3} fill="#2A9DB0" />
      <Circle cx={18} cy={16} r={1.8} fill="#9FE0EA" />
    </>
  ),
  cat: () => (
    <>
      <Polygon points="9,15 10,6 17,11" fill="#F0A35E" />
      <Polygon points="27,15 26,6 19,11" fill="#F0A35E" />
      <Polygon points="10.5,13 11,8.5 15,11.5" fill="#F6C6A0" />
      <Polygon points="25.5,13 25,8.5 21,11.5" fill="#F6C6A0" />
      <Circle cx={18} cy={19} r={10} fill="#F0A35E" />
      <Ellipse cx={14.5} cy={18} rx={1.4} ry={2} fill={INK} />
      <Ellipse cx={21.5} cy={18} rx={1.4} ry={2} fill={INK} />
      <Polygon points="16.8,22 19.2,22 18,23.6" fill="#E9655C" />
      <Path d="M6 20 H12 M6 23 H12 M24 20 H30 M24 23 H30" stroke={INK} strokeWidth={1} strokeLinecap="round" />
    </>
  ),
  dog: () => (
    <>
      <Ellipse cx={9} cy={17} rx={3.3} ry={6} fill="#7C4E2B" />
      <Ellipse cx={27} cy={17} rx={3.3} ry={6} fill="#7C4E2B" />
      <Circle cx={18} cy={18} r={10} fill="#B57A4A" />
      <Ellipse cx={18} cy={22} rx={5} ry={3.8} fill={CREAM} />
      <Ellipse cx={18} cy={20.5} rx={2} ry={1.5} fill={INK} />
      <Circle cx={14.5} cy={15} r={1.4} fill={INK} />
      <Circle cx={21.5} cy={15} r={1.4} fill={INK} />
      <Path d="M18 22 Q16 24.5 14 23 M18 22 Q20 24.5 22 23" stroke={INK} strokeWidth={1} fill="none" strokeLinecap="round" />
    </>
  ),
  fox: () => (
    <>
      <Polygon points="8,16 9,5 17,11" fill="#E8712C" />
      <Polygon points="28,16 27,5 19,11" fill="#E8712C" />
      <Polygon points="10,14 10.5,8 15,11.5" fill={CREAM} />
      <Polygon points="26,14 25.5,8 21,11.5" fill={CREAM} />
      <Path d="M8 16 Q18 10 28 16 Q27 24 18 30 Q9 24 8 16 Z" fill="#E8712C" />
      <Path d="M18 30 Q11 26 10 20 Q14 20 18 23 Q22 20 26 20 Q25 26 18 30 Z" fill={CREAM} />
      <Ellipse cx={14} cy={18} rx={1.3} ry={1.8} fill={INK} />
      <Ellipse cx={22} cy={18} rx={1.3} ry={1.8} fill={INK} />
      <Circle cx={18} cy={25} r={1.6} fill={INK} />
    </>
  ),
  owl: () => (
    <>
      <Polygon points="10,12 11,6 15,10" fill="#8A5A3A" />
      <Polygon points="26,12 25,6 21,10" fill="#8A5A3A" />
      <Ellipse cx={18} cy={20} rx={11} ry={12} fill="#8A5A3A" />
      <Ellipse cx={18} cy={24.5} rx={6} ry={6} fill="#C99A6A" />
      <Circle cx={13.5} cy={16} r={4.2} fill={CREAM} />
      <Circle cx={22.5} cy={16} r={4.2} fill={CREAM} />
      <Circle cx={13.5} cy={16} r={2} fill={INK} />
      <Circle cx={22.5} cy={16} r={2} fill={INK} />
      <Polygon points="16.5,19 19.5,19 18,22" fill="#F08A2E" />
    </>
  ),
  panda: () => (
    <>
      <Circle cx={10} cy={10} r={3.6} fill={INK} />
      <Circle cx={26} cy={10} r={3.6} fill={INK} />
      <Circle cx={18} cy={19} r={10.5} fill={CREAM} />
      <Ellipse cx={14} cy={17} rx={3} ry={3.6} fill={INK} transform="rotate(-15 14 17)" />
      <Ellipse cx={22} cy={17} rx={3} ry={3.6} fill={INK} transform="rotate(15 22 17)" />
      <Circle cx={14.3} cy={17} r={1.2} fill={CREAM} />
      <Circle cx={21.7} cy={17} r={1.2} fill={CREAM} />
      <Ellipse cx={18} cy={22} rx={1.8} ry={1.3} fill={INK} />
      <Path d="M18 23.3 V24.8" stroke={INK} strokeWidth={1} strokeLinecap="round" />
    </>
  ),
  frog: () => (
    <>
      <Circle cx={12} cy={11} r={4} fill="#4CAF6A" />
      <Circle cx={24} cy={11} r={4} fill="#4CAF6A" />
      <Ellipse cx={18} cy={20} rx={12} ry={9} fill="#4CAF6A" />
      <Circle cx={12} cy={11} r={2} fill={CREAM} />
      <Circle cx={24} cy={11} r={2} fill={CREAM} />
      <Circle cx={12.4} cy={11} r={1} fill={INK} />
      <Circle cx={23.6} cy={11} r={1} fill={INK} />
      <Path d="M10 21 Q18 27 26 21" stroke={INK} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Circle cx={10.5} cy={23} r={1.5} fill="#E9655C" opacity={0.6} />
      <Circle cx={25.5} cy={23} r={1.5} fill="#E9655C" opacity={0.6} />
    </>
  ),
  bee: () => (
    <>
      <Ellipse cx={13} cy={10} rx={4.5} ry={3.4} fill={CREAM} opacity={0.92} transform="rotate(-20 13 10)" />
      <Ellipse cx={23} cy={10} rx={4.5} ry={3.4} fill={CREAM} opacity={0.92} transform="rotate(20 23 10)" />
      <Path d="M15 13 L13 7.5 M21 13 L23 7.5" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
      <Circle cx={13} cy={7.3} r={1.2} fill={INK} />
      <Circle cx={23} cy={7.3} r={1.2} fill={INK} />
      <Polygon points="27.5,20 31,20.5 28,22.5" fill={INK} />
      <Ellipse cx={18} cy={20} rx={10} ry={8} fill="#F2C94C" />
      <Path d="M14 12.9 V27.1" stroke={INK} strokeWidth={2.4} />
      <Path d="M20 12.2 V27.8" stroke={INK} strokeWidth={2.4} />
      <Circle cx={9.8} cy={18.5} r={1.1} fill={INK} />
      <Path d="M8.7 21.5 Q10 23 11.3 21.5" stroke={INK} strokeWidth={0.9} fill="none" strokeLinecap="round" />
    </>
  ),
  penguin: () => (
    <>
      <Ellipse cx={14.5} cy={31.5} rx={3} ry={1.5} fill="#F08A2E" />
      <Ellipse cx={21.5} cy={31.5} rx={3} ry={1.5} fill="#F08A2E" />
      <Ellipse cx={18} cy={20} rx={10} ry={12} fill={INK} />
      <Ellipse cx={18} cy={22.5} rx={6.5} ry={8.5} fill={CREAM} />
      <Circle cx={14.5} cy={14} r={1.5} fill={CREAM} />
      <Circle cx={21.5} cy={14} r={1.5} fill={CREAM} />
      <Circle cx={14.8} cy={14} r={0.7} fill={INK} />
      <Circle cx={21.2} cy={14} r={0.7} fill={INK} />
      <Polygon points="16,16.5 20,16.5 18,19" fill="#F08A2E" />
    </>
  ),
  lion: () => (
    <>
      <Circle cx={18} cy={18} r={13} fill="#D9782A" />
      <Circle cx={11} cy={12} r={2.6} fill="#F0B35E" />
      <Circle cx={25} cy={12} r={2.6} fill="#F0B35E" />
      <Circle cx={18} cy={18} r={9} fill="#F0B35E" />
      <Circle cx={14.8} cy={16} r={1.3} fill={INK} />
      <Circle cx={21.2} cy={16} r={1.3} fill={INK} />
      <Polygon points="16.5,19.5 19.5,19.5 18,21.5" fill={INK} />
      <Path d="M18 21.5 Q16 24 14.5 22.5 M18 21.5 Q20 24 21.5 22.5" stroke={INK} strokeWidth={1} fill="none" strokeLinecap="round" />
    </>
  ),
  chick: () => (
    <>
      <Path d="M15 30 V33.5 M21 30 V33.5" stroke="#F08A2E" strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M16.5 11 C15.5 7 19 5.5 19.5 10 Z" fill="#F2C94C" />
      <Circle cx={18} cy={20} r={10} fill="#F2C94C" />
      <Ellipse cx={10} cy={21} rx={3} ry={4.5} fill="#E8B63A" />
      <Ellipse cx={26} cy={21} rx={3} ry={4.5} fill="#E8B63A" />
      <Circle cx={14.5} cy={17} r={1.3} fill={INK} />
      <Circle cx={21.5} cy={17} r={1.3} fill={INK} />
      <Polygon points="16,20 20,20 18,23" fill="#F08A2E" />
    </>
  ),
};

export const GeneratedAvatar = memo(function GeneratedAvatar({ seed, size = 40, square = false, label }: {
  /** The person's canonical seed — see `avatarSeed`. */
  seed: string;
  size?: number;
  /** Rounded square instead of a circle (for tiles). */
  square?: boolean;
  label?: string;
}) {
  const f = avatarFeatures(seed);
  const radius = square ? SIZE * 0.28 : SIZE / 2;
  const clipId = `clip-${hashCode(seed).toString(36)}`;
  const Art = CHARACTER_ART[f.character];
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={label ?? seed}>
      <Svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Rect width={SIZE} height={SIZE} rx={radius} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          <Rect width={SIZE} height={SIZE} fill={f.backgroundColor} />
          <Rect
            x={0}
            y={0}
            width={SIZE}
            height={SIZE}
            rx={f.isCircle ? SIZE : SIZE / 6}
            fill={f.wrapperColor}
            transform={`translate(${f.wrapperTranslateX} ${f.wrapperTranslateY}) rotate(${f.wrapperRotate} ${SIZE / 2} ${SIZE / 2}) scale(${f.wrapperScale})`}
          />
          {/* The character leans with the blob and sits a touch low, like a sticker on a badge. */}
          <G transform={`rotate(${f.tilt} ${SIZE / 2} ${SIZE / 2}) translate(${f.offsetX} ${1 + f.offsetY}) scale(0.9 0.9) translate(2 2)`}>{Art()}</G>
        </G>
      </Svg>
    </View>
  );
});
