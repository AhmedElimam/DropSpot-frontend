import { applyScheme, colors } from '@/theme/index';
import { chat, senderColor, senderFill } from '@/theme/chat';

/**
 * Founder 2026-11-12: «the chat on dark mode doesn't show the right colours». The tokens were a
 * plain object read once at first import, so the room kept the scheme the app started in.
 */
describe('chat tokens follow the live scheme', () => {
  afterAll(() => applyScheme('light'));

  it('reads the palette at use, not at import', () => {
    applyScheme('light');
    const day = { theirs: chat.bubbleTheirs, text: chat.text, canvas: chat.canvas, staff: chat.bubbleStaff, name: senderColor(3) };
    applyScheme('dark');
    expect(chat.bubbleTheirs).toBe(colors.surface);
    expect(chat.text).toBe(colors.textPrimary);
    expect(chat.canvas).toBe(colors.background);
    expect(chat.bubbleTheirs).not.toBe(day.theirs);
    expect(chat.text).not.toBe(day.text);
    expect(chat.canvas).not.toBe(day.canvas);
    expect(chat.bubbleStaff).not.toBe(day.staff);
    expect(senderColor(3)).not.toBe(day.name);
  });

  it('an avatar fill is the same in both schemes (white initials sit on it)', () => {
    applyScheme('light');
    const day = senderFill(7);
    applyScheme('dark');
    expect(senderFill(7)).toBe(day);
  });
});
