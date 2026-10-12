const mockPost = jest.fn(async () => ({ data: { ok: true } }));
jest.mock('@/api/client', () => ({ __esModule: true, default: { post: mockPost, get: jest.fn() } }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addMessage, sendStudentReport, TICKET_MAX_FILES } = require('../tickets') as typeof import('../tickets');

beforeEach(() => mockPost.mockClear());

describe('ticket messages with files', () => {
  it('sends plain JSON without files and multipart with them, never more than the cap', async () => {
    await addMessage('5', 'hi');
    expect(mockPost).toHaveBeenCalledWith('/tickets/5/messages', { message: 'hi' });
    const files = Array.from({ length: TICKET_MAX_FILES + 2 }, (_, i) => ({ uri: `file:///p${i}.jpg`, name: `p${i}.jpg`, mime: 'image/jpeg', isImage: true }));
    await addMessage('5', '', files);
    const [url, body, cfg] = mockPost.mock.calls[1] as unknown as [string, FormData, { headers: Record<string, string> }];
    expect(url).toBe('/tickets/5/messages');
    expect(cfg.headers['Content-Type']).toBe('multipart/form-data');
    const b = body as unknown as { getParts?: () => { fieldName: string }[]; entries?: () => Iterable<[string, unknown]> };
    const names = b.getParts ? b.getParts().map((p) => p.fieldName) : Array.from(b.entries?.() ?? []).map(([k]) => k);
    expect(names.filter((n) => n === 'files[]')).toHaveLength(TICKET_MAX_FILES);
    expect(names).toContain('message');
  });

  it('asks the server for the student report with no payload of its own', async () => {
    await sendStudentReport('5');
    expect(mockPost).toHaveBeenCalledWith('/tickets/5/report', {}, expect.anything());
  });
});
