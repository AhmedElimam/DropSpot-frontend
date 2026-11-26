import { isNightHour } from '@/components/ui/TimePicker';

// Production 2026-11-13: «١٠:٠٠ مساءً» saved for a 10 AM class (the picker starts on مساءً),
// and a 1:30 PM class saved at 1:30 AM. The sheet names such a pick and offers the swap.
describe('isNightHour', () => {
  it('flags 9 PM to before 7 AM', () => {
    [21, 22, 23, 0, 1, 6].forEach((h) => expect(isNightHour(h)).toBe(true));
  });
  it('leaves ordinary class hours alone, evenings up to 8 PM included', () => {
    [7, 8, 10, 12, 13, 16, 19, 20].forEach((h) => expect(isNightHour(h)).toBe(false));
  });
});
