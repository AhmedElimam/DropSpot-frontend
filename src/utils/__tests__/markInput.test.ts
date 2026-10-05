import { cleanMarkInput, formatMark, parseMarkInput } from '../markInput';

describe('mark input', () => {
  it('reads Arabic-Indic and Persian digits and the Arabic decimal comma', () => {
    expect(parseMarkInput('١٨')).toBe(18);
    expect(parseMarkInput('۱۷٫۵')).toBe(17.5);
    expect(parseMarkInput('12,5')).toBe(12.5);
  });

  it('keeps one decimal point and drops everything else', () => {
    expect(cleanMarkInput('1.2.3')).toBe('1.23');
    expect(cleanMarkInput('a1b5 ')).toBe('15');
  });

  it('is null for nothing', () => {
    expect(parseMarkInput('')).toBeNull();
    expect(parseMarkInput('.')).toBeNull();
    expect(parseMarkInput('abc')).toBeNull();
  });

  it('formats marks plainly', () => {
    expect(formatMark(12)).toBe('12');
    expect(formatMark(12.345)).toBe('12.35');
    expect(formatMark(null)).toBe('—');
  });
});
