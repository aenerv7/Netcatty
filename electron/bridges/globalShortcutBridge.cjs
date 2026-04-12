/**
 * Global Shortcut Bridge - Handles global keyboard shortcuts
 * Implements the "Quake mode" / drop-down terminal feature
 */

let electronModule = null;
let currentHotkey = null;
let hotkeyEnabled = false;

/**
 * Initialize the bridge with dependencies
 */
function init(deps) {
  electronModule = deps.electronModule;
}

/**
 * Get the main window reference
 * Uses windowManager's tracked mainWindow for reliability
 */
function getMainWindow() {
  // Prefer the explicitly tracked main window from windowManager
  const windowManager = require("./windowManager.cjs");
  const tracked = windowManager.getMainWindow?.();
  if (tracked && !tracked.isDestroyed?.()) {
    return tracked;
  }
  const { BrowserWindow } = electronModule;
  const wins = BrowserWindow.getAllWindows();
  const mainWins = wins.filter((w) => !w.isDestroyed?.());
  return mainWins && mainWins.length ? mainWins[0] : null;
}

/**
 * Convert a hotkey string from frontend format to Electron accelerator format
 * e.g., "⌘ + Space" -> "CommandOrControl+Space"
 *       "Ctrl + `" -> "CommandOrControl+`"
 *       "Alt + Space" -> "Alt+Space"
 */
function toElectronAccelerator(hotkeyStr) {
  if (!hotkeyStr || hotkeyStr === "Disabled" || hotkeyStr === "") {
    return null;
  }

  // Parse the hotkey string
  const parts = hotkeyStr.split("+").map((p) => p.trim());

  // Convert each part to Electron accelerator format
  const acceleratorParts = parts.map((part) => {
    // Mac symbols to Electron format
    if (part === "⌘" || part === "Cmd" || part === "Command") {
      return "CommandOrControl";
    }
    if (part === "⌃" || part === "Ctrl" || part === "Control") {
      return "Control";
    }
    if (part === "⌥" || part === "Alt" || part === "Option") {
      return "Alt";
    }
    if (part === "Shift") {
      return "Shift";
    }
    if (part === "Win" || part === "Super" || part === "Meta") {
      return "Super";
    }
    // Arrow symbols
    if (part === "↑") return "Up";
    if (part === "↓") return "Down";
    if (part === "←") return "Left";
    if (part === "→") return "Right";
    // Special keys
    if (part === "↵" || part === "Enter" || part === "Return") return "Return";
    if (part === "⇥" || part === "Tab") return "Tab";
    if (part === "⌫" || part === "Backspace") return "Backspace";
    if (part === "Del" || part === "Delete") return "Delete";
    if (part === "Esc" || part === "Escape") return "Escape";
    if (part === "Space") return "Space";
    // Backtick/grave accent
    if (part === "`" || part === "~") return "`";
    // Function keys
    if (/^F\d+$/i.test(part)) return part.toUpperCase();
    // Single character - keep as-is
    return part;
  });

  return acceleratorParts.join("+");
}

/**
 * Toggle the main window visibility
 */
function toggleWindowVisibility() {
  const win = getMainWindow();
  if (!win) return;

  try {
    // Check if window is minimized first - minimized windows may still report isVisible() = true
    if (win.isMinimized()) {
      win.restore();
      win.show();
      win.focus();
      const { app } = electronModule;
      try {
        app.focus({ steal: true });
      } catch {
        // ignore
      }
    } else if (win.isVisible()) {
      if (win.isFocused()) {
        // Window is visible and focused - hide it
        win.hide();
      } else {
        // Window is visible but not focused - focus it
        win.focus();
        const { app } = electronModule;
        try {
          app.focus({ steal: true });
        } catch {
          // ignore
        }
      }
    } else {
      // Window is hidden - show and focus it
      win.show();
      win.focus();
      const { app } = electronModule;
      try {
        app.focus({ steal: true });
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.warn("[GlobalShortcut] Error toggling window visibility:", err);
  }
}

/**
 * Register the global toggle hotkey
 */
function registerGlobalHotkey(hotkeyStr) {
  const { globalShortcut } = electronModule;

  // Unregister existing hotkey first
  unregisterGlobalHotkey();

  if (!hotkeyStr || hotkeyStr === "Disabled" || hotkeyStr === "") {
    hotkeyEnabled = false;
    currentHotkey = null;
    return { success: true, enabled: false };
  }

  const accelerator = toElectronAccelerator(hotkeyStr);
  if (!accelerator) {
    hotkeyEnabled = false;
    currentHotkey = null;
    return { success: false, error: "Invalid hotkey format" };
  }

  try {
    const registered = globalShortcut.register(accelerator, toggleWindowVisibility);
    if (registered) {
      hotkeyEnabled = true;
      currentHotkey = hotkeyStr;
      console.log(`[GlobalShortcut] Registered hotkey: ${accelerator}`);
      return { success: true, enabled: true, accelerator };
    } else {
      console.warn(`[GlobalShortcut] Failed to register hotkey: ${accelerator}`);
      return { success: false, error: "Hotkey may be in use by another application" };
    }
  } catch (err) {
    console.error("[GlobalShortcut] Error registering hotkey:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Unregister the global toggle hotkey
 */
function unregisterGlobalHotkey() {
  if (!hotkeyEnabled || !currentHotkey) return;

  const { globalShortcut } = electronModule;
  const accelerator = toElectronAccelerator(currentHotkey);

  if (accelerator) {
    try {
      globalShortcut.unregister(accelerator);
      console.log(`[GlobalShortcut] Unregistered hotkey: ${accelerator}`);
    } catch (err) {
      console.warn("[GlobalShortcut] Error unregistering hotkey:", err);
    }
  }

  hotkeyEnabled = false;
  currentHotkey = null;
}

/**
 * Get current hotkey status
 */
function getHotkeyStatus() {
  return {
    enabled: hotkeyEnabled,
    hotkey: currentHotkey,
  };
}

/**
 * Register IPC handlers
 */
function registerHandlers(ipcMain) {
  // Register global toggle hotkey
  ipcMain.handle("netcatty:globalHotkey:register", async (_event, { hotkey }) => {
    return registerGlobalHotkey(hotkey);
  });

  // Unregister global toggle hotkey
  ipcMain.handle("netcatty:globalHotkey:unregister", async () => {
    unregisterGlobalHotkey();
    return { success: true };
  });

  // Get current hotkey status
  ipcMain.handle("netcatty:globalHotkey:status", async () => {
    return getHotkeyStatus();
  });

  console.log("[GlobalShortcut] IPC handlers registered");
}

/**
 * Cleanup on app quit
 */
function cleanup() {
  unregisterGlobalHotkey();
}

module.exports = {
  init,
  registerHandlers,
  cleanup,
};
