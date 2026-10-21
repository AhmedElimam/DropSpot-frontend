import { existsSync } from 'fs';
import { join } from 'path';
import ar from '../../i18n/ar.json';
import { NAZER_LAYERS, NAZER_MOODS } from '../manifest';

/**
 * الناظر صلاح الدين's marks ship with the app: every layer of his face, and lines that keep
 * the house rule — facts and a nudge, never praise or a verdict on a person (the same list
 * as مدام روز's marks test).
 */
const ASSETS = join(__dirname, '../../../assets/images/nazer');
const LAYERS = ['base', 'brow_l', 'brow_r', 'mouth_smile', 'mouth_flat', 'mouth_half', 'mouth_sad', 'lid_happy_l', 'lid_happy_r', 'lid_blink_l', 'lid_blink_r', 'portrait-160'];
const PATRONISING = ['راضي', 'مبسوط', 'بتحب', 'بيعجب', 'شاطر', 'برافو', 'يوم حلو', 'أحسنت', 'تسلم إيد', 'يا بطل', 'يا قمر', 'حبيب'];

function lines(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (node && typeof node === 'object') return Object.values(node as Record<string, unknown>).flatMap(lines);
  return [];
}

describe('الناظر marks', () => {
  it('ships every layer of his face', () => {
    for (const f of LAYERS) expect(existsSync(join(ASSETS, `${f}.webp`))).toBe(true);
  });

  it('every mood only uses layers that exist, and the base is never a part', () => {
    for (const recipe of Object.values(NAZER_MOODS) as Record<string, unknown>[]) {
      for (const layer of Object.keys(recipe)) {
        expect((NAZER_LAYERS as Record<string, unknown>)[layer]).toBeTruthy();
        expect(layer).not.toBe('base');
      }
    }
  });

  it('his lines state facts and nudge, never praise', () => {
    const all = lines((ar as any).nazer);
    expect(all.length).toBeGreaterThan(20);
    for (const line of all) {
      for (const word of PATRONISING) expect(line).not.toContain(word);
    }
  });
});
