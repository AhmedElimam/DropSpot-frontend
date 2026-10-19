import { CONFIG_DEFAULTS } from '@/config/defaults';
import { useAppConfigStore } from '@/stores/appConfigStore';
import { shouldPersistQuery } from '../queryPersistRules';

const q = (key: string[]) => ({ queryKey: key, state: { status: 'success', dataUpdatedAt: Date.now() }, meta: undefined }) as never;
const flags = (f: Record<string, boolean>) => useAppConfigStore.setState({ config: { ...CONFIG_DEFAULTS, feature_flags: f } });

afterEach(() => useAppConfigStore.setState({ config: CONFIG_DEFAULTS }));

describe('chat and threads pages stay on disk only while their feature is on', () => {
  it('off: not written', () => {
    flags({ course_chat: false, threads: false });
    expect(shouldPersistQuery(q(['chat', 'room', '5']))).toBe(false);
    expect(shouldPersistQuery(q(['threads', 'feed']))).toBe(false);
  });
  it('on: written as before (a room still resumes from its saved page)', () => {
    flags({ course_chat: true, threads: true });
    expect(shouldPersistQuery(q(['chat', 'room', '5']))).toBe(true);
    expect(shouldPersistQuery(q(['threads', 'feed']))).toBe(true);
  });
  it('everything else is untouched', () => {
    flags({});
    expect(shouldPersistQuery(q(['teacher-students']))).toBe(true);
  });
});
