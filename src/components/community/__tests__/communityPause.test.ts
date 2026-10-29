import { activePause } from '../CommunityPauseNotice';
import type { CommunityStandingDetail, CommunityStrike } from '@/api/community';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('../StandingSheet', () => ({ StandingSheet: () => null }));
jest.mock('@/components/ui/SheetModal', () => ({ SheetModal: () => null }));
jest.mock('@/components/ui/Icon', () => ({ Icon: () => null }));
jest.mock('@/ui/surfaces', () => ({ useSurface: () => true }));

const NOW = Date.parse('2026-10-29T12:00:00Z');
const strike = (o: Partial<CommunityStrike>): CommunityStrike => ({
  id: 1, level: 'warning_1', reason_label: 'سبام', created_at: '2026-10-29T10:00:00Z', ends_at: null, counting: true, appeal: null, can_appeal: true, ...o,
});
const detail = (standing: Partial<NonNullable<CommunityStandingDetail['me']['standing']>>, strikes: CommunityStrike[]): CommunityStandingDetail => ({
  me: { standing: { can_participate: false, suspended_until: null, removed: false, message: null, open_strikes: 1, ...standing }, strikes },
  children: [],
} as CommunityStandingDetail);

describe('the suspended member’s popup (founder 2026-10-29)', () => {
  it('shows nothing while the member can write', () => {
    expect(activePause(detail({ can_participate: true }, [strike({ level: 'suspension_short', ends_at: '2026-11-01T00:00:00Z' })]), NOW)).toBeNull();
  });
  it('picks the suspension in force — ops’ own pause included — not a warning or an ended one', () => {
    const d = detail({ suspended_until: '2026-11-05T00:00:00Z' }, [
      strike({ id: 9, level: 'warning_2' }),
      strike({ id: 8, level: 'suspension_manual', ends_at: '2026-11-05T00:00:00Z' }),
      strike({ id: 7, level: 'suspension_short', ends_at: '2026-10-20T00:00:00Z' }),
    ]);
    expect(activePause(d, NOW)?.id).toBe(8);
  });
  it('a removal, unless its appeal was accepted', () => {
    expect(activePause(detail({ removed: true }, [strike({ id: 4, level: 'removal' })]), NOW)?.id).toBe(4);
    expect(activePause(detail({ removed: true }, [strike({ id: 4, level: 'removal', appeal: { status: 'accepted', at: '', note: null } })]), NOW)).toBeNull();
  });
});
