import client from './client';

/** The teacher's own brand logo (shown to parents). Teacher-only on the backend. */
export async function getTeacherLogo(): Promise<string | null> {
  const { data } = await client.get('/teacher/logo');
  return (data?.data?.logo_url ?? null) as string | null;
}

/**
 * `edit` = the logo editor's square (in the picture's pixels; it may reach past it) and what fills
 * the rest — the server draws it. Without it the picture is stored as it is (older servers too).
 */
export async function uploadTeacherLogo(uri: string, edit?: { crop: { x: number; y: number; size: number }; background: string }): Promise<string | null> {
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
  const type = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  const form = new FormData();
  form.append('image', { uri, name: `logo.${ext}`, type } as any);
  if (edit) {
    form.append('crop_x', String(Math.round(edit.crop.x * 100) / 100));
    form.append('crop_y', String(Math.round(edit.crop.y * 100) / 100));
    form.append('crop_size', String(Math.round(edit.crop.size * 100) / 100));
    form.append('background', edit.background);
  }
  const { data } = await client.post('/teacher/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return (data?.data?.logo_url ?? null) as string | null;
}

export async function deleteTeacherLogo(): Promise<void> {
  await client.delete('/teacher/logo');
}
