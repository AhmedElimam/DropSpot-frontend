import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { PERSIST_MAX_AGE_MS, dropOtherDays, shouldPersistQuery } from '../queryPersistRules';

const NOW = new Date(2026, 9, 9, 18, 0).getTime();
const YESTERDAY = new Date(2026, 9, 8, 22, 0).getTime();
const THIS_MORNING = new Date(2026, 9, 9, 7, 0).getTime();

function q(queryKey: unknown[], dataUpdatedAt = NOW, status = 'success', meta?: Record<string, unknown>) {
  return { queryKey, meta, state: { status, dataUpdatedAt } } as unknown as Parameters<typeof shouldPersistQuery>[0];
}

describe('shouldPersistQuery', () => {
  it('keeps settled screen data', () => {
    expect(shouldPersistQuery(q(['teacher-student', 12]), NOW)).toBe(true);
  });

  it('skips failed or loading queries', () => {
    expect(shouldPersistQuery(q(['teacher-student', 12], NOW, 'error'), NOW)).toBe(false);
    expect(shouldPersistQuery(q(['teacher-student', 12], NOW, 'pending'), NOW)).toBe(false);
  });

  it('never stores one-time gates, link tokens or search', () => {
    for (const k of ['pending-survey', 'teacher-onboarding', 'tour-status', 'release-notes', 'invitation', 'parent-setup', 'imp-users', 'search']) {
      expect(shouldPersistQuery(q([k]), NOW)).toBe(false);
    }
  });

  it('honours a per-query opt-out', () => {
    expect(shouldPersistQuery(q(['venues'], NOW, 'success', { persist: false }), NOW)).toBe(false);
  });

  it('drops data older than the max age', () => {
    expect(shouldPersistQuery(q(['venues'], NOW - PERSIST_MAX_AGE_MS - 1), NOW)).toBe(false);
  });
});

describe('dropOtherDays', () => {
  const client = (queries: { queryKey: unknown[]; at: number }[]) => ({
    timestamp: NOW, buster: '1',
    clientState: { mutations: [], queries: queries.map(({ queryKey, at }) => ({ queryKey, queryHash: JSON.stringify(queryKey), state: { dataUpdatedAt: at } })) },
  }) as unknown as PersistedClient;

  it("never brings back yesterday's «today» as today's", () => {
    const out = dropOtherDays(client([
      { queryKey: ['teacher-sessions-today'], at: YESTERDAY },
      { queryKey: ['sessions', 'today', 5], at: YESTERDAY },
      { queryKey: ['today-feed'], at: THIS_MORNING },
      { queryKey: ['teacher-students'], at: YESTERDAY },
      { queryKey: ['sessions', 'upcoming', 5, 20], at: YESTERDAY },
    ]), NOW);
    expect(out.clientState.queries.map((x) => x.queryKey)).toEqual([
      ['today-feed'], ['teacher-students'], ['sessions', 'upcoming', 5, 20],
    ]);
  });
});
