import client from './client';

/** One «شروحات» chapter: a short video of the real app, captioned (config/tutorials.php). */
export interface Tutorial {
  key: string;
  number: number;
  title: string;
  sub: string;
  url: string;
  poster: string | null;
  mb: number;
}

/** The caller's role's chapters, in order — only those whose video is on the server. */
export async function getTutorials(): Promise<Tutorial[]> {
  const { data } = await client.get('/tutorials');
  return ((data?.data ?? data)?.tutorials ?? []) as Tutorial[];
}
