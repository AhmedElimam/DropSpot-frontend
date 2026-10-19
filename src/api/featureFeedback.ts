import client from './client';

/** How the beta went, in one tap (backend Api\FeatureFeedbackController::MOODS). */
export type FeedbackMood = 'works' | 'issue' | 'idea';

/**
 * «رأيك يهمّنا» from the feature itself: the note becomes a ticket in the /ops queue
 * (category `beta`) and every super-admin is told. The reply comes back in «مراسلة الإدارة».
 */
export async function sendFeatureFeedback(payload: { feature: string; mood: FeedbackMood; message?: string }): Promise<{ id: number }> {
  const { data } = await client.post('/feature-feedback', payload);
  return (data.data ?? data) as { id: number };
}
