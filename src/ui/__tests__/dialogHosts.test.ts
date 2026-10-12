jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock('@/hooks/useRose', () => ({ useRose: () => ({ named: false, name: '' }) }));
jest.mock('@/components/ui/BrandMark', () => ({ BrandMark: () => null }));
jest.mock('@/components/rose/RoseStamp', () => ({ RosePortrait: () => null }));
import * as fs from 'fs';
import * as path from 'path';
import { activeHost, useDialogStore } from '../dialog';

afterEach(() => useDialogStore.setState({ hosts: [], queue: [] }));

describe('popups draw in the newest open window', () => {
  it('the root host owns the queue until a modal or sheet opens, and gets it back when it closes', () => {
    expect(activeHost([])).toBe(0);
    const { addHost, removeHost } = useDialogStore.getState();
    addHost(1); // the impersonation picker opens
    expect(activeHost(useDialogStore.getState().hosts)).toBe(1);
    addHost(2); // a sheet over it
    expect(activeHost(useDialogStore.getState().hosts)).toBe(2);
    removeHost(2);
    expect(activeHost(useDialogStore.getState().hosts)).toBe(1);
    removeHost(1);
    expect(activeHost(useDialogStore.getState().hosts)).toBe(0);
  });

  it('a host that mounts twice is counted once, at the top', () => {
    const { addHost } = useDialogStore.getState();
    addHost(1);
    addHost(2);
    addHost(1);
    expect(useDialogStore.getState().hosts).toEqual([2, 1]);
  });
});

// Founder 2026-10-12: a popup raised over a raw RN Modal waited until the modal closed (iOS
// will not present a second window from the root). Every native Modal must carry a nested
// host: AppModal does, SheetModal does. Only those two and the dialog itself may use RN's.
describe('no raw native Modal outside the hosts', () => {
  it('every screen imports Modal from @/ui/AppModal', () => {
    const root = path.join(__dirname, '../../..');
    const allowed = new Set(['src/ui/dialog.tsx', 'src/ui/AppModal.tsx', 'src/components/ui/SheetModal.tsx']);
    const offenders: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(f); continue; }
        if (!/\.tsx?$/.test(e.name)) continue;
        const rel = path.relative(root, f);
        if (allowed.has(rel)) continue;
        const m = fs.readFileSync(f, 'utf8').match(/import \{([^}]*)\} from 'react-native'/);
        if (m && m[1].split(',').map((n) => n.trim()).includes('Modal')) offenders.push(rel);
      }
    };
    walk(path.join(root, 'app'));
    walk(path.join(root, 'src'));
    expect(offenders).toEqual([]);
  });
});
