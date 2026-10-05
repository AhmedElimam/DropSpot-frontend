const mockPost = jest.fn();
jest.mock('../client', () => ({ __esModule: true, default: { post: (...a: unknown[]) => mockPost(...a) } }));

import { approveComplaint, fileGradeComplaint } from '../complaints';

const ok = { data: { data: { id: '5', attributes: { type: 'grade', status: 'pending', claimed_mark: '18', photo_annotations: '{"strokes":[]}' } } } };

/** React Native's FormData keeps a file part as the { uri, name, type } object; Node's would stringify it. */
class RecordingFormData {
  parts: [string, unknown][] = [];
  append(name: string, value: unknown) { this.parts.push([name, value]); }
}
const realFormData = global.FormData;
beforeAll(() => { (global as any).FormData = RecordingFormData; });
afterAll(() => { (global as any).FormData = realFormData; });

const partsOf = (form: any): [string, any][] => (form as RecordingFormData).parts;

describe('fileGradeComplaint', () => {
  beforeEach(() => mockPost.mockReset().mockResolvedValue(ok));

  it('sends JSON without a photo — to the student door, or the parent door with student_id', async () => {
    const c = await fileGradeComplaint({ attendance_record_id: 7, claimed_mark: 18, note: '  السؤال ٣  ' });
    expect(mockPost).toHaveBeenCalledWith('/students/complaints', { type: 'grade', attendance_record_id: 7, claimed_mark: 18, note: 'السؤال ٣' });
    expect(c).toMatchObject({ id: 5, claimed_mark: 18, photo_annotations: { strokes: [] } });

    await fileGradeComplaint({ revision_attendance_id: 9, note: 'x', student_id: 3 });
    expect(mockPost).toHaveBeenLastCalledWith('/parents/complaints', { type: 'grade', student_id: 3, revision_attendance_id: 9, note: 'x' });
  });

  it('sends multipart with the photo and the drawing as a JSON string', async () => {
    await fileGradeComplaint({
      attendance_record_id: 7,
      photo: { uri: 'file:///tmp/ImagePicker/abc.jpeg', mimeType: 'image/jpeg' },
      annotations: { strokes: [{ color: '#e53935', width: 0.008, points: [[0.12345, 0.5]] }] },
    });
    const [url, form, config] = mockPost.mock.calls[0];
    expect(url).toBe('/students/complaints');
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
    const parts = partsOf(form);
    const get = (k: string) => parts.find(([n]) => n === k)?.[1];
    expect(get('type')).toBe('grade');
    expect(get('attendance_record_id')).toBe('7');
    expect(get('claimed_mark')).toBeUndefined();
    expect(JSON.parse(get('annotations'))).toEqual({ strokes: [{ color: '#E53935', width: 0.008, points: [[0.123, 0.5]] }] });
    const photo = get('photo');
    expect(photo).toMatchObject({ uri: 'file:///tmp/ImagePicker/abc.jpeg', name: 'abc.jpeg', type: 'image/jpeg' });
  });

  it('leaves out an empty drawing', async () => {
    await fileGradeComplaint({ attendance_record_id: 7, photo: { uri: 'file:///x/p.png' }, annotations: { strokes: [] } });
    const parts = partsOf(mockPost.mock.calls[0][1]);
    expect(parts.find(([n]) => n === 'annotations')).toBeUndefined();
    expect(parts.find(([n]) => n === 'photo')?.[1]).toMatchObject({ name: 'p.png', type: 'image/png' });
  });
});

describe('approveComplaint', () => {
  beforeEach(() => mockPost.mockReset().mockResolvedValue({ data: {} }));

  it('carries the corrected mark only when given', async () => {
    await approveComplaint(4, 17.5);
    expect(mockPost).toHaveBeenLastCalledWith('/teacher/complaints/4/approve', { mark: 17.5 });
    await approveComplaint(4);
    expect(mockPost).toHaveBeenLastCalledWith('/teacher/complaints/4/approve', {});
  });
});
