import test from "node:test";
import assert from "node:assert/strict";

import {
  buildKittyKeyboardModeQueryResponse,
  createKittyKeyboardModeState,
  encodeKittyControlKey,
  popKittyKeyboardModeFlags,
  pushKittyKeyboardModeFlags,
  setKittyKeyboardAlternateScreenActive,
  setKittyKeyboardModeFlags,
} from "./kittyKeyboardProtocol";

test("kitty keyboard query reports the active screen flags", () => {
  const state = createKittyKeyboardModeState();
  setKittyKeyboardModeFlags(state, 1, 1);
  assert.equal(buildKittyKeyboardModeQueryResponse(state), "\u001b[?1u");

  setKittyKeyboardAlternateScreenActive(state, true);
  assert.equal(buildKittyKeyboardModeQueryResponse(state), "\u001b[?0u");
});

test("kitty keyboard set mode respects replace, union, and subtract semantics", () => {
  const state = createKittyKeyboardModeState();
  setKittyKeyboardModeFlags(state, 1, 1);
  assert.equal(buildKittyKeyboardModeQueryResponse(state), "\u001b[?1u");

  setKittyKeyboardModeFlags(state, 8, 2);
  assert.equal(buildKittyKeyboardModeQueryResponse(state), "\u001b[?9u");

  setKittyKeyboardModeFlags(state, 8, 3);
  assert.equal(buildKittyKeyboardModeQueryResponse(state), "\u001b[?1u");
});

test("kitty keyboard mode stacks are independent for main and alternate screen", () => {
  const state = createKittyKeyboardModeState();
  setKittyKeyboardModeFlags(state, 1, 1);
  pushKittyKeyboardModeFlags(state, 0);
  assert.equal(buildKittyKeyboardModeQueryResponse(state), "\u001b[?0u");

  setKittyKeyboardAlternateScreenActive(state, true);
  assert.equal(buildKittyKeyboardModeQueryResponse(state), "\u001b[?0u");
  setKittyKeyboardModeFlags(state, 1, 1);
  assert.equal(buildKittyKeyboardModeQueryResponse(state), "\u001b[?1u");

  popKittyKeyboardModeFlags(state, 1);
  assert.equal(buildKittyKeyboardModeQueryResponse(state), "\u001b[?0u");

  setKittyKeyboardAlternateScreenActive(state, false);
  assert.equal(buildKittyKeyboardModeQueryResponse(state), "\u001b[?0u");
  popKittyKeyboardModeFlags(state, 1);
  assert.equal(buildKittyKeyboardModeQueryResponse(state), "\u001b[?1u");
});

test("kitty control key encoding keeps bare enter legacy but disambiguates modified enter", () => {
  const state = createKittyKeyboardModeState();
  setKittyKeyboardModeFlags(state, 1, 1);

  assert.equal(
    encodeKittyControlKey(state, { key: "Enter" }),
    null,
  );
  assert.equal(
    encodeKittyControlKey(state, { key: "Enter", shiftKey: true }),
    "\u001b[13;2u",
  );
  assert.equal(
    encodeKittyControlKey(state, { key: "Escape" }),
    "\u001b[27u",
  );
  assert.equal(
    encodeKittyControlKey(state, { key: "Backspace", ctrlKey: true, altKey: true }),
    "\u001b[127;7u",
  );
});

test("kitty report-all mode enables the supported modified control key subset", () => {
  const state = createKittyKeyboardModeState();
  setKittyKeyboardModeFlags(state, 8, 1);

  assert.equal(buildKittyKeyboardModeQueryResponse(state), "\u001b[?8u");
  assert.equal(
    encodeKittyControlKey(state, { key: "Enter", shiftKey: true }),
    "\u001b[13;2u",
  );
  assert.equal(
    encodeKittyControlKey(state, { key: "Tab", shiftKey: true }),
    "\u001b[9;2u",
  );
  assert.equal(
    encodeKittyControlKey(state, { key: "Enter" }),
    null,
  );
});
