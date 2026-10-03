import { memo, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';

/**
 * A little vector character generated from a seed — the same seed always gives the same
 * character, backdrop and expression, so a person keeps theirs across every screen without
 * uploading a photo. Founder 2026-10-03: no initials («sometimes make a weird name»), not
 * humanised, «robot and carrot, some fruits and some animals… objects and other things»,
 * and every one of them with a face («smiling or laughing like the others»).
 *
 * Forty flat characters — food, objects, sky, creatures — each with a face anchor; ONE
 * shared face draws the eyes and mouth so every character carries one of five seeded
 * expressions (smile, laugh, grin, wink, surprised). Behind the character sits the tilted
 * second-colour blob from the first version, pushed off-centre and rotated by the seed,
 * and the character leans a few degrees with it («I like the first one's impression and
 * angles»). Pure SVG, no network, cheap enough for a roster row.
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
const BLUSH = '#E9655C';

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

const digit = (n: number, place: number) => Math.floor((n / 10 ** place) % 10);

export type AvatarExpression = 'smile' | 'laugh' | 'grin' | 'wink' | 'wow';
const EXPRESSIONS: AvatarExpression[] = ['smile', 'laugh', 'grin', 'wink', 'wow'];

export type AvatarCharacter =
  // food
  | 'carrot' | 'apple' | 'pear' | 'strawberry' | 'banana' | 'watermelon' | 'mushroom' | 'icecream' | 'cupcake' | 'donut'
  | 'pizza' | 'avocado' | 'pineapple' | 'lemon' | 'cherry'
  // objects & sky
  | 'robot' | 'rocket' | 'cactus' | 'cloud' | 'sun' | 'moon' | 'star' | 'planet' | 'book' | 'pencil' | 'ball' | 'car' | 'boat' | 'balloon' | 'ghost'
  // creatures
  | 'cat' | 'dog' | 'fox' | 'owl' | 'panda' | 'frog' | 'bee' | 'penguin' | 'lion' | 'chick' | 'rabbit' | 'koala' | 'turtle' | 'octopus' | 'whale' | 'dino' | 'snail' | 'ladybug' | 'alien';

/** Where a character's face goes and how it is drawn. */
interface FaceAnchor {
  cx: number;
  eyeY: number;
  eyeDx: number;
  mouthY: number;
  /** Scale of the whole face (1 = a 36px canvas's normal face). */
  s?: number;
  color?: string;
  /** Mouth ink when it differs from the eyes' (a panda's cream eyes on ink patches). */
  mouthColor?: string;
  /** The body art already has eyes (an alien's almonds) or a mouth (a beak). */
  noEyes?: boolean;
  noMouth?: boolean;
  blush?: boolean;
}

interface CharacterDef {
  key: AvatarCharacter;
  /** Backdrop/blob indices the character would vanish against. */
  avoid: number[];
  face: FaceAnchor;
  art: () => ReactNode;
}

// ---- the characters (36×36 canvas) ----

const CHARACTERS: CharacterDef[] = [
  // ---------- food ----------
  {
    key: 'carrot', avoid: [1, 3, 7], face: { cx: 18, eyeY: 17.5, eyeDx: 2.2, mouthY: 20.5, s: 0.75 },
    art: () => (
      <>
        <Path d="M18 33 L11 14 Q18 10 25 14 Z" fill="#F08A2E" />
        <Path d="M15 24.5 H21 M16.6 28.5 H19.4" stroke="#C96A14" strokeWidth={1.3} strokeLinecap="round" />
        <Path d="M18 13 C15 9 12 8 9.5 5 C14 6 16.5 9 18 13 Z" fill="#2E9E62" />
        <Path d="M18 13 C18 8 19 5.5 20 3 C21.5 6.5 20.5 10 18 13 Z" fill="#3BB573" />
        <Path d="M18 13 C21 9 24 8 27.5 6.5 C23.5 7.5 20.5 10 18 13 Z" fill="#2E9E62" />
      </>
    ),
  },
  {
    key: 'apple', avoid: [1, 3, 7], face: { cx: 18, eyeY: 18, eyeDx: 3, mouthY: 22, blush: true },
    art: () => (
      <>
        <Path d="M18 12 C12 8 7 12 8 19 C9 26 13 30 16 29 C17 28.5 19 28.5 20 29 C23 30 27 26 28 19 C29 12 24 8 18 12 Z" fill="#E4433A" />
        <Path d="M18 12 L19 7" stroke="#6B4423" strokeWidth={1.6} strokeLinecap="round" />
        <Path d="M19 9 C21 6 24 6 26.5 7 C24 9.2 21 10 19 9 Z" fill="#2E9E62" />
        <Ellipse cx={12.5} cy={16.5} rx={1.3} ry={2.6} fill={CREAM} opacity={0.5} />
      </>
    ),
  },
  {
    key: 'pear', avoid: [2, 5], face: { cx: 18, eyeY: 20, eyeDx: 2.8, mouthY: 24 },
    art: () => (
      <>
        <Path d="M18 9 C20 9 21 12 21 14 C22 17 27 20 26 25 C25 30.5 11 30.5 10 25 C9 20 14 17 15 14 C15 12 16 9 18 9 Z" fill="#B9C94A" />
        <Path d="M18 9 L19 5" stroke="#6B4423" strokeWidth={1.6} strokeLinecap="round" />
        <Path d="M19 7 C21 5 23 5 25.5 6 C23.5 7.8 21 8.2 19 7 Z" fill="#2E9E62" />
      </>
    ),
  },
  {
    key: 'strawberry', avoid: [1, 3, 7], face: { cx: 18, eyeY: 18, eyeDx: 2.8, mouthY: 22, color: CREAM },
    art: () => (
      <>
        <Path d="M18 31 C12 28 8 22 9 15 C10 11 14 10 18 11 C22 10 26 11 27 15 C28 22 24 28 18 31 Z" fill="#E4433A" />
        {[[12.5, 20], [23.5, 20], [14, 26], [22, 26], [18, 28]].map(([x, y]) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={0.9} fill={CREAM} />)}
        <Path d="M18 11 L13 7 L17 9 L18 3.5 L19 9 L23 7 Z" fill="#2E9E62" />
      </>
    ),
  },
  {
    key: 'banana', avoid: [1, 5, 7], face: { cx: 17, eyeY: 20, eyeDx: 2.4, mouthY: 23, s: 0.75 },
    art: () => (
      <>
        <Path d="M8 12 C8 22 16 29.5 28 27.5 L29 24.5 C19 25.5 12 19 11 11 Z" fill="#F2C94C" />
        <Path d="M8 12 L11 11" stroke="#6B4423" strokeWidth={2} strokeLinecap="round" />
        <Path d="M28 27.5 L29 24.5" stroke="#6B4423" strokeWidth={2} strokeLinecap="round" />
      </>
    ),
  },
  {
    key: 'watermelon', avoid: [2, 3], face: { cx: 18, eyeY: 17, eyeDx: 3, mouthY: 20.5 },
    art: () => (
      <>
        <Path d="M4 13 A14 14 0 0 0 32 13 Z" fill="#2E9E62" />
        <Path d="M6 13 A12 12 0 0 0 30 13 Z" fill={CREAM} />
        <Path d="M7.5 13 A10.5 10.5 0 0 0 28.5 13 Z" fill="#E9534A" />
        {[[11.5, 18], [24.5, 18], [18, 25]].map(([x, y]) => <Ellipse key={`${x}-${y}`} cx={x} cy={y} rx={0.9} ry={1.4} fill={INK} />)}
      </>
    ),
  },
  {
    key: 'mushroom', avoid: [3], face: { cx: 18, eyeY: 22.5, eyeDx: 1.9, mouthY: 25.5, s: 0.7 },
    art: () => (
      <>
        <Path d="M6 18 C6 7.5 30 7.5 30 18 Z" fill="#E4433A" />
        <Circle cx={12} cy={14} r={1.8} fill={CREAM} />
        <Circle cx={18} cy={11} r={2} fill={CREAM} />
        <Circle cx={24} cy={14} r={1.8} fill={CREAM} />
        <Rect x={13.5} y={17} width={9} height={13} rx={3.5} fill={CREAM} />
      </>
    ),
  },
  {
    key: 'icecream', avoid: [3], face: { cx: 18, eyeY: 13, eyeDx: 2.8, mouthY: 16.5, blush: true },
    art: () => (
      <>
        <Polygon points="11,19 25,19 18,33" fill="#E0A860" />
        <Path d="M13 23 L23 23 M14.8 27 L21.2 27" stroke="#C48A3C" strokeWidth={1} strokeLinecap="round" />
        <Circle cx={18} cy={14} r={8.5} fill="#F3A7B8" />
        <Path d="M11 18 Q12 22 14 18 Q15.5 22.5 17.5 18 Q19.5 22 21.5 18 Q23 21.5 25 18" fill="#F3A7B8" />
        <Circle cx={18} cy={5} r={1.6} fill="#E4433A" />
      </>
    ),
  },
  {
    key: 'cupcake', avoid: [3], face: { cx: 18, eyeY: 15, eyeDx: 2.8, mouthY: 18.5 },
    art: () => (
      <>
        <Path d="M10 21 H26 L24 32 H12 Z" fill="#E9655C" />
        <Path d="M14 22 L13.5 31 M18 22 V31 M22 22 L22.5 31" stroke="#C94A42" strokeWidth={1} />
        <Circle cx={18} cy={16} r={8.5} fill="#F6D9E8" />
        <Path d="M9.5 21 Q18 24.5 26.5 21 L26 19 Q18 22 10 19 Z" fill="#F6D9E8" />
        <Circle cx={18} cy={7} r={2} fill="#E4433A" />
      </>
    ),
  },
  {
    key: 'donut', avoid: [1, 7], face: { cx: 18, eyeY: 13.5, eyeDx: 4.5, mouthY: 24, s: 0.9 },
    art: () => (
      <>
        <Circle cx={18} cy={19} r={11.5} fill="#E0A860" />
        <Circle cx={18} cy={18.5} r={10} fill="#F3A7B8" />
        <Circle cx={18} cy={19} r={3.2} fill={CREAM} />
        {[[11, 16, 30], [24, 15, -30], [12, 23, 60], [25, 24, -60], [18, 9.5, 10]].map(([x, y, r]) => (
          <Rect key={`${x}-${y}`} x={x - 1.4} y={y - 0.5} width={2.8} height={1} rx={0.5} fill={[INK, '#F2C94C', '#2A9DB0', CREAM, '#E4433A'][Math.abs(x + y) % 5]} transform={`rotate(${r} ${x} ${y})`} />
        ))}
      </>
    ),
  },
  {
    key: 'pizza', avoid: [5, 1], face: { cx: 18, eyeY: 16.5, eyeDx: 2.6, mouthY: 20, s: 0.85 },
    art: () => (
      <>
        <Polygon points="18,33 5,10 31,10" fill="#F2C94C" />
        <Path d="M5 10 Q18 4 31 10" stroke="#D9782A" strokeWidth={3.5} fill="none" strokeLinecap="round" />
        <Circle cx={11.5} cy={12.5} r={2} fill="#E4433A" />
        <Circle cx={24.5} cy={12.5} r={2} fill="#E4433A" />
        <Circle cx={18} cy={26} r={1.8} fill="#E4433A" />
      </>
    ),
  },
  {
    key: 'avocado', avoid: [2], face: { cx: 18, eyeY: 15, eyeDx: 2.4, mouthY: 18, s: 0.8 },
    art: () => (
      <>
        <Path d="M18 5 C21 5 22 9 22.5 12 C24 16 29 19 28 25 C27 31 9 31 8 25 C7 19 12 16 13.5 12 C14 9 15 5 18 5 Z" fill="#3E9E5A" />
        <Path d="M18 8 C20 8 20.5 11 21 13.5 C22 16.5 26 19 25.5 24 C25 28.5 11 28.5 10.5 24 C10 19 14 16.5 15 13.5 C15.5 11 16 8 18 8 Z" fill="#C5D86D" />
        <Circle cx={18} cy={23} r={4.5} fill="#8A5A3A" />
      </>
    ),
  },
  {
    key: 'pineapple', avoid: [5, 1, 7], face: { cx: 18, eyeY: 20, eyeDx: 2.8, mouthY: 24 },
    art: () => (
      <>
        <Polygon points="18,4 15,13 21,13" fill="#2E9E62" />
        <Polygon points="12,7 14,14 19,12" fill="#3BB573" />
        <Polygon points="24,7 22,14 17,12" fill="#3BB573" />
        <Ellipse cx={18} cy={22.5} rx={8.5} ry={10} fill="#F2C94C" />
        <Path d="M11 17 L25 29 M11 23 L22 32 M14 14 L26 24 M25 17 L11 29 M25 23 L14 32 M22 14 L10 24" stroke="#E0A860" strokeWidth={0.8} />
      </>
    ),
  },
  {
    key: 'lemon', avoid: [5, 1], face: { cx: 18, eyeY: 17.5, eyeDx: 3, mouthY: 21.5 },
    art: () => (
      <>
        <Ellipse cx={18} cy={19} rx={11.5} ry={8.5} fill="#F2D64C" transform="rotate(-18 18 19)" />
        <Circle cx={6.5} cy={23} r={1.6} fill="#F2D64C" />
        <Circle cx={29.5} cy={15} r={1.6} fill="#F2D64C" />
        <Path d="M22 10 C24 7 27 7 29 8 C27 10 24 11 22 10 Z" fill="#2E9E62" />
      </>
    ),
  },
  {
    key: 'cherry', avoid: [3, 1, 7], face: { cx: 13, eyeY: 22, eyeDx: 1.8, mouthY: 24.8, s: 0.65, color: CREAM },
    art: () => (
      <>
        <Path d="M13 17 Q15 9 22 5 M24 18 Q22 10 22 5" stroke="#3E9E5A" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <Path d="M22 5 C25 3 28 4 30 6 C27 7.5 24 7 22 5 Z" fill="#2E9E62" />
        <Circle cx={24} cy={23} r={5.5} fill="#C8323A" />
        <Circle cx={13} cy={23} r={6.5} fill="#E4433A" />
        <Ellipse cx={10} cy={20} rx={1} ry={1.8} fill={CREAM} opacity={0.5} />
      </>
    ),
  },

  // ---------- objects & sky ----------
  {
    key: 'robot', avoid: [], face: { cx: 18, eyeY: 16.5, eyeDx: 3.6, mouthY: 21.5 },
    art: () => (
      <>
        <Path d="M18 10 V6" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
        <Circle cx={18} cy={5} r={1.9} fill="#E9655C" />
        <Rect x={6.5} y={15} width={2.6} height={6} rx={1} fill="#8E9BB8" />
        <Rect x={26.9} y={15} width={2.6} height={6} rx={1} fill="#8E9BB8" />
        <Rect x={9} y={10} width={18} height={16} rx={4} fill="#C7D0E2" />
      </>
    ),
  },
  {
    key: 'rocket', avoid: [3], face: { cx: 18, eyeY: 15.5, eyeDx: 2.2, mouthY: 19, s: 0.75 },
    art: () => (
      <>
        <Polygon points="13,20 8,28 13,26" fill="#E4433A" />
        <Polygon points="23,20 28,28 23,26" fill="#E4433A" />
        <Path d="M15 26 Q18 34 21 26 Z" fill="#F08A2E" />
        <Path d="M16.5 26 Q18 31 19.5 26 Z" fill="#F2C94C" />
        <Path d="M18 4 C24 9 25 18 23 26 H13 C11 18 12 9 18 4 Z" fill={CREAM} />
        <Path d="M18 4 C21 6.5 22 9 22.5 11 H13.5 C14 9 15 6.5 18 4 Z" fill="#E4433A" />
      </>
    ),
  },
  {
    key: 'cactus', avoid: [2], face: { cx: 18, eyeY: 15, eyeDx: 1.8, mouthY: 18.5, s: 0.65, color: CREAM },
    art: () => (
      <>
        <Path d="M11 27 H25 L23.5 33 H12.5 Z" fill="#C96A14" />
        <Rect x={10} y={25} width={16} height={3} rx={1} fill="#E8884A" />
        <Path d="M14.5 19 H11 V12" stroke="#3E9E5A" strokeWidth={4} strokeLinecap="round" fill="none" />
        <Path d="M21.5 15 H25 V8" stroke="#3E9E5A" strokeWidth={4} strokeLinecap="round" fill="none" />
        <Rect x={14.5} y={7} width={7} height={19} rx={3.5} fill="#3E9E5A" />
        <Circle cx={18} cy={6.8} r={2.4} fill="#E9655C" />
      </>
    ),
  },
  {
    key: 'cloud', avoid: [], face: { cx: 19, eyeY: 18, eyeDx: 3.2, mouthY: 22, blush: true },
    art: () => (
      <>
        <Circle cx={11.5} cy={21} r={6} fill={CREAM} />
        <Circle cx={19} cy={16} r={8.5} fill={CREAM} />
        <Circle cx={26.5} cy={21} r={6} fill={CREAM} />
        <Rect x={11.5} y={20} width={15} height={7} fill={CREAM} />
      </>
    ),
  },
  {
    key: 'sun', avoid: [5, 1, 7], face: { cx: 18, eyeY: 16.5, eyeDx: 3, mouthY: 21, blush: true },
    art: () => (
      <>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <Line key={a} x1={18} y1={4.5} x2={18} y2={8} stroke="#F2C94C" strokeWidth={2.2} strokeLinecap="round" transform={`rotate(${a} 18 18)`} />
        ))}
        <Circle cx={18} cy={18} r={9} fill="#F2C94C" />
      </>
    ),
  },
  {
    key: 'moon', avoid: [5], face: { cx: 10.5, eyeY: 16, eyeDx: 1.9, mouthY: 20, s: 0.7 },
    art: () => (
      <>
        {/* Outer arc bulges to the left; the inner one (larger radius) bulges less → a crescent. */}
        <Path d="M23 5 A13 13 0 1 0 23 31 A16 16 0 0 1 23 5 Z" fill="#F2D64C" />
        <Circle cx={27} cy={10} r={1.1} fill={CREAM} />
        <Circle cx={30} cy={17} r={0.8} fill={CREAM} />
        <Circle cx={27.5} cy={25} r={1} fill={CREAM} />
      </>
    ),
  },
  {
    key: 'star', avoid: [5, 1], face: { cx: 18, eyeY: 18.5, eyeDx: 2.6, mouthY: 22.5, s: 0.85 },
    art: () => (
      <>
        <Polygon points="18,4 21.9,13.3 32,14.2 24.3,20.8 26.6,30.7 18,25.5 9.4,30.7 11.7,20.8 4,14.2 14.1,13.3" fill="#F2C94C" />
      </>
    ),
  },
  {
    key: 'planet', avoid: [1, 7], face: { cx: 18, eyeY: 14, eyeDx: 3, mouthY: 17.2, s: 0.75 },
    art: () => (
      <>
        <Circle cx={18} cy={18} r={9} fill="#E8884A" />
        <Ellipse cx={18} cy={19} rx={14.5} ry={4} stroke="#F2D64C" strokeWidth={2.2} fill="none" transform="rotate(-18 18 19)" />
        <Circle cx={12.5} cy={22.5} r={1.5} fill="#C96A14" />
        <Circle cx={22} cy={24} r={1} fill="#C96A14" />
      </>
    ),
  },
  {
    key: 'book', avoid: [3], face: { cx: 18.5, eyeY: 17, eyeDx: 2.6, mouthY: 21, s: 0.85 },
    art: () => (
      <>
        <Rect x={8} y={7} width={20} height={23} rx={2} fill="#E9655C" />
        <Rect x={8} y={7} width={3} height={23} fill="#C94A42" />
        <Rect x={12} y={10} width={13.5} height={17} rx={1} fill={CREAM} />
        <Rect x={22} y={7} width={2.5} height={8} fill="#F2C94C" />
      </>
    ),
  },
  {
    key: 'pencil', avoid: [5, 1], face: { cx: 18, eyeY: 14, eyeDx: 1.8, mouthY: 18, s: 0.65 },
    art: () => (
      <>
        <Rect x={14} y={3} width={8} height={4} rx={1} fill="#F3A7B8" />
        <Rect x={14} y={6.5} width={8} height={2.2} fill="#8E9BB8" />
        <Rect x={14} y={8.5} width={8} height={16} fill="#F2C94C" />
        <Polygon points="14,24.5 22,24.5 18,32.5" fill="#E0A860" />
        <Polygon points="16.6,29 19.4,29 18,32.5" fill={INK} />
      </>
    ),
  },
  {
    key: 'ball', avoid: [], face: { cx: 18, eyeY: 18, eyeDx: 3, mouthY: 22 },
    art: () => (
      <>
        <Circle cx={18} cy={18} r={12.5} fill={CREAM} />
        <Polygon points="18,6.5 21.5,9 20.2,13 15.8,13 14.5,9" fill={INK} />
        <Polygon points="6,16 9.5,14 12,17 10.5,20.5 6.5,20" fill={INK} />
        <Polygon points="30,16 26.5,14 24,17 25.5,20.5 29.5,20" fill={INK} />
        <Polygon points="14,29.5 17.5,27.5 21,29.5 20,30.5 15,30.5" fill={INK} />
      </>
    ),
  },
  {
    key: 'car', avoid: [3], face: { cx: 18, eyeY: 18.5, eyeDx: 3, mouthY: 21.5, s: 0.7, color: CREAM },
    art: () => (
      <>
        <Path d="M5 25 V18 Q5 15 8 15 H11 L14 9.5 H22 L25 15 H28 Q31 15 31 18 V25 Z" fill="#E9655C" />
        <Rect x={14.5} y={10.5} width={7} height={4.5} rx={1} fill="#9FE0EA" />
        <Circle cx={11} cy={25.5} r={3.2} fill={INK} />
        <Circle cx={25} cy={25.5} r={3.2} fill={INK} />
        <Circle cx={11} cy={25.5} r={1.2} fill={CREAM} />
        <Circle cx={25} cy={25.5} r={1.2} fill={CREAM} />
      </>
    ),
  },
  {
    key: 'boat', avoid: [3, 4], face: { cx: 18, eyeY: 24.5, eyeDx: 3, mouthY: 27, s: 0.65, color: CREAM },
    art: () => (
      <>
        <Rect x={17.4} y={5} width={1.3} height={17} fill={INK} />
        <Polygon points="19.5,6 19.5,21 29,21" fill={CREAM} />
        <Polygon points="16.5,9 16.5,21 10,21" fill="#2A9DB0" />
        <Path d="M6 22 H30 L27 30 H9 Z" fill="#E9655C" />
        <Path d="M3 32.5 Q6 30.5 9 32.5 T15 32.5 T21 32.5 T27 32.5 T33 32.5" stroke={CREAM} strokeWidth={1.3} fill="none" strokeLinecap="round" />
      </>
    ),
  },
  {
    key: 'balloon', avoid: [3, 1], face: { cx: 18, eyeY: 14, eyeDx: 3, mouthY: 18, color: CREAM },
    art: () => (
      <>
        <Path d="M18 28 Q15 31 18 34" stroke={INK} strokeWidth={1} fill="none" strokeLinecap="round" />
        <Polygon points="16.5,26.5 19.5,26.5 18,28.5" fill="#E9655C" />
        <Ellipse cx={18} cy={15.5} rx={9.5} ry={11.5} fill="#E9655C" />
        <Ellipse cx={13.5} cy={10} rx={1.4} ry={3} fill={CREAM} opacity={0.5} transform="rotate(20 13.5 10)" />
      </>
    ),
  },
  {
    key: 'ghost', avoid: [], face: { cx: 18, eyeY: 17, eyeDx: 3.2, mouthY: 21 },
    art: () => (
      <>
        <Path d="M8 30 V16 A10 10 0 0 1 28 16 V30 L24.7 27.2 L21.3 30 L18 27.2 L14.7 30 L11.3 27.2 Z" fill={CREAM} />
      </>
    ),
  },

  // ---------- creatures ----------
  {
    key: 'cat', avoid: [1, 7], face: { cx: 18, eyeY: 18, eyeDx: 3.5, mouthY: 24.2, s: 0.7 },
    art: () => (
      <>
        <Polygon points="9,15 10,6 17,11" fill="#F0A35E" />
        <Polygon points="27,15 26,6 19,11" fill="#F0A35E" />
        <Polygon points="10.5,13 11,8.5 15,11.5" fill="#F6C6A0" />
        <Polygon points="25.5,13 25,8.5 21,11.5" fill="#F6C6A0" />
        <Circle cx={18} cy={19} r={10} fill="#F0A35E" />
        <Polygon points="16.8,21.6 19.2,21.6 18,23.2" fill="#E9655C" />
        <Path d="M6 20 H12 M6 23 H12 M24 20 H30 M24 23 H30" stroke={INK} strokeWidth={1} strokeLinecap="round" />
      </>
    ),
  },
  {
    key: 'dog', avoid: [1, 7], face: { cx: 18, eyeY: 15, eyeDx: 3.5, mouthY: 22.6, s: 0.7 },
    art: () => (
      <>
        <Ellipse cx={9} cy={17} rx={3.3} ry={6} fill="#7C4E2B" />
        <Ellipse cx={27} cy={17} rx={3.3} ry={6} fill="#7C4E2B" />
        <Circle cx={18} cy={18} r={10} fill="#B57A4A" />
        <Ellipse cx={18} cy={22.5} rx={5.5} ry={4} fill={CREAM} />
        <Ellipse cx={18} cy={20.5} rx={2} ry={1.5} fill={INK} />
      </>
    ),
  },
  {
    key: 'fox', avoid: [1, 3, 7], face: { cx: 18, eyeY: 18, eyeDx: 4, mouthY: 26.6, s: 0.6 },
    art: () => (
      <>
        <Polygon points="8,16 9,5 17,11" fill="#E8712C" />
        <Polygon points="28,16 27,5 19,11" fill="#E8712C" />
        <Polygon points="10,14 10.5,8 15,11.5" fill={CREAM} />
        <Polygon points="26,14 25.5,8 21,11.5" fill={CREAM} />
        <Path d="M8 16 Q18 10 28 16 Q27 24 18 30 Q9 24 8 16 Z" fill="#E8712C" />
        <Path d="M18 30 Q11 26 10 20 Q14 20 18 23 Q22 20 26 20 Q25 26 18 30 Z" fill={CREAM} />
        <Circle cx={18} cy={24.8} r={1.5} fill={INK} />
      </>
    ),
  },
  {
    key: 'owl', avoid: [7], face: { cx: 18, eyeY: 16, eyeDx: 4.5, mouthY: 22, s: 1.4, noMouth: true },
    art: () => (
      <>
        <Polygon points="10,12 11,6 15,10" fill="#8A5A3A" />
        <Polygon points="26,12 25,6 21,10" fill="#8A5A3A" />
        <Ellipse cx={18} cy={20} rx={11} ry={12} fill="#8A5A3A" />
        <Ellipse cx={18} cy={24.5} rx={6} ry={6} fill="#C99A6A" />
        <Circle cx={13.5} cy={16} r={4.2} fill={CREAM} />
        <Circle cx={22.5} cy={16} r={4.2} fill={CREAM} />
        <Polygon points="16.5,19.5 19.5,19.5 18,22.5" fill="#F08A2E" />
      </>
    ),
  },
  {
    key: 'panda', avoid: [], face: { cx: 18, eyeY: 17, eyeDx: 4, mouthY: 23.5, s: 0.8, color: CREAM, mouthColor: INK },
    art: () => (
      <>
        <Circle cx={10} cy={10} r={3.6} fill={INK} />
        <Circle cx={26} cy={10} r={3.6} fill={INK} />
        <Circle cx={18} cy={19} r={10.5} fill={CREAM} />
        <Ellipse cx={14} cy={17} rx={3} ry={3.6} fill={INK} transform="rotate(-15 14 17)" />
        <Ellipse cx={22} cy={17} rx={3} ry={3.6} fill={INK} transform="rotate(15 22 17)" />
        <Ellipse cx={18} cy={22} rx={1.8} ry={1.3} fill={INK} />
      </>
    ),
  },
  {
    key: 'frog', avoid: [2], face: { cx: 18, eyeY: 11, eyeDx: 6, mouthY: 20, s: 1.2, blush: true },
    art: () => (
      <>
        <Circle cx={12} cy={11} r={4} fill="#4CAF6A" />
        <Circle cx={24} cy={11} r={4} fill="#4CAF6A" />
        <Ellipse cx={18} cy={20} rx={12} ry={9} fill="#4CAF6A" />
        <Circle cx={12} cy={11} r={2.3} fill={CREAM} />
        <Circle cx={24} cy={11} r={2.3} fill={CREAM} />
      </>
    ),
  },
  {
    key: 'bee', avoid: [5], face: { cx: 10, eyeY: 18, eyeDx: 1.4, mouthY: 20.6, s: 0.55 },
    art: () => (
      <>
        <Ellipse cx={13} cy={10} rx={4.5} ry={3.4} fill={CREAM} opacity={0.92} transform="rotate(-20 13 10)" />
        <Ellipse cx={23} cy={10} rx={4.5} ry={3.4} fill={CREAM} opacity={0.92} transform="rotate(20 23 10)" />
        <Path d="M15 13 L13 7.5 M21 13 L23 7.5" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
        <Circle cx={13} cy={7.3} r={1.2} fill={INK} />
        <Circle cx={23} cy={7.3} r={1.2} fill={INK} />
        <Polygon points="27.5,20 31,20.5 28,22.5" fill={INK} />
        <Ellipse cx={18} cy={20} rx={10} ry={8} fill="#F2C94C" />
        <Path d="M14.5 12.7 V27.3" stroke={INK} strokeWidth={2.4} />
        <Path d="M20.5 12.2 V27.8" stroke={INK} strokeWidth={2.4} />
      </>
    ),
  },
  {
    key: 'penguin', avoid: [], face: { cx: 18, eyeY: 14, eyeDx: 3.5, mouthY: 17, s: 0.8, noMouth: true },
    art: () => (
      <>
        <Ellipse cx={14.5} cy={31.5} rx={3} ry={1.5} fill="#F08A2E" />
        <Ellipse cx={21.5} cy={31.5} rx={3} ry={1.5} fill="#F08A2E" />
        <Ellipse cx={18} cy={20} rx={10} ry={12} fill={INK} />
        <Ellipse cx={18} cy={22.5} rx={6.5} ry={8.5} fill={CREAM} />
        <Ellipse cx={18} cy={14.5} rx={6.5} ry={4.5} fill={CREAM} />
        <Polygon points="16,16.5 20,16.5 18,19.2" fill="#F08A2E" />
      </>
    ),
  },
  {
    key: 'lion', avoid: [1, 5, 7], face: { cx: 18, eyeY: 16, eyeDx: 3.2, mouthY: 22.6, s: 0.7 },
    art: () => (
      <>
        <Circle cx={18} cy={18} r={13} fill="#D9782A" />
        <Circle cx={11} cy={12} r={2.6} fill="#F0B35E" />
        <Circle cx={25} cy={12} r={2.6} fill="#F0B35E" />
        <Circle cx={18} cy={18} r={9} fill="#F0B35E" />
        <Polygon points="16.5,19.3 19.5,19.3 18,21.2" fill={INK} />
      </>
    ),
  },
  {
    key: 'chick', avoid: [1, 5], face: { cx: 18, eyeY: 17, eyeDx: 3.5, mouthY: 21, s: 0.9, noMouth: true },
    art: () => (
      <>
        <Path d="M15 30 V33.5 M21 30 V33.5" stroke="#F08A2E" strokeWidth={1.6} strokeLinecap="round" />
        <Path d="M16.5 11 C15.5 7 19 5.5 19.5 10 Z" fill="#F2C94C" />
        <Circle cx={18} cy={20} r={10} fill="#F2C94C" />
        <Ellipse cx={10} cy={21} rx={3} ry={4.5} fill="#E8B63A" />
        <Ellipse cx={26} cy={21} rx={3} ry={4.5} fill="#E8B63A" />
        <Polygon points="16,20 20,20 18,23" fill="#F08A2E" />
      </>
    ),
  },
  {
    key: 'rabbit', avoid: [], face: { cx: 18, eyeY: 20, eyeDx: 3, mouthY: 24.5, s: 0.8, blush: true },
    art: () => (
      <>
        <Ellipse cx={13.5} cy={9} rx={3} ry={8} fill={CREAM} transform="rotate(-8 13.5 9)" />
        <Ellipse cx={22.5} cy={9} rx={3} ry={8} fill={CREAM} transform="rotate(8 22.5 9)" />
        <Ellipse cx={13.5} cy={9.5} rx={1.4} ry={5.5} fill="#F3A7B8" transform="rotate(-8 13.5 9.5)" />
        <Ellipse cx={22.5} cy={9.5} rx={1.4} ry={5.5} fill="#F3A7B8" transform="rotate(8 22.5 9.5)" />
        <Circle cx={18} cy={21} r={9.5} fill={CREAM} />
        <Polygon points="17,22.3 19,22.3 18,23.5" fill="#F3A7B8" />
      </>
    ),
  },
  {
    key: 'koala', avoid: [6, 0], face: { cx: 18, eyeY: 16.5, eyeDx: 3.6, mouthY: 25.6, s: 0.7 },
    art: () => (
      <>
        <Circle cx={8.5} cy={13} r={5} fill="#8E9BB8" />
        <Circle cx={27.5} cy={13} r={5} fill="#8E9BB8" />
        <Circle cx={8.5} cy={13} r={2.8} fill="#F3A7B8" />
        <Circle cx={27.5} cy={13} r={2.8} fill="#F3A7B8" />
        <Circle cx={18} cy={19} r={10} fill="#A7B1C7" />
        <Ellipse cx={18} cy={21} rx={2.6} ry={3.4} fill={INK} />
      </>
    ),
  },
  {
    key: 'turtle', avoid: [2], face: { cx: 27.5, eyeY: 16, eyeDx: 1.8, mouthY: 18.8, s: 0.6 },
    art: () => (
      <>
        <Ellipse cx={9} cy={26} rx={3} ry={2} fill="#8BC34A" />
        <Ellipse cx={21} cy={26.5} rx={3} ry={2} fill="#8BC34A" />
        <Path d="M4 20 Q2 18 4.5 17.5" stroke="#8BC34A" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <Circle cx={27.5} cy={17} r={5.5} fill="#8BC34A" />
        <Ellipse cx={15} cy={19.5} rx={10.5} ry={8} fill="#2E9E62" />
        <Path d="M11 15.5 L15 13 L19 15.5 L19 20 L15 22.5 L11 20 Z" stroke="#1F7A4A" strokeWidth={1} fill="none" />
        <Path d="M15 13 V9 M19 15.5 L23 14 M19 20 L23 22 M11 15.5 L7 14 M11 20 L7 22" stroke="#1F7A4A" strokeWidth={1} />
      </>
    ),
  },
  {
    key: 'octopus', avoid: [3, 1, 7], face: { cx: 18, eyeY: 15, eyeDx: 3.4, mouthY: 19, color: CREAM, blush: true },
    art: () => (
      <>
        <Path d="M10 22 Q7 29 11 31.5" stroke="#E9655C" strokeWidth={3} fill="none" strokeLinecap="round" />
        <Path d="M14.5 23 Q13 30 17 32.5" stroke="#E9655C" strokeWidth={3} fill="none" strokeLinecap="round" />
        <Path d="M21.5 23 Q23 30 19 32.5" stroke="#E9655C" strokeWidth={3} fill="none" strokeLinecap="round" />
        <Path d="M26 22 Q29 29 25 31.5" stroke="#E9655C" strokeWidth={3} fill="none" strokeLinecap="round" />
        <Ellipse cx={18} cy={15} rx={10.5} ry={10} fill="#E9655C" />
      </>
    ),
  },
  {
    key: 'whale', avoid: [0, 6, 4], face: { cx: 15.5, eyeY: 18, eyeDx: 3.4, mouthY: 22, s: 0.9, color: CREAM },
    art: () => (
      <>
        <Path d="M14 11 Q14 5.5 10.5 4.5 M14 11 Q15 5.5 18.5 4.5" stroke="#9FE0EA" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <Polygon points="28,21 35,13 36,23" fill="#4A57B5" />
        <Path d="M4 20 Q5 10 17 10 Q30 10 30 20 Q30 29 17 29 Q4 29 4 20 Z" fill="#4A57B5" />
        <Path d="M6 24 Q17 32 28 24 Q17 27 6 24 Z" fill="#9FB4F0" />
      </>
    ),
  },
  {
    key: 'dino', avoid: [2], face: { cx: 24, eyeY: 11, eyeDx: 2, mouthY: 14, s: 0.65 },
    art: () => (
      <>
        <Polygon points="8,16 10,10 12.5,16" fill="#2E9E62" />
        <Polygon points="12,13 14.5,7 17,13" fill="#2E9E62" />
        <Polygon points="16.5,12 19,7 21.5,12" fill="#2E9E62" />
        <Path d="M7 24 Q2 26 3 30 Q6 29 9 27 Z" fill="#4CAF6A" />
        <Ellipse cx={16} cy={21.5} rx={10} ry={8.5} fill="#4CAF6A" />
        <Rect x={11} y={27} width={4} height={6} rx={2} fill="#4CAF6A" />
        <Rect x={18} y={27} width={4} height={6} rx={2} fill="#4CAF6A" />
        <Circle cx={24} cy={12} r={6.5} fill="#4CAF6A" />
        <Ellipse cx={17} cy={23} rx={5} ry={4} fill="#C5D86D" />
      </>
    ),
  },
  {
    key: 'snail', avoid: [1, 7], face: { cx: 10, eyeY: 20, eyeDx: 1.4, mouthY: 22.6, s: 0.55 },
    art: () => (
      <>
        <Path d="M6 29 Q6 23 12 23 H26 Q30 23 30 29 Z" fill="#C5D86D" />
        <Circle cx={10} cy={21.5} r={4.8} fill="#C5D86D" />
        <Path d="M8 17.5 L6 12 M12 17.5 L13.5 12" stroke="#8FA83A" strokeWidth={1.2} strokeLinecap="round" />
        <Circle cx={6} cy={11.5} r={1.2} fill="#8FA83A" />
        <Circle cx={13.5} cy={11.5} r={1.2} fill="#8FA83A" />
        <Circle cx={21.5} cy={16.5} r={8.5} fill="#E8884A" />
        <Path d="M21.5 16.5 m-5 0 a5 5 0 1 1 5 5 a3 3 0 1 1 3 -3 a1.5 1.5 0 1 1 -1.5 1.5" stroke="#C96A14" strokeWidth={1.3} fill="none" strokeLinecap="round" />
      </>
    ),
  },
  {
    key: 'ladybug', avoid: [3, 1, 7], face: { cx: 18, eyeY: 19.5, eyeDx: 3, mouthY: 23, color: CREAM, s: 0.85 },
    art: () => (
      <>
        <Circle cx={18} cy={10.5} r={4.5} fill={INK} />
        <Path d="M15 7 L13 3.5 M21 7 L23 3.5" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
        <Circle cx={18} cy={20} r={10.5} fill="#E4433A" />
        <Path d="M18 9.5 V15.5" stroke={INK} strokeWidth={1.2} />
        <Circle cx={11.5} cy={16} r={1.7} fill={INK} />
        <Circle cx={24.5} cy={16} r={1.7} fill={INK} />
        <Circle cx={11.5} cy={26} r={1.5} fill={INK} />
        <Circle cx={24.5} cy={26} r={1.5} fill={INK} />
        <Circle cx={18} cy={28.5} r={1.3} fill={INK} />
      </>
    ),
  },
  {
    key: 'alien', avoid: [2], face: { cx: 18, eyeY: 16, eyeDx: 4, mouthY: 23, s: 0.9, noEyes: true },
    art: () => (
      <>
        <Path d="M12 8 L9 3 M24 8 L27 3" stroke="#4CAF6A" strokeWidth={1.4} strokeLinecap="round" />
        <Circle cx={9} cy={2.8} r={1.5} fill="#F2C94C" />
        <Circle cx={27} cy={2.8} r={1.5} fill="#F2C94C" />
        <Ellipse cx={18} cy={17} rx={10.5} ry={11} fill="#4CAF6A" />
        <Ellipse cx={14} cy={16} rx={2.6} ry={3.8} fill={INK} transform="rotate(15 14 16)" />
        <Ellipse cx={22} cy={16} rx={2.6} ry={3.8} fill={INK} transform="rotate(-15 22 16)" />
        <Circle cx={14.8} cy={14.8} r={0.8} fill={CREAM} />
        <Circle cx={22.8} cy={14.8} r={0.8} fill={CREAM} />
      </>
    ),
  },
];

const BY_KEY = Object.fromEntries(CHARACTERS.map((c) => [c.key, c])) as Record<AvatarCharacter, CharacterDef>;

export interface AvatarFeatures {
  character: AvatarCharacter;
  expression: AvatarExpression;
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
    expression: EXPRESSIONS[digit(n, 2) % EXPRESSIONS.length],
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

/** The list of characters, for previews and tests. */
export const AVATAR_CHARACTERS: AvatarCharacter[] = CHARACTERS.map((c) => c.key);

// ---- the shared face ----

function Face({ a, expression }: { a: FaceAnchor; expression: AvatarExpression }) {
  const { cx, eyeY, eyeDx, mouthY, s = 1, color = INK, mouthColor, noEyes, noMouth, blush } = a;
  const mc = mouthColor ?? color;
  const lx = cx - eyeDx;
  const rx = cx + eyeDx;
  const r = 1.25 * s;

  const happyEye = (x: number) => (
    <Path d={`M${x - 1.5 * s} ${eyeY + 0.6 * s} Q${x} ${eyeY - 1.6 * s} ${x + 1.5 * s} ${eyeY + 0.6 * s}`} stroke={color} strokeWidth={1.2 * s} fill="none" strokeLinecap="round" />
  );
  const dotEye = (x: number, rr = r) => <Circle cx={x} cy={eyeY} r={rr} fill={color} />;
  const winkEye = (x: number) => <Path d={`M${x - 1.5 * s} ${eyeY} H${x + 1.5 * s}`} stroke={color} strokeWidth={1.2 * s} strokeLinecap="round" />;

  let eyes: ReactNode = null;
  if (!noEyes) {
    eyes = expression === 'laugh' ? <>{happyEye(lx)}{happyEye(rx)}</>
      : expression === 'wink' ? <>{dotEye(lx)}{winkEye(rx)}</>
      : expression === 'wow' ? <>{dotEye(lx, r * 1.25)}{dotEye(rx, r * 1.25)}</>
      : <>{dotEye(lx)}{dotEye(rx)}</>;
  }

  let mouth: ReactNode = null;
  if (!noMouth) {
    const w = 2.2 * s;
    mouth = expression === 'smile' || expression === 'wink'
      ? <Path d={`M${cx - w} ${mouthY} Q${cx} ${mouthY + 2.6 * s} ${cx + w} ${mouthY}`} stroke={mc} strokeWidth={1.2 * s} fill="none" strokeLinecap="round" />
      : expression === 'grin'
        ? <Path d={`M${cx - w * 1.3} ${mouthY} Q${cx} ${mouthY + 3.6 * s} ${cx + w * 1.3} ${mouthY} Z`} fill={mc} />
        : expression === 'laugh'
          ? (
            <>
              <Path d={`M${cx - w * 1.3} ${mouthY} Q${cx} ${mouthY + 4 * s} ${cx + w * 1.3} ${mouthY} Z`} fill={mc} />
              <Ellipse cx={cx} cy={mouthY + 1.9 * s} rx={1.5 * s} ry={0.9 * s} fill={BLUSH} />
            </>
          )
          : <Ellipse cx={cx} cy={mouthY + 0.9 * s} rx={1.1 * s} ry={1.4 * s} fill={mc} />;
  }

  return (
    <>
      {blush || expression === 'laugh' ? (
        <>
          <Circle cx={lx - 2.6 * s} cy={mouthY - 0.6 * s} r={1.3 * s} fill={BLUSH} opacity={0.45} />
          <Circle cx={rx + 2.6 * s} cy={mouthY - 0.6 * s} r={1.3 * s} fill={BLUSH} opacity={0.45} />
        </>
      ) : null}
      {eyes}
      {mouth}
    </>
  );
}

export const GeneratedAvatar = memo(function GeneratedAvatar({ seed, size = 40, square = false, label, override }: {
  /** The person's canonical seed — see `avatarSeed`. */
  seed: string;
  size?: number;
  /** Rounded square instead of a circle (for tiles). */
  square?: boolean;
  label?: string;
  /** Dev gallery only: force a character / expression regardless of the seed. */
  override?: Partial<AvatarFeatures>;
}) {
  const f = { ...avatarFeatures(seed), ...override };
  const def = BY_KEY[f.character];
  const radius = square ? SIZE * 0.28 : SIZE / 2;
  const clipId = `clip-${hashCode(seed).toString(36)}`;
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
          <G transform={`rotate(${f.tilt} ${SIZE / 2} ${SIZE / 2}) translate(${f.offsetX} ${1 + f.offsetY}) scale(0.9 0.9) translate(2 2)`}>
            {def.art()}
            <Face a={def.face} expression={f.expression} />
          </G>
        </G>
      </Svg>
    </View>
  );
});
