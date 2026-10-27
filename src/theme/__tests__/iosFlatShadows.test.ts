/**
 * The backend's ios_flat_shadows flag (a performance comparison for the back-swipe hitch,
 * 2026-10-20): off = iPhone cards keep their shadows exactly as before; on = no shadow pass.
 */
import { Platform } from 'react-native';
import { shadows, setIosFlatShadows } from '../index';

describe('iOS flat shadows switch', () => {
  const os = Platform.OS;
  beforeAll(() => { (Platform as { OS: string }).OS = 'ios'; });
  afterAll(() => { (Platform as { OS: string }).OS = os; setIosFlatShadows(false); });

  it('is off by default: iPhone cards keep their shadow', () => {
    setIosFlatShadows(false);
    expect(shadows.md.shadowOpacity).toBeGreaterThan(0);
    expect(shadows.glow.shadowRadius).toBeGreaterThan(0);
  });

  it('on: every preset draws no shadow at all', () => {
    setIosFlatShadows(true);
    for (const s of [shadows.sm, shadows.md, shadows.lg, shadows.glow]) {
      expect(s.shadowOpacity).toBe(0);
      expect(s.shadowRadius).toBe(0);
    }
  });
});
