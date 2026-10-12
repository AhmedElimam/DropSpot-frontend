let mockGates: Record<string, string> = {};
jest.mock('@/stores/appConfigStore', () => ({ useAppConfigStore: { getState: () => ({ config: { ui: { gates: mockGates } } }) } }));
import { FEATURES } from '../featureIndex';

afterEach(() => { mockGates = {}; });

const ctx = (abilities: string[], isAssistant = true) => ({ isAssistant, can: (a: string) => !isAssistant || abilities.includes(a), flags: { fast_register: true, revise_mode: true } as Record<string, unknown> });
const shows = (id: string, c: ReturnType<typeof ctx>) => { const e = FEATURES.find((f) => f.id === id)!; return !e.show || e.show(c); };

describe('search results obey the same staff gates as the menus', () => {
  it('a teacher finds everything; an assistant only what their abilities open', () => {
    expect(shows('venues', ctx([], false))).toBe(true);
    expect(shows('venues', ctx(['manage_courses']))).toBe(false); // teacher-only by default
    expect(shows('add_student', ctx([]))).toBe(false);
    expect(shows('add_student', ctx(['manage_students']))).toBe(true);
    expect(shows('record_student', ctx(['manage_students']))).toBe(true);
    expect(shows('record_student', { ...ctx(['manage_students']), flags: {} })).toBe(false); // the flag still counts
  });

  it('the server reopens a teacher-only feature to assistants with a new ability', () => {
    mockGates = { 'search.venues': 'manage_courses', 'search.scan': 'teacher' };
    expect(shows('venues', ctx(['manage_courses']))).toBe(true);
    expect(shows('scan', ctx(['scan_attendance']))).toBe(false);
    expect(shows('scan', ctx([], false))).toBe(true);
  });
});
