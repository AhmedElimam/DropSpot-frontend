import client from './client';

/** The teacher's own brand logo (shown to parents). Teacher-only on the backend. */
export async function getTeacherLogo(): Promise<string | null> {
  const { data } = await client.get('/teacher/logo');
  return (data?.data?.logo_url ?? null) as string | null;
}

export async function uploadTeacherLogo(uri: string): Promise<string | null> {
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
  const type = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  const form = new FormData();
  form.append('image', { uri, name: `logo.${ext}`, type } as any);
  const { data } = await client.post('/teacher/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return (data?.data?.logo_url ?? null) as string | null;
}

export async function deleteTeacherLogo(): Promise<void> {
  await client.delete('/teacher/logo');
}
