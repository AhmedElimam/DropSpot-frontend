export function extractList(raw: any, ...keys: string[]): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  for (const key of keys) {
    if (Array.isArray(raw[key])) return raw[key];
  }
  if (raw.data && typeof raw.data === 'object') {
    if (Array.isArray(raw.data.data)) return raw.data.data;
    for (const key of keys) {
      if (Array.isArray(raw.data[key])) return raw.data[key];
    }
  }
  return [];
}

export function extractAttrs(item: any): any {
  return item?.attributes ?? item;
}
