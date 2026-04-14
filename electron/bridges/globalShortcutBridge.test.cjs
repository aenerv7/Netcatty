const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

function withPatchedTimers(run) {
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  let nextTimerId = 1;
  const timers = new Map();

  global.setTimeout = (fn, _delay, ...args) => {
    const id = nextTimerId++;
    timers.set(id, () => fn(...args));
    return id;
  };

  global.clearTimeout = (id) => {
    timers.delete(id);
  };

  const flushNextTimer = () => {
    const nextEntry = timers.entries().next().value;
    if (!nextEntry) return false;
    const [id, fn] = nextEntry;
    timers.delete(id);
    fn();
    return true;
  };

  const getPendingTimerCount = () => timers.size;

  return Promise.resolve()
    .then(() => run({ flushNextTimer, getPendingTimerCount }))
    .finally(() => {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    });
}

function withPatchedDateNow(initialValue, run) {
  const originalDateNow = Date.now;
  let currentValue = initialValue;

  Date.now = () => currentValue;

  return Promise.resolve()
    .then(() =>
      run({
        setNow(nextValue) {
          currentValue = nextValue;
        },
      }))
    .finally(() => {
      Date.now = originalDateNow;
    });
}

function loadBridge() {
  const bridgePath = require.resolve("./globalShortcutBridge.cjs");
  delete require.cache[bridgePath];
  return require("./globalShortcutBridge.cjs");
}

function createElectronStub() {
  class FakeTray {
    constructor() {
      this.handlers = new Map();
    }

    setToolTip() {}
    setContextMenu() {}
    destroy() {}

    on(eventName, handler) {
      this.handlers.set(eventName, handler);
    }
  }

  return {
    Tray: FakeTray,
    Menu: {},
    BrowserWindow: {
      getAllWindows() {
        return [];
      },
    },
    globalShortcut: {
      register() {
        return true;
      },
      unregister() {},
    },
    nativeImage: {
      createFromPath() {
        return {
          resize() {
            return this;
          },
          setTemplateImage() {},
        };
      },
      createEmpty() {
        return {};
      },
    },
    app: {
      getAppPath() {
        return process.cwd();
      },
      quit() {},
    },
  };
}

function createIpcMainStub() {
  const handlers = new Map();
  return {
    handlers,
    handle(channel, handler) {
      handlers.set(channel, handler);
    },
  };
}

class FakeWindow extends EventEmitter {
  constructor({ fullscreen = false } = {}) {
    super();
    this.fullscreen = fullscreen;
    this.hideCalls = 0;
    this.showCalls = 0;
    this.focusCalls = 0;
    this.restoreCalls = 0;
    this.setFullScreenCalls = [];
    this.destroyed = false;
    this.minimized = false;
    this.visible = true;
    this.focused = true;
  }

  isDestroyed() {
    return this.destroyed;
  }

  isFullScreen() {
    return this.fullscreen;
  }

  setFullScreen(nextValue) {
    this.setFullScreenCalls.push(nextValue);
    if (nextValue) {
      this.fullscreen = true;
    }
  }

  isMinimized() {
    return this.minimized;
  }

  restore() {
    this.restoreCalls += 1;
    this.minimized = false;
  }

  isVisible() {
    return this.visible;
  }

  isFocused() {
    return this.focused;
  }

  hide() {
    this.hideCalls += 1;
    this.visible = false;
    this.focused = false;
  }

  show() {
    this.showCalls += 1;
    this.visible = true;
    this.emit("show");
  }

  focus() {
    this.focusCalls += 1;
    this.focused = true;
  }
}

async function withPlatform(platform, run) {
  const original = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { configurable: true, value: platform });
  try {
    return await run();
  } finally {
    Object.defineProperty(process, "platform", original);
  }
}

async function enableCloseToTray(bridge, electronModule = createElectronStub()) {
  bridge.init({ electronModule });
  const ipcMain = createIpcMainStub();
  bridge.registerHandlers(ipcMain);
  await ipcMain.handlers.get("netcatty:tray:setCloseToTray")(null, { enabled: true });
  return { ipcMain, electronModule };
}

test("handleWindowClose allows normal close when close-to-tray is disabled", () => {
  const bridge = loadBridge();
  const win = new FakeWindow();
  let prevented = false;

  const result = bridge.handleWindowClose({ preventDefault() { prevented = true; } }, win);

  assert.equal(result, false);
  assert.equal(prevented, false);
  assert.equal(win.hideCalls, 0);
});

test("handleWindowClose exits mac fullscreen before hiding to tray", async () => {
  await withPatchedTimers(async ({ flushNextTimer, getPendingTimerCount }) => {
    await withPlatform("darwin", async () => {
      const bridge = loadBridge();
      await enableCloseToTray(bridge);

      const win = new FakeWindow({ fullscreen: true });
      let prevented = false;

      const result = bridge.handleWindowClose({ preventDefault() { prevented = true; } }, win);

      assert.equal(result, true);
      assert.equal(prevented, true);
      assert.deepEqual(win.setFullScreenCalls, [false]);
      assert.equal(win.hideCalls, 0);
      assert.equal(getPendingTimerCount(), 1);

      flushNextTimer();
      assert.equal(win.hideCalls, 0);
      assert.equal(getPendingTimerCount(), 1);

      win.fullscreen = false;
      flushNextTimer();
      assert.equal(win.hideCalls, 1);
      assert.equal(getPendingTimerCount(), 0);
    });
  });
});

test("pending fullscreen hide keeps waiting after the deadline and hides once fullscreen exits", async () => {
  await withPatchedTimers(async ({ flushNextTimer, getPendingTimerCount }) => {
    await withPatchedDateNow(1000, async ({ setNow }) => {
      await withPlatform("darwin", async () => {
        const bridge = loadBridge();
        await enableCloseToTray(bridge);

        const win = new FakeWindow({ fullscreen: true });

        const result = bridge.handleWindowClose({ preventDefault() {} }, win);
        assert.equal(result, true);
        assert.equal(getPendingTimerCount(), 1);

        flushNextTimer();
        assert.equal(win.hideCalls, 0);
        assert.equal(getPendingTimerCount(), 1);

        setNow(6000);
        flushNextTimer();
        assert.equal(win.hideCalls, 0);
        assert.equal(getPendingTimerCount(), 1);
        assert.equal(win.listenerCount("leave-full-screen"), 1);
        assert.equal(win.listenerCount("show"), 1);
        assert.equal(win.listenerCount("closed"), 1);

        win.fullscreen = false;
        flushNextTimer();
        assert.equal(win.hideCalls, 1);
        assert.equal(getPendingTimerCount(), 0);
        assert.equal(win.listenerCount("leave-full-screen"), 0);
        assert.equal(win.listenerCount("show"), 0);
        assert.equal(win.listenerCount("closed"), 0);
      });
    });
  });
});

test("leave-full-screen hides immediately and clears the pending timer", async () => {
  await withPatchedTimers(async ({ flushNextTimer, getPendingTimerCount }) => {
    await withPlatform("darwin", async () => {
      const bridge = loadBridge();
      await enableCloseToTray(bridge);

      const win = new FakeWindow({ fullscreen: true });

      const result = bridge.handleWindowClose({ preventDefault() {} }, win);
      assert.equal(result, true);
      assert.equal(getPendingTimerCount(), 1);

      win.fullscreen = false;
      win.emit("leave-full-screen");

      assert.equal(win.hideCalls, 1);
      assert.equal(getPendingTimerCount(), 0);
      assert.equal(flushNextTimer(), false);
    });
  });
});

test("show event cancels a pending fullscreen hide", async () => {
  await withPatchedTimers(async ({ flushNextTimer, getPendingTimerCount }) => {
    await withPlatform("darwin", async () => {
      const bridge = loadBridge();
      await enableCloseToTray(bridge);

      const win = new FakeWindow({ fullscreen: true });

      const result = bridge.handleWindowClose({ preventDefault() {} }, win);
      assert.equal(result, true);
      assert.equal(win.listenerCount("show"), 1);
      assert.equal(getPendingTimerCount(), 1);

      win.emit("show");

      assert.equal(win.listenerCount("show"), 0);
      assert.equal(getPendingTimerCount(), 0);
      assert.equal(win.listenerCount("leave-full-screen"), 0);
      assert.equal(win.listenerCount("closed"), 0);
      assert.equal(flushNextTimer(), false);
      assert.equal(win.hideCalls, 0);
    });
  });
});

test("focusing a visible window cancels a pending fullscreen hide", async () => {
  await withPatchedTimers(async ({ getPendingTimerCount }) => {
    await withPlatform("darwin", async () => {
      const bridge = loadBridge();
      const electronModule = createElectronStub();
      const win = new FakeWindow({ fullscreen: true });
      win.focused = false;
      electronModule.BrowserWindow.getAllWindows = () => [win];
      let toggleWindow = null;
      electronModule.globalShortcut.register = (_accelerator, handler) => {
        toggleWindow = handler;
        return true;
      };
      const { ipcMain } = await enableCloseToTray(bridge, electronModule);

      await ipcMain.handlers.get("netcatty:globalHotkey:register")(null, { hotkey: "Ctrl + `" });
      const result = bridge.handleWindowClose({ preventDefault() {} }, win);
      assert.equal(result, true);
      assert.equal(getPendingTimerCount(), 1);

      toggleWindow();

      assert.equal(win.focusCalls, 1);
      assert.equal(getPendingTimerCount(), 0);
      assert.equal(win.listenerCount("leave-full-screen"), 0);
      assert.equal(win.listenerCount("show"), 0);
      assert.equal(win.listenerCount("closed"), 0);
    });
  });
});

test("openMainWindow cancels a pending fullscreen hide before showing the window", async () => {
  await withPatchedTimers(async ({ flushNextTimer, getPendingTimerCount }) => {
    await withPlatform("darwin", async () => {
      const bridge = loadBridge();
      const electronModule = createElectronStub();
      const win = new FakeWindow({ fullscreen: true });
      win.show = function showWithoutEmit() {
        this.showCalls += 1;
        this.visible = true;
      };
      electronModule.BrowserWindow.getAllWindows = () => [win];
      const { ipcMain } = await enableCloseToTray(bridge, electronModule);

      const result = bridge.handleWindowClose({ preventDefault() {} }, win);
      assert.equal(result, true);
      assert.equal(getPendingTimerCount(), 1);

      await ipcMain.handlers.get("netcatty:trayPanel:openMainWindow")();

      assert.equal(win.showCalls, 1);
      assert.equal(getPendingTimerCount(), 0);

      const flushed = flushNextTimer();
      assert.equal(flushed, false);
      assert.equal(win.hideCalls, 0);
    });
  });
});

test("closing the window clears a pending fullscreen hide", async () => {
  await withPatchedTimers(async ({ flushNextTimer, getPendingTimerCount }) => {
    await withPlatform("darwin", async () => {
      const bridge = loadBridge();
      await enableCloseToTray(bridge);

      const win = new FakeWindow({ fullscreen: true });

      const result = bridge.handleWindowClose({ preventDefault() {} }, win);
      assert.equal(result, true);
      assert.equal(getPendingTimerCount(), 1);
      assert.equal(win.listenerCount("leave-full-screen"), 1);
      assert.equal(win.listenerCount("show"), 1);
      assert.equal(win.listenerCount("closed"), 1);

      win.destroyed = true;
      win.emit("closed");

      assert.equal(getPendingTimerCount(), 0);
      assert.equal(win.listenerCount("leave-full-screen"), 0);
      assert.equal(win.listenerCount("show"), 0);
      assert.equal(win.listenerCount("closed"), 0);
      assert.equal(flushNextTimer(), false);
      assert.equal(win.hideCalls, 0);
    });
  });
});

test("disabling close-to-tray clears a pending fullscreen hide", async () => {
  await withPatchedTimers(async ({ flushNextTimer, getPendingTimerCount }) => {
    await withPlatform("darwin", async () => {
      const bridge = loadBridge();
      const electronModule = createElectronStub();
      const win = new FakeWindow({ fullscreen: true });
      electronModule.BrowserWindow.getAllWindows = () => [win];
      const { ipcMain } = await enableCloseToTray(bridge, electronModule);

      const result = bridge.handleWindowClose({ preventDefault() {} }, win);
      assert.equal(result, true);
      assert.equal(getPendingTimerCount(), 1);

      await ipcMain.handlers.get("netcatty:tray:setCloseToTray")(null, { enabled: false });

      assert.equal(getPendingTimerCount(), 0);
      assert.equal(win.listenerCount("leave-full-screen"), 0);
      assert.equal(win.listenerCount("show"), 0);
      assert.equal(win.listenerCount("closed"), 0);
      assert.equal(flushNextTimer(), false);
      assert.equal(win.hideCalls, 0);
    });
  });
});

test("handleWindowClose hides immediately when tray close is used outside fullscreen", async () => {
  await withPlatform("darwin", async () => {
    const bridge = loadBridge();
    await enableCloseToTray(bridge);

    const win = new FakeWindow({ fullscreen: false });
    let prevented = false;

    const result = bridge.handleWindowClose({ preventDefault() { prevented = true; } }, win);

    assert.equal(result, true);
    assert.equal(prevented, true);
    assert.deepEqual(win.setFullScreenCalls, []);
    assert.equal(win.hideCalls, 1);
  });
});

test("handleWindowClose stays in close-to-tray mode even if hide fails", async () => {
  await withPlatform("darwin", async () => {
    const bridge = loadBridge();
    await enableCloseToTray(bridge);

    const win = new FakeWindow({ fullscreen: false });
    win.hide = function failingHide() {
      throw new Error("hide failed");
    };
    let prevented = false;

    const result = bridge.handleWindowClose({ preventDefault() { prevented = true; } }, win);

    assert.equal(result, true);
    assert.equal(prevented, true);
    assert.equal(win.visible, true);
  });
});
