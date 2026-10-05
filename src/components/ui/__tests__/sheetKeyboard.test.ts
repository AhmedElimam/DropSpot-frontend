import { keyboardLift } from '../SheetModal';

// Founder 2026-10-06: the keyboard covered the fields in the bottom sheets (student complaint
// sheets, the teacher's quick check-in mark). The sheet now lifts by what the keyboard covers.
describe('keyboardLift', () => {
  it('lifts by the whole keyboard when the window did not shrink (iOS, edge-to-edge Android)', () => {
    expect(keyboardLift(320, 800, 800)).toBe(320);
  });

  it('never lifts twice when the system already shrank the window', () => {
    expect(keyboardLift(320, 800, 480)).toBe(0);
    expect(keyboardLift(320, 800, 600)).toBe(120);
  });

  it('is zero with no keyboard', () => {
    expect(keyboardLift(0, 800, 800)).toBe(0);
  });
});
