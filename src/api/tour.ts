import client from './client';

/** Has this person had the spotlight tour? Stamped once on the server, so an old account gets it on whichever phone comes next. */
export async function getTourStatus(): Promise<{ completed: boolean; completed_at: string | null }> {
  const { data } = await client.get('/me/tour');
  return data.data ?? data;
}

export async function completeTour(): Promise<void> {
  await client.post('/me/tour/complete');
}
