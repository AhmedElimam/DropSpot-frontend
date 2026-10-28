import { GAP_MS, GATHER_MS, modalClosed, modalOpened, resetPopupSlot, setWant, usePopupSlotStore } from '../popupSlot';

const holder = () => usePopupSlotStore.getState().holder;

beforeEach(() => { jest.useFakeTimers(); resetPopupSlot(); });
afterEach(() => { resetPopupSlot(); jest.useRealTimers(); });

describe('one app-wide popup at a time', () => {
  it('goes to the first in order when several ask together, whoever asked first', () => {
    setWant('subscription_status', true);
    setWant('rose_unlock', true);
    expect(holder()).toBeNull(); // gathering the askers
    jest.advanceTimersByTime(GATHER_MS + 20);
    expect(holder()).toBe('rose_unlock');
    setWant('rose_unlock', false);
    // The next waits the gap before presenting.
    expect(holder()).toBeNull();
    jest.advanceTimersByTime(GAP_MS - 50);
    expect(holder()).toBeNull();
    jest.advanceTimersByTime(100);
    expect(holder()).toBe('subscription_status');
  });

  it('picks by order when the slot frees with several waiting', () => {
    setWant('parent_number_check', true);
    setWant('whats_new', true);
    setWant('survey', true);
    setWant('parent_number_check', false);
    jest.advanceTimersByTime(GAP_MS + 20);
    expect(holder()).toBe('whats_new');
  });

  it('never takes the slot from the popup showing', () => {
    setWant('subscription_status', true);
    jest.advanceTimersByTime(GATHER_MS + 20);
    setWant('onboarding_intro', true);
    expect(holder()).toBe('subscription_status');
    jest.advanceTimersByTime(5_000);
    expect(holder()).toBe('subscription_status');
  });

  it('never presents over a sheet or a modal a screen has up, and waits the gap after it', () => {
    modalOpened(); // a screen's sheet
    setWant('rose_unlock', true);
    expect(holder()).toBeNull();
    jest.advanceTimersByTime(5_000);
    expect(holder()).toBeNull();
    modalClosed();
    expect(holder()).toBeNull();
    jest.advanceTimersByTime(GAP_MS + 20);
    expect(holder()).toBe('rose_unlock');
  });

  it('frees the slot when the holder stops wanting before it showed', () => {
    setWant('whats_new', true);
    setWant('whats_new', false);
    setWant('nazer_unlock', true);
    jest.advanceTimersByTime(GAP_MS + 20);
    expect(holder()).toBe('nazer_unlock');
  });

  it('the season switch: nothing presents under the curtain, then its welcome goes before مدام روز', () => {
    // The person confirms the switch; the curtain rises and the app rebuilds under it.
    modalOpened(); // the curtain
    setWant('rose_unlock', true); // her popup remounted with the rebuilt tree
    jest.advanceTimersByTime(5_000);
    expect(holder()).toBeNull();
    // The curtain falls and asks for the welcome in the same moment.
    modalClosed();
    setWant('revision_welcome', true);
    expect(holder()).toBeNull();
    jest.advanceTimersByTime(GAP_MS + 20);
    expect(holder()).toBe('revision_welcome');
    setWant('revision_welcome', false);
    jest.advanceTimersByTime(GAP_MS + 20);
    expect(holder()).toBe('rose_unlock');
  });
});
