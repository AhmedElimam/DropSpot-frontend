import { arrowPoints, ellipsePoints, isShape, MAX_POINTS, STROKE_WIDTHS, type Point } from '../annotationGeometry';

describe('shapes on the exam photo', () => {
  it('a circle is a closed oval inside the dragged box, well under the point limit', () => {
    const pts = ellipsePoints([0.2, 0.3], [0.6, 0.5]);
    expect(pts.length).toBeLessThan(MAX_POINTS);
    expect(pts[0]).toEqual(pts[pts.length - 1]);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0.2 - 1e-9);
      expect(x).toBeLessThanOrEqual(0.6 + 1e-9);
      expect(y).toBeGreaterThanOrEqual(0.3 - 1e-9);
      expect(y).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it('an arrow ends at the tip, with two barbs that fold back towards the start', () => {
    const a: Point = [0.1, 0.5];
    const b: Point = [0.7, 0.5];
    const pts = arrowPoints(a, b, 1);
    expect(pts).toHaveLength(5);
    expect(pts[0]).toEqual(a);
    expect(pts[1]).toEqual(b);
    expect(pts[3]).toEqual(b);
    // Both barbs sit behind the tip (towards the start) and on either side of the shaft.
    expect(pts[2][0]).toBeLessThan(b[0]);
    expect(pts[4][0]).toBeLessThan(b[0]);
    expect(Math.sign(pts[2][1] - 0.5)).toBe(-Math.sign(pts[4][1] - 0.5));
  });

  it('every point stays on the paper, even for an arrow at the edge', () => {
    for (const [x, y] of arrowPoints([0.5, 0.5], [1, 0], 0.5)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });

  it('a slip of the finger is not a shape', () => {
    expect(isShape([0.5, 0.5], [0.505, 0.5])).toBe(false);
    expect(isShape([0.5, 0.5], [0.6, 0.5])).toBe(true);
  });

  it('pen widths stay inside what the server keeps (0.002–0.05)', () => {
    for (const w of STROKE_WIDTHS) {
      expect(w).toBeGreaterThanOrEqual(0.002);
      expect(w).toBeLessThanOrEqual(0.05);
    }
  });
});
