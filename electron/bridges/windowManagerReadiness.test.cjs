const test = require("node:test");
const assert = require("node:assert/strict");

const { isWindowUsable } = require("./windowManager.cjs");

function createWindowStub({ destroyed = false, webContents } = {}) {
  return {
    isDestroyed() {
      return destroyed;
    },
    isVisible() {
      return true;
    },
    webContents,
  };
}

test("isWindowUsable returns false when webContents is crashed", () => {
  const win = createWindowStub({
    webContents: {
      isDestroyed() {
        return false;
      },
      isCrashed() {
        return true;
      },
    },
  });

  assert.equal(isWindowUsable(win), false);
});

test("isWindowUsable returns true for a healthy live window", () => {
  const win = createWindowStub({
    webContents: {
      isDestroyed() {
        return false;
      },
      isCrashed() {
        return false;
      },
    },
  });

  assert.equal(isWindowUsable(win), true);
});

test("isWindowUsable can require a visible window", () => {
  const hiddenWin = {
    ...createWindowStub({
      webContents: {
        isDestroyed() {
          return false;
        },
        isCrashed() {
          return false;
        },
      },
    }),
    isVisible() {
      return false;
    },
  };

  assert.equal(isWindowUsable(hiddenWin, { requireVisible: true }), false);
  assert.equal(isWindowUsable(hiddenWin, { requireVisible: false }), true);
});
