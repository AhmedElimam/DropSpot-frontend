import { createElement } from 'react';

// react-test-renderer ships without type declarations here; this is the shape the test uses.
type ReactTestInstance = { type: unknown; props: Record<string, any>; parent: ReactTestInstance | null; findAll(pred: (n: ReactTestInstance) => boolean): ReactTestInstance[] };
type ReactTestRenderer = { root: ReactTestInstance; update(el: unknown): void };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer') as { act: (cb: () => void) => void; create: (el: unknown) => ReactTestRenderer };

jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `t:${k}:${JSON.stringify(o)}` : `t:${k}`) }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-svg', () => {
  const { createElement: h } = jest.requireActual('react');
  return { __esModule: true, default: (p: any) => h('Svg', p, p.children), Path: (p: any) => h('Path', p) };
});
jest.mock('expo-image-picker', () => ({}));
jest.mock('@/hooks/useComplaints', () => ({ useFileGradeComplaint: () => ({}), useFileComplaint: () => ({}) }));
jest.mock('@/utils/errors', () => ({ getFriendlyErrorMessage: () => 'error' }));

import { PhotoAnnotator } from '../PhotoAnnotator';
import { GradeComplaintStatus, gradeTargetFromExam, gradeTargetFromRecord } from '../GradeComplaintSheet';

/** A single-finger touch event shaped the way PanResponder reads it. */
function touch(x: number, y: number, t: number) {
  const record = { touchActive: true, startPageX: x, startPageY: y, startTimeStamp: t, currentPageX: x, currentPageY: y, currentTimeStamp: t, previousPageX: x, previousPageY: y, previousTimeStamp: t };
  return {
    nativeEvent: { locationX: x, locationY: y, pageX: x, pageY: y, timestamp: t, touches: [], changedTouches: [] },
    touchHistory: { touchBank: [record], numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: t },
  };
}

describe('PhotoAnnotator', () => {
  it('the circle and arrow tools draw a whole shape from one drag, and a tap is not a mark', () => {
    const onDone = jest.fn();
    let tree!: ReactTestRenderer;
    const el = (visible: boolean) => createElement(PhotoAnnotator, { visible, uri: 'file:///paper.jpg', imageSize: { width: 1000, height: 1000 }, onCancel: () => {}, onDone });
    act(() => { tree = create(el(false)); });
    act(() => { tree.update(el(true)); });
    const area = tree.root.findAll((n) => typeof n.props.onLayout === 'function' && n.props.style?.flex === 1 && n.props.style?.margin !== undefined)[0];
    act(() => { area.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 400 } } }); });
    const surface = () => tree.root.findAll((n) => typeof n.props.onResponderGrant === 'function' && typeof n.type === 'string' && n.props.style?.position === 'absolute')[0];
    const press = (label: string) => {
      const btn = tree.root.findAll((n) => typeof n.props.onPress === 'function' && n.findAll((c) => c.props.children === label).length > 0)[0];
      act(() => { btn.props.onPress(); });
    };
    const drag = (from: [number, number], to: [number, number]) => {
      act(() => { surface().props.onResponderGrant(touch(from[0], from[1], 1)); });
      act(() => { surface().props.onResponderMove(touch((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 2)); });
      act(() => { surface().props.onResponderMove(touch(to[0], to[1], 3)); });
      act(() => { surface().props.onResponderRelease(touch(to[0], to[1], 4)); });
    };

    press('t:complaints.grade.tool_circle');
    drag([100, 100], [300, 200]);
    act(() => { surface().props.onResponderGrant(touch(50, 50, 10)); });
    act(() => { surface().props.onResponderRelease(touch(50, 50, 11)); });   // a tap: ignored
    press('t:complaints.grade.tool_arrow');
    drag([50, 350], [250, 250]);
    press('t:complaints.grade.done');

    const { strokes } = onDone.mock.calls[0][0];
    expect(strokes).toHaveLength(2);
    expect(strokes[0].points.length).toBeGreaterThan(40);              // the circle
    expect(strokes[0].points[0]).toEqual(strokes[0].points[strokes[0].points.length - 1]);
    expect(strokes[1].points).toHaveLength(5);                          // shaft + two barbs
    expect(strokes[1].points[1]).toEqual([0.625, 0.625]);               // the tip, where the finger stopped
  });

  it('stores what the finger drew as fractions of the image, and undo drops the last line', () => {
    const onDone = jest.fn();
    let tree!: ReactTestRenderer;
    // A 1000×2000 photo (portrait paper) in a 400×400 drawing area → drawn 200 wide at x=100.
    const el = (visible: boolean) => createElement(PhotoAnnotator, { visible, uri: 'file:///paper.jpg', imageSize: { width: 1000, height: 2000 }, onCancel: () => {}, onDone });
    act(() => { tree = create(el(false)); });
    act(() => { tree.update(el(true)); });

    const area = tree.root.findAll((n) => typeof n.props.onLayout === 'function' && n.props.style?.flex === 1 && n.props.style?.margin !== undefined)[0];
    act(() => { area.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 400 } } }); });

    // The drawing surface: the absolutely-positioned responder over the image rect (not a button).
    const surface = () => tree.root.findAll((n) => typeof n.props.onResponderGrant === 'function' && typeof n.type === 'string' && n.props.style?.position === 'absolute')[0];
    expect(surface().props.style).toMatchObject({ left: 100, top: 0, width: 200, height: 400 });

    const draw = (pts: [number, number][]) => {
      act(() => { surface().props.onResponderGrant(touch(pts[0][0], pts[0][1], 1)); });
      pts.slice(1).forEach(([x, y], i) => act(() => { surface().props.onResponderMove(touch(x, y, i + 2)); }));
      act(() => { surface().props.onResponderRelease(touch(pts[pts.length - 1][0], pts[pts.length - 1][1], 99)); });
    };
    draw([[0, 0], [100, 200], [200, 400]]);
    draw([[50, 50]]);

    const press = (label: string) => {
      const btn = tree.root.findAll((n) => typeof n.props.onPress === 'function' && n.findAll((c) => c.props.children === label).length > 0)[0];
      act(() => { btn.props.onPress(); });
    };
    press('t:complaints.grade.undo');
    press('t:complaints.grade.done');

    expect(onDone).toHaveBeenCalledTimes(1);
    const { strokes } = onDone.mock.calls[0][0];
    expect(strokes).toHaveLength(1);
    expect(strokes[0].color).toBe('#E53935');
    expect(strokes[0].points).toEqual([[0, 0], [0.5, 0.5], [1, 1]]);
  });
});

describe('GradeComplaintStatus', () => {
  const texts = (tree: ReactTestRenderer) => tree.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);

  it('offers the link while nothing was filed', () => {
    const onComplain = jest.fn();
    let tree!: ReactTestRenderer;
    act(() => { tree = create(createElement(GradeComplaintStatus, { complaint: null, onComplain })); });
    expect(texts(tree)).toContain('t:complaints.grade.file');
  });

  it('shows the corrected mark once accepted and the reason once refused', () => {
    let tree!: ReactTestRenderer;
    act(() => { tree = create(createElement(GradeComplaintStatus, { complaint: { id: 1, status: 'approved', claimed_mark: 18, corrected_mark: 17, decision_note: null } })); });
    expect(texts(tree).some((s) => s.startsWith('t:complaints.grade.corrected_to'))).toBe(true);
    act(() => { tree = create(createElement(GradeComplaintStatus, { complaint: { id: 1, status: 'rejected', claimed_mark: 18, corrected_mark: null, decision_note: 'الإجابة ناقصة' } })); });
    expect(tree.root.findAll((n) => Array.isArray(n.props.children) && n.props.children.includes('الإجابة ناقصة')).length).toBeGreaterThan(0);
  });
});

describe('grade targets', () => {
  it('names the attendance record for a session mark and the revision attendance for a merged exam', () => {
    expect(gradeTargetFromRecord({ id: 7, course_name: 'فيزياء', date: null, score: 12, max_score: 20, percentage: 60 }, 'x')).toMatchObject({ source: 'session', recordId: 7, mark: 12, max: 20 });
    expect(gradeTargetFromExam({ source: 'revision', revision_attendance_id: 9, mark: 30, max: 50, title: 'شامل' }, 'x')).toMatchObject({ source: 'revision', recordId: 9, title: 'شامل' });
    expect(gradeTargetFromExam({ source: 'session', attendance_record_id: 4, mark: 5, max: null }, 'x')).toMatchObject({ source: 'session', recordId: 4, max: null, title: 'x' });
  });

  it('is null without a mark or a record', () => {
    expect(gradeTargetFromRecord({ id: 7, course_name: null, date: null, score: null, max_score: null, percentage: 0 }, 'x')).toBeNull();
    expect(gradeTargetFromExam({ source: 'revision', mark: 3 }, 'x')).toBeNull();
  });
});
