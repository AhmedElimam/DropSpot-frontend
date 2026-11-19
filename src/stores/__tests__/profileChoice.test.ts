const saved: Record<string, string> = {};
let mockBroken = false;
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => { if (mockBroken) throw new Error('storage'); return k in saved ? saved[k] : null; }),
    setItem: jest.fn(async (k: string, v: string) => { if (mockBroken) throw new Error('storage'); saved[k] = v; }),
  },
}));

import { readRememberedProfile, rememberProfile } from '../profileChoice';

beforeEach(() => {
  for (const k of Object.keys(saved)) delete saved[k];
  mockBroken = false;
});

describe('the profile remembered on a shared phone', () => {
  it('reads back what was chosen, per phone holder', async () => {
    await rememberProfile(41, 57);
    expect(await readRememberedProfile(41)).toBe(57);
    expect(await readRememberedProfile(99)).toBeNull();
  });

  it('a later choice replaces the earlier one', async () => {
    await rememberProfile(41, 57);
    await rememberProfile(41, 41);
    expect(await readRememberedProfile(41)).toBe(41);
  });

  it('no holder → nothing stored, nothing read', async () => {
    await rememberProfile(null, 57);
    expect(Object.keys(saved)).toEqual([]);
    expect(await readRememberedProfile(null)).toBeNull();
  });

  it('a junk value or a broken storage reads as nothing remembered', async () => {
    saved.shared_phone_choice_41 = 'abc';
    expect(await readRememberedProfile(41)).toBeNull();
    mockBroken = true;
    expect(await readRememberedProfile(41)).toBeNull();
    await expect(rememberProfile(41, 57)).resolves.toBeUndefined();
  });
});
