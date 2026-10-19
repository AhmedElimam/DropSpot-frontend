const mockGet = jest.fn();
jest.mock('@/api/client', () => ({ __esModule: true, default: { get: (...a: unknown[]) => mockGet(...a) } }));
let mockRole: string | null = 'teacher';
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ role: mockRole }) } }));
const mockMeta = jest.fn();
jest.mock('@/ui/serverPopup', () => ({ handleServerMeta: (m: unknown) => mockMeta(m) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { homePart, __resetHomeBatch, WINDOW_MS } = require('../homeBatch') as typeof import('../homeBatch');

const wait = () => new Promise((r) => setTimeout(r, WINDOW_MS + 10));

beforeEach(() => {
  mockGet.mockReset();
  mockMeta.mockReset();
  mockRole = 'teacher';
  __resetHomeBatch();
});

describe('home batch', () => {
  it('sends calls made together as ONE request and hands each its own body', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { parts: {
      unread: { status: 200, body: { data: { count: 3 } } },
      tickets: { status: 200, body: { data: [{ id: 1 }] } },
    } } } });
    const directA = jest.fn();
    const directB = jest.fn();
    const [a, b] = await Promise.all([homePart('unread', directA), homePart('tickets', directB)]);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/teacher/home', { params: { parts: 'unread,tickets' } });
    expect(a).toEqual({ data: { count: 3 } });
    expect(b).toEqual({ data: [{ id: 1 }] });
    expect(directA).not.toHaveBeenCalled();
    expect(directB).not.toHaveBeenCalled();
  });

  it('a refused or missing part takes its own old request', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { parts: { unread: { status: 200, body: { data: { count: 1 } } }, cash: { status: 403, body: { message: 'no' } } } } } });
    const refused = Object.assign(new Error('403'), { response: { status: 403 } });
    const directCash = jest.fn(() => Promise.reject(refused));
    const directTickets = jest.fn(async () => ({ data: [] }));
    const results = await Promise.allSettled([homePart('unread', jest.fn()), homePart('cash', directCash), homePart('tickets', directTickets)]);
    expect(directCash).toHaveBeenCalledTimes(1);
    expect(directTickets).toHaveBeenCalledTimes(1); // not in the answer at all
    expect(results[1]).toEqual({ status: 'rejected', reason: refused }); // the same 403 the screen always got
    expect(results[2]).toEqual({ status: 'fulfilled', value: { data: [] } });
  });

  it('an older server without the route: everything goes straight out, and stays that way', async () => {
    mockGet.mockRejectedValueOnce(Object.assign(new Error('404'), { response: { status: 404 } }));
    const d1 = jest.fn(async () => 'u');
    const d2 = jest.fn(async () => 't');
    expect(await Promise.all([homePart('unread', d1), homePart('tickets', d2)])).toEqual(['u', 't']);
    // Next time: no batch attempt at all.
    const d3 = jest.fn(async () => 'u2');
    const d4 = jest.fn(async () => 't2');
    expect(await Promise.all([homePart('unread', d3), homePart('tickets', d4)])).toEqual(['u2', 't2']);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('no answer at all fails every call with that error — no second wait', async () => {
    const offline = Object.assign(new Error('Network Error'), { response: undefined });
    mockGet.mockRejectedValueOnce(offline);
    const d1 = jest.fn();
    const d2 = jest.fn();
    const r = await Promise.allSettled([homePart('unread', d1), homePart('tickets', d2)]);
    expect(r.map((x) => x.status)).toEqual(['rejected', 'rejected']);
    expect((r[0] as PromiseRejectedResult).reason).toBe(offline);
    expect(d1).not.toHaveBeenCalled();
    expect(d2).not.toHaveBeenCalled();
  });

  it('a lone call, or a parent, goes straight out', async () => {
    const d = jest.fn(async () => 'one');
    expect(await homePart('tickets', d)).toBe('one');
    mockRole = 'parent';
    const p1 = jest.fn(async () => 'a');
    const p2 = jest.fn(async () => 'b');
    expect(await Promise.all([homePart('unread', p1), homePart('tickets', p2)])).toEqual(['a', 'b']);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("a part's popup still shows", async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { parts: {
      unread: { status: 200, body: { data: { count: 0 }, meta: { popup: 'x' } } },
      tickets: { status: 200, body: { data: [] } },
    } } } });
    await Promise.all([homePart('unread', jest.fn()), homePart('tickets', jest.fn())]);
    expect(mockMeta).toHaveBeenCalledWith({ popup: 'x' });
    expect(mockMeta).toHaveBeenCalledTimes(1);
  });

  it('calls apart in time are separate batches', async () => {
    const d1 = jest.fn(async () => 1);
    await homePart('unread', d1);
    await wait();
    const d2 = jest.fn(async () => 2);
    await homePart('tickets', d2);
    expect(d1).toHaveBeenCalledTimes(1);
    expect(d2).toHaveBeenCalledTimes(1);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
