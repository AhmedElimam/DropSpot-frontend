/** true when `current` is a lower semver than `min` (X.Y.Z; missing parts = 0). */
export function isVersionBelow(current: string, min: string): boolean {
  const c = String(current).split('.').map((n) => parseInt(n, 10) || 0);
  const m = String(min).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((c[i] ?? 0) < (m[i] ?? 0)) return true;
    if ((c[i] ?? 0) > (m[i] ?? 0)) return false;
  }
  return false;
}
