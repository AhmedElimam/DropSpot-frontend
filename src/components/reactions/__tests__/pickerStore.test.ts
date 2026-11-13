import {
  __resetReactionPickerForTests,
  closeReactionPicker,
  markReactionPickerTouch,
  openReactionPicker,
  reactionPickerOutsideTouch,
  useReactionPicker,
} from '../pickerStore';

const touch = (timestamp: number) => ({ nativeEvent: { timestamp } });
const open = () => useReactionPicker.getState().open;

describe('reaction picker: one open, closed by a touch elsewhere', () => {
  beforeEach(() => __resetReactionPickerForTests());

  it('opening one closes any other', () => {
    openReactionPicker('a');
    openReactionPicker('b');
    expect(open()).toBe('b');
  });

  it('a touch that began outside the picker closes it', () => {
    openReactionPicker('a');
    reactionPickerOutsideTouch(touch(100));
    expect(open()).toBeNull();
  });

  it('the touch the picker (or its button) noted first does not close it', () => {
    openReactionPicker('a');
    markReactionPickerTouch(touch(200)); // the child's handler runs before the list's
    reactionPickerOutsideTouch(touch(200));
    expect(open()).toBe('a');
    // …but the next touch elsewhere does
    reactionPickerOutsideTouch(touch(201));
    expect(open()).toBeNull();
  });

  it('closing with nothing open changes nothing', () => {
    const before = useReactionPicker.getState();
    closeReactionPicker();
    reactionPickerOutsideTouch(touch(1));
    expect(useReactionPicker.getState()).toBe(before);
  });
});
