import {
  appendPoint, containRect, denormalisePoint, normalisePoint, parseAnnotations, serialiseAnnotations,
  strokePath, strokeWidthPx, MAX_JSON_LENGTH, MAX_POINTS, MAX_STROKES, type Point, type Stroke,
} from '../annotationGeometry';

describe('containRect', () => {
  it('letterboxes a tall photo in a wide box (centred horizontally)', () => {
    expect(containRect(1000, 2000, 400, 400)).toEqual({ x: 100, y: 0, width: 200, height: 400 });
  });

  it('letterboxes a wide photo in a tall box (centred vertically)', () => {
    expect(containRect(2000, 1000, 300, 600)).toEqual({ x: 0, y: 225, width: 300, height: 150 });
  });

  it('is empty for unknown sizes', () => {
    expect(containRect(0, 100, 300, 300)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(containRect(100, 100, 0, 300).width).toBe(0);
  });
});

describe('normalise / denormalise', () => {
  const rect = { x: 100, y: 0, width: 200, height: 400 };

  it('maps a touch to a fraction of the image', () => {
    expect(normalisePoint(200, 100, rect)).toEqual([0.5, 0.25]);
  });

  it('clamps a finger that slid off the image to its edge', () => {
    expect(normalisePoint(50, -20, rect)).toEqual([0, 0]);
    expect(normalisePoint(999, 999, rect)).toEqual([1, 1]);
  });

  it('round-trips, and lands on the same paper spot at another size', () => {
    const p = normalisePoint(250, 300, rect);
    expect(denormalisePoint(p, rect)).toEqual({ x: 250, y: 300 });
    // Same photo, full screen: twice as large and offset differently.
    const big = containRect(1000, 2000, 800, 1600);
    expect(denormalisePoint(p, big)).toEqual({ x: 600, y: 1200 });
  });

  it('is safe on an empty rect', () => {
    expect(normalisePoint(10, 10, { x: 0, y: 0, width: 0, height: 0 })).toEqual([0, 0]);
  });
});

describe('strokePath / strokeWidthPx', () => {
  const rect = { x: 0, y: 0, width: 200, height: 100 };

  it('builds an M…L path in pixels', () => {
    expect(strokePath([[0, 0], [0.5, 0.5], [1, 1]], rect)).toBe('M0 0 L100 50 L200 100');
  });

  it('turns a tap into a dot', () => {
    expect(strokePath([[0.25, 0.5]], rect)).toBe('M50 50 L50 50');
  });

  it('is empty without points', () => {
    expect(strokePath([], rect)).toBe('');
  });

  it('scales the width with the drawn image, never under 1px', () => {
    expect(strokeWidthPx(0.01, rect)).toBe(2);
    expect(strokeWidthPx(0.0001, rect)).toBe(1);
  });
});

describe('appendPoint', () => {
  it('adds a point that moved, skips one that did not', () => {
    const a: Point[] = [[0.1, 0.1]];
    const b = appendPoint(a, [0.2, 0.2]);
    expect(b).toHaveLength(2);
    expect(appendPoint(b, [0.2001, 0.2001])).toBe(b);
  });

  it('stops at the server limit', () => {
    const full: Point[] = Array.from({ length: MAX_POINTS }, (_, i) => [i / MAX_POINTS, 0]);
    expect(appendPoint(full, [0.9, 0.9])).toBe(full);
  });
});

describe('parseAnnotations', () => {
  it('reads an object or a JSON string', () => {
    const v = { strokes: [{ color: '#FF0000', width: 0.01, points: [[0.1, 0.2]] }] };
    expect(parseAnnotations(v)).toEqual(v);
    expect(parseAnnotations(JSON.stringify(v))).toEqual(v);
  });

  it('drops what cannot be drawn and clamps the rest', () => {
    const out = parseAnnotations({
      strokes: [
        { color: 'red', width: -1, points: [[1.5, -0.2], ['x', 1], [0.3]] },
        { color: '#00FF00', width: 0.01, points: [] },
        'junk',
      ],
    });
    expect(out).toEqual({ strokes: [{ color: '#E53935', width: 0.008, points: [[1, 0]] }] });
  });

  it('is null for nothing readable', () => {
    expect(parseAnnotations(null)).toBeNull();
    expect(parseAnnotations('{oops')).toBeNull();
    expect(parseAnnotations({ lines: [] })).toBeNull();
  });
});

describe('serialiseAnnotations', () => {
  it('is null when nothing is drawn', () => {
    expect(serialiseAnnotations(null)).toBeNull();
    expect(serialiseAnnotations({ strokes: [] })).toBeNull();
    expect(serialiseAnnotations({ strokes: [{ color: '#000000', width: 0.008, points: [] }] })).toBeNull();
  });

  it('rounds to a thousandth and keeps the server shape', () => {
    const json = serialiseAnnotations({ strokes: [{ color: '#e53935', width: 0.008, points: [[0.123456, 0.987654]] }] });
    expect(JSON.parse(json!)).toEqual({ strokes: [{ color: '#E53935', width: 0.008, points: [[0.123, 0.988]] }] });
  });

  it('enforces the stroke limit and fits the field', () => {
    const stroke = (): Stroke => ({
      color: '#1E88E5', width: 0.008,
      points: Array.from({ length: MAX_POINTS }, (_, i) => [((i * 7919) % 1000) / 1000 + 0.0001, ((i * 104729) % 1000) / 1000 + 0.0001]),
    });
    const json = serialiseAnnotations({ strokes: Array.from({ length: MAX_STROKES + 5 }, stroke) })!;
    const parsed = JSON.parse(json);
    expect(parsed.strokes).toHaveLength(MAX_STROKES);
    expect(json.length).toBeLessThanOrEqual(MAX_JSON_LENGTH);
    // Thinning keeps each line's last point.
    const last = stroke().points[MAX_POINTS - 1];
    expect(parsed.strokes[0].points[parsed.strokes[0].points.length - 1]).toEqual([Math.round(last[0] * 1000) / 1000, Math.round(last[1] * 1000) / 1000]);
  });
});
