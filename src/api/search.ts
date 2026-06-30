import client from './client';

export interface SearchResult {
  id: string;
  type: 'student' | 'course';
  name: string;
  subtitle?: string;
}

export async function search(query: string): Promise<SearchResult[]> {
  const { data } = await client.get('/search', { params: { q: query } });
  return data.data ?? [];
}
