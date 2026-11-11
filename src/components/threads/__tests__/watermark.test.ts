import fs from 'fs';
import path from 'path';

/**
 * Founder 2026-11-12: «the video watermark is on the edge of the screen». The file pulls in the
 * native player, so the pure helpers are read from its source and checked here.
 */
const src = fs.readFileSync(path.resolve(__dirname, '../ThreadVideoPlayer.tsx'), 'utf8');
const num = (name: string) => Number(new RegExp(`const ${name} = (\\d+);`).exec(src)![1]);
const SIDE = num('WATERMARK_SIDE');
const TOP = num('WATERMARK_TOP');
const BOTTOM = num('WATERMARK_BOTTOM');
const frac = (v: number) => v - Math.floor(v);
const spot = (n: number) => ({ x: frac(0.12 + n * 0.6180339887), y: frac(0.3 + n * 0.4142135624) });
const travel = (w: number, h: number, mw: number, mh: number) => ({
  x0: SIDE, y0: TOP, travelX: Math.max(0, w - mw - 2 * SIDE), travelY: Math.max(0, h - mh - TOP - BOTTOM),
});

describe('حكاوي video watermark stays inside the picture', () => {
  it('the source still computes the travel from the measured mark, laid out left-to-right', () => {
    expect(src).toMatch(/travelX: Math\.max\(0, width - markW - 2 \* WATERMARK_SIDE\)/);
    expect(src).toMatch(/travelY: Math\.max\(0, height - markH - WATERMARK_TOP - WATERMARK_BOTTOM\)/);
    expect(src).toMatch(/width, height, direction: 'ltr'/);
    expect(src).toMatch(/onLayout=\{/);
  });

  it('at every hop the whole mark is on screen, for a short and a very long name, upright and sideways', () => {
    for (const [w, h] of [[390, 844], [360, 640], [844, 390]]) {
      // The component caps the mark at the room between the side margins (maxWidth).
      for (const mw of [180, 330, w - 2 * SIDE].map((v) => Math.min(v, w - 2 * SIDE))) {
        const mh = 44;
        const t = travel(w, h, mw, mh);
        for (let n = 0; n < 200; n++) {
          const s = spot(n);
          const left = t.x0 + s.x * t.travelX;
          const top = t.y0 + s.y * t.travelY;
          expect(left).toBeGreaterThanOrEqual(SIDE);
          expect(left + mw).toBeLessThanOrEqual(w - SIDE + 0.001);
          expect(top).toBeGreaterThanOrEqual(Math.min(TOP, h));
          if (h - mh - TOP - BOTTOM > 0) expect(top + mh).toBeLessThanOrEqual(h - BOTTOM + 0.001);
        }
      }
    }
  });
});
