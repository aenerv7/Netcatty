export const KITTY_KEYBOARD_DISAMBIGUATE_ESC_CODES = 0b1;
export const KITTY_KEYBOARD_REPORT_ALL_KEYS_AS_ESC_CODES = 0b1000;
export const KITTY_SUPPORTED_KEYBOARD_FLAGS =
  KITTY_KEYBOARD_DISAMBIGUATE_ESC_CODES |
  KITTY_KEYBOARD_REPORT_ALL_KEYS_AS_ESC_CODES;

const MAX_KEYBOARD_MODE_STACK_DEPTH = 32;

export type KittyKeyboardModeState = {
  mainFlags: number;
  alternateFlags: number;
  mainStack: number[];
  alternateStack: number[];
  alternateScreenActive: boolean;
};

export type KittyKeyboardModeApplyMode = 1 | 2 | 3;

export type KittyKeyboardControlEvent = {
  key: string;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
};

const CONTROL_KEY_CODES: Record<string, number> = {
  Escape: 27,
  Tab: 9,
  Enter: 13,
  Backspace: 127,
};

const sanitizeFlags = (flags: number): number => {
  return flags & KITTY_SUPPORTED_KEYBOARD_FLAGS;
};

const clampPositiveInteger = (value: number, fallback: number): number => {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};

export const createKittyKeyboardModeState = (): KittyKeyboardModeState => ({
  mainFlags: 0,
  alternateFlags: 0,
  mainStack: [],
  alternateStack: [],
  alternateScreenActive: false,
});

export const getKittyKeyboardModeFlags = (state: KittyKeyboardModeState): number => {
  return state.alternateScreenActive ? state.alternateFlags : state.mainFlags;
};

export const setKittyKeyboardAlternateScreenActive = (
  state: KittyKeyboardModeState,
  active: boolean,
): void => {
  state.alternateScreenActive = active;
};

export const setKittyKeyboardModeFlags = (
  state: KittyKeyboardModeState,
  flags: number,
  mode: KittyKeyboardModeApplyMode = 1,
): number => {
  const sanitized = sanitizeFlags(flags);
  const current = getKittyKeyboardModeFlags(state);

  let next = current;
  switch (mode) {
    case 1:
      next = sanitized;
      break;
    case 2:
      next = current | sanitized;
      break;
    case 3:
      next = current & ~sanitized;
      break;
  }

  if (state.alternateScreenActive) {
    state.alternateFlags = next;
  } else {
    state.mainFlags = next;
  }

  return next;
};

export const pushKittyKeyboardModeFlags = (
  state: KittyKeyboardModeState,
  flags = 0,
): number => {
  const stack = state.alternateScreenActive ? state.alternateStack : state.mainStack;
  stack.push(getKittyKeyboardModeFlags(state));
  if (stack.length > MAX_KEYBOARD_MODE_STACK_DEPTH) {
    stack.shift();
  }
  return setKittyKeyboardModeFlags(state, flags, 1);
};

export const popKittyKeyboardModeFlags = (
  state: KittyKeyboardModeState,
  count = 1,
): number => {
  const stack = state.alternateScreenActive ? state.alternateStack : state.mainStack;
  const total = clampPositiveInteger(count, 1);

  let next = 0;
  for (let i = 0; i < total; i += 1) {
    next = stack.pop() ?? 0;
  }

  if (state.alternateScreenActive) {
    state.alternateFlags = next;
  } else {
    state.mainFlags = next;
  }

  return next;
};

export const buildKittyKeyboardModeQueryResponse = (
  state: KittyKeyboardModeState,
): string => {
  return `\u001b[?${getKittyKeyboardModeFlags(state)}u`;
};

const getKittyModifierBits = (event: KittyKeyboardControlEvent): number => {
  let bits = 0;
  if (event.shiftKey) bits |= 0b1;
  if (event.altKey) bits |= 0b10;
  if (event.ctrlKey) bits |= 0b100;
  if (event.metaKey) bits |= 0b1000;
  return bits;
};

export const encodeKittyControlKey = (
  state: KittyKeyboardModeState,
  event: KittyKeyboardControlEvent,
): string | null => {
  const activeFlags = getKittyKeyboardModeFlags(state);
  const controlKeyEncodingFlags =
    KITTY_KEYBOARD_DISAMBIGUATE_ESC_CODES |
    KITTY_KEYBOARD_REPORT_ALL_KEYS_AS_ESC_CODES;

  if ((activeFlags & controlKeyEncodingFlags) === 0) {
    return null;
  }

  const keyCode = CONTROL_KEY_CODES[event.key];
  if (!keyCode) return null;

  const modifiers = getKittyModifierBits(event);

  // Keep bare Enter/Tab/Backspace on legacy bytes so the terminal remains
  // usable after a crashed app, but still allow modified forms like
  // Shift+Enter for tool UIs that need a distinct key event.
  if (event.key !== "Escape" && modifiers === 0) {
    return null;
  }

  return `\u001b[${keyCode}${modifiers ? `;${modifiers + 1}` : ""}u`;
};
