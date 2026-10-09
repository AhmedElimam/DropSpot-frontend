import client from './client';

/** One «شروحات» chapter: a short video of the real app, captioned (config/tutorials.php). */
export interface Tutorial {
  key: string;
  number: number;
  title: string;
  sub: string;
  url: string; // the encrypted HLS stream, signed for this user
  hls?: boolean;
  poster: string | null;
  page?: string | null; // the chapter's public watch page — the link to share
  minutes?: number;
  seconds?: number; // the video's length
  mb: number;
}

/** The caller's role's chapters, in order — only those whose video is on the server. */
export async function getTutorials(): Promise<Tutorial[]> {
  const { data } = await client.get('/tutorials');
  return ((data?.data ?? data)?.tutorials ?? []) as Tutorial[];
}
