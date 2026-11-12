/**
 * «حصة أونلاين» — the API module: the paths of the contract, the `{ data }` envelope, and a
 * join answer without a link being a failure rather than a blank room.
 */
const mockPost = jest.fn();
const mockGet = jest.fn();
jest.mock('@/api/client', () => ({ __esModule: true, default: { post: (...a: unknown[]) => mockPost(...a), get: (...a: unknown[]) => mockGet(...a) } }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const api = require('../remoteSession') as typeof import('../remoteSession');

const JOIN = 'https://drosspot.app/remote/room/AbC123';

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
});

describe('the paths of the contract', () => {
  it('builds each one from the ids', () => {
    expect(api.remotePaths.teacherStart(81)).toBe('/teacher/sessions/81/remote/start');
    expect(api.remotePaths.teacherJoin('81')).toBe('/teacher/sessions/81/remote/join');
    expect(api.remotePaths.teacherEnd(81)).toBe('/teacher/sessions/81/remote/end');
    expect(api.remotePaths.teacherStatus(81)).toBe('/teacher/sessions/81/remote');
    expect(api.remotePaths.studentJoin(5, 81)).toBe('/students/5/sessions/81/remote/join');
    expect(api.remotePaths.studentJoin('5', '81')).toBe('/students/5/sessions/81/remote/join');
  });

  it('an id can never add a path segment or a query', () => {
    expect(api.remotePaths.teacherStart('81/../../admin')).toBe('/teacher/sessions/81%2F..%2F..%2Fadmin/remote/start');
    expect(api.remotePaths.studentJoin('5?x=1', '81#y')).toBe('/students/5%3Fx%3D1/sessions/81%23y/remote/join');
  });
});

describe('the teacher', () => {
  it('start posts to the session and reads the link and the room out of the envelope', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { join_url: JOIN, room: { live: true, started_at: '2026-11-12T15:00:00Z' } } } });
    await expect(api.startRemoteSession(81)).resolves.toEqual({ join_url: JOIN, room: { live: true, started_at: '2026-11-12T15:00:00Z' } });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/teacher/sessions/81/remote/start');
  });

  it('join posts to the session and answers with the link', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { join_url: JOIN } } });
    await expect(api.joinRemoteSessionAsTeacher('81')).resolves.toBe(JOIN);
    expect(mockPost).toHaveBeenCalledWith('/teacher/sessions/81/remote/join');
  });

  it('end posts to the session and says the room is closed', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { room: { live: false, started_at: '2026-11-12T15:00:00Z', ended_at: '2026-11-12T16:00:00Z' } } } });
    await expect(api.endRemoteSession(81)).resolves.toEqual({ live: false, started_at: '2026-11-12T15:00:00Z', ended_at: '2026-11-12T16:00:00Z' });
    expect(mockPost).toHaveBeenCalledWith('/teacher/sessions/81/remote/end');
  });

  it('the status reads the room, the minutes needed and who watched', async () => {
    const viewers = [{ student_id: 5, name: 'منى', watched_minutes: 12, online: true, checked_in: true }];
    mockGet.mockResolvedValueOnce({ data: { data: { room: { live: true, started_at: '2026-11-12T15:00:00Z', ended_at: null }, needed_minutes: 10, viewers } } });
    await expect(api.getRemoteSessionStatus(81)).resolves.toEqual({ room: { live: true, started_at: '2026-11-12T15:00:00Z', ended_at: null }, needed_minutes: 10, viewers });
    expect(mockGet).toHaveBeenCalledWith('/teacher/sessions/81/remote');
  });

  it('a thin status answer is filled with safe values, never undefined', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: {} } });
    await expect(api.getRemoteSessionStatus(81)).resolves.toEqual({ room: { live: false, started_at: null, ended_at: null }, needed_minutes: 0, viewers: [] });
  });
});

describe('the student — and a parent with the child\'s id', () => {
  it('join posts to that student\'s session and answers with the link', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { join_url: JOIN } } });
    await expect(api.joinRemoteSessionAsStudent(5, 81)).resolves.toBe(JOIN);
    expect(mockPost).toHaveBeenCalledWith('/students/5/sessions/81/remote/join');
  });
});

describe('answers', () => {
  it('a bare body (no envelope) is read the same', async () => {
    mockPost.mockResolvedValueOnce({ data: { join_url: JOIN } });
    await expect(api.joinRemoteSessionAsTeacher(81)).resolves.toBe(JOIN);
  });

  it('an answer without a usable link is a failure, not a blank room', async () => {
    for (const body of [{ data: {} }, { data: { join_url: '' } }, { data: { join_url: null } }, { data: { join_url: 7 } }, {}, null, 'ok']) {
      mockPost.mockResolvedValueOnce({ data: body });
      await expect(api.joinRemoteSessionAsStudent(5, 81)).rejects.toThrow(/join_url/);
    }
  });

  it('a link is asked for every time — nothing is remembered between calls', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { join_url: `${JOIN}1` } } }).mockResolvedValueOnce({ data: { data: { join_url: `${JOIN}2` } } });
    expect(await api.joinRemoteSessionAsStudent(5, 81)).toBe(`${JOIN}1`);
    expect(await api.joinRemoteSessionAsStudent(5, 81)).toBe(`${JOIN}2`);
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it('a refusal is passed on untouched, for the caller to explain', async () => {
    const refusal = { response: { status: 409, data: { code: 'REMOTE_NOT_LIVE', message: 'الحصة دي مش أونلاين دلوقتي' } } };
    mockPost.mockRejectedValueOnce(refusal);
    await expect(api.joinRemoteSessionAsStudent(5, 81)).rejects.toBe(refusal);
  });
});

describe('refusals', () => {
  const err = (status: number, data: Record<string, unknown>) => ({ response: { status, data } });

  it('reads the machine code', () => {
    expect(api.remoteErrorCode(err(409, { code: 'REMOTE_NOT_LIVE', message: 'x' }))).toBe('REMOTE_NOT_LIVE');
    expect(api.remoteErrorCode(err(503, { code: 'REMOTE_NOT_CONFIGURED' }))).toBe('REMOTE_NOT_CONFIGURED');
    expect(api.remoteErrorCode(err(403, { code: 'BILLING_BLOCKED' }))).toBe('BILLING_BLOCKED');
    expect(api.remoteErrorCode(err(500, {}))).toBeNull();
    expect(api.remoteErrorCode(err(422, { code: 7 }))).toBeNull();
    expect(api.remoteErrorCode(new Error('offline'))).toBeNull();
    expect(api.remoteErrorCode(null)).toBeNull();
  });

  it('shows the server\'s own Arabic sentence, whatever the status — a 503 included', () => {
    expect(api.remoteErrorSentence(err(503, { code: 'REMOTE_NOT_CONFIGURED', message: 'البث المباشر لسه مش متجهّز' }))).toBe('البث المباشر لسه مش متجهّز');
    expect(api.remoteErrorSentence(err(409, { message: 'الحصة دي مش أونلاين دلوقتي' }))).toBe('الحصة دي مش أونلاين دلوقتي');
    expect(api.remoteErrorSentence(err(403, { code: 'BILLING_BLOCKED', message: 'عليك فاتورة متأخرة' }))).toBe('عليك فاتورة متأخرة');
  });

  it('never shows a raw, non-Arabic or oversized string, nor a signed-out answer', () => {
    expect(api.remoteErrorSentence(err(500, { message: 'SQLSTATE[HY000]: General error' }))).toBeNull();
    expect(api.remoteErrorSentence(err(422, { message: '' }))).toBeNull();
    expect(api.remoteErrorSentence(err(422, { message: 'خطأ '.repeat(100) }))).toBeNull();
    expect(api.remoteErrorSentence(err(401, { message: 'انتهت الجلسة' }))).toBeNull();
    expect(api.remoteErrorSentence(new Error('offline'))).toBeNull();
    expect(api.remoteErrorSentence(undefined)).toBeNull();
  });
});
