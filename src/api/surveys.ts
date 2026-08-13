import client from './client';

/**
 * Super-admin surveys (mobile side). The server is the sole source of truth for
 * "has this person seen/answered this survey" — checked identically here and on
 * web — so a survey shows once across platforms and re-shows until answered.
 */
export type SurveyQuestion = {
  key: string;
  label: string;
  type: 'choice' | 'text';
  options: string[];
  required: boolean;
};

export interface PendingSurvey {
  id: string;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
}

/** The next survey to show (queue: one at a time), or null. Pure read — marks nothing seen. */
export async function getPendingSurvey(): Promise<PendingSurvey | null> {
  const { data } = await client.get('/surveys/pending');
  return (data.data ?? null) as PendingSurvey | null;
}

/** Mark seen — fired only once the modal is actually on screen. */
export async function markSurveyShown(id: string): Promise<void> {
  await client.post(`/surveys/${id}/shown`);
}

/** Submit answers — closes the survey on every platform. */
export async function respondSurvey(id: string, answers: Record<string, string>): Promise<void> {
  await client.post(`/surveys/${id}/respond`, { answers });
}
