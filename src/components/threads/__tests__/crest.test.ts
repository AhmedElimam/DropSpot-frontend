/**
 * The outro's crest frame (founder 2026-10-15: «the same crest border … on Madam Rose's border»):
 * the geometry must keep the laurel and the medallion inside the frame at every size (an
 * iPhone SE gets ≈ 290 pt), mirror the branches, and climb from the bottom to the top.
 */
import { LAUREL_STATIONS, STEM_FROM, STEM_TO, crestGeometry, leafPath, polar } from '../crest';

describe('crestGeometry', () => {
  it.each([220, 290, 330])('keeps every leaf and the medallion inside a %ipt frame', (size) => {
    const g = crestGeometry(size);
    const half = g.leaf.box / 2;
    for (const st of g.stations) {
      expect(st.x - half).toBeGreaterThanOrEqual(0);
      expect(st.y - half).toBeGreaterThanOrEqual(0);
      expect(st.x + half).toBeLessThanOrEqual(size);
      expect(st.y + half).toBeLessThanOrEqual(size);
    }
    expect(g.c - g.ring - g.medallion / 2).toBeGreaterThanOrEqual(0);
    expect(g.stem).toBeGreaterThan(g.ring);
    expect(g.inner).toBeLessThan(g.ring);
  });

  it('climbs the left side from the bottom to the top, pointing up the stem', () => {
    const g = crestGeometry(300);
    expect(g.stations).toHaveLength(LAUREL_STATIONS);
    for (let i = 1; i < g.stations.length; i++) {
      expect(g.stations[i].y).toBeLessThan(g.stations[i - 1].y);
      expect(g.stations[i].x).toBeLessThan(g.c);
    }
    // Left middle of the circle: the stem points straight up.
    const left = polar(150, 100, 270);
    expect(left.x).toBeCloseTo(50, 6);
    expect(left.y).toBeCloseTo(150, 6);
    const mid = g.stations.find((s) => Math.abs(s.tangent) < 12);
    expect(mid).toBeDefined();
  });

  it('draws the ring as two halves meeting at the top and sizes the dashes to them', () => {
    const g = crestGeometry(300);
    expect(g.ringLeft).toMatch(/^M 150 258 A 108 108 0 0 1 150 42$/);
    expect(g.ringRight).toMatch(/ 0 0 0 150 42$/);
    expect(g.ringHalf).toBeCloseTo(Math.PI * 108, 5);
    expect(g.stemLength).toBeCloseTo(g.stem * ((STEM_TO - STEM_FROM) * Math.PI) / 180, 5);
  });

  it('draws a leaf from the box centre upward', () => {
    expect(leafPath(40, 18, 7)).toBe('M 20 20 Q 27 11.9 20 2 Q 13 11.9 20 20 Z');
  });
});
