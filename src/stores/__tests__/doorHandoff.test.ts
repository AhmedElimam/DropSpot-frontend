import { handBackToDoor, takeDoorHandoff } from '../doorHandoff';

describe('door handoff («ربط الكارت وتحضير الطالب الآن»)', () => {
  afterEach(() => { jest.useRealTimers(); takeDoorHandoff(); });

  it('hands the linked card to the scanner exactly once', () => {
    handBackToDoor('123456789012345678901234');
    expect(takeDoorHandoff()).toBe('123456789012345678901234');
    expect(takeDoorHandoff()).toBeNull();
  });

  it('drops a handoff the scanner did not pick up within two minutes', () => {
    jest.useFakeTimers();
    handBackToDoor('123456789012345678901234');
    jest.advanceTimersByTime(121_000);
    expect(takeDoorHandoff()).toBeNull();
  });

  it('is empty when nothing was linked', () => {
    expect(takeDoorHandoff()).toBeNull();
  });
});
