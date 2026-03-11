/**
 * Auto-Update Bridge
 *
 * Wraps electron-updater to provide IPC-driven update checks, downloads, and
 * install-on-quit. Designed around a "prompt" model: the renderer asks to
 * check, then explicitly triggers download and install.
 *
 * Platforms where auto-update is NOT supported (Linux deb/rpm/snap) get a
 * graceful { available: false, error } response so the renderer can fall back
 * to a manual "open GitHub releases" link.
 */

let _deps = null;

/**
 * Returns true when the current packaging format supports electron-updater
 * (macOS zip/dmg, Windows NSIS, Linux AppImage).
 */
function isAutoUpdateSupported() {
  if (process.platform === "darwin" || process.platform === "win32") {
    return true;
  }
  // Linux: only AppImage supports in-place update.
  // The APPIMAGE env variable is set by the AppImage runtime.
  if (process.platform === "linux" && process.env.APPIMAGE) {
    return true;
  }
  return false;
}

/** Lazily resolved autoUpdater — avoids importing electron-updater in
 *  contexts where native modules might not be available. */
let _autoUpdater = null;

/** Guard against duplicate listener registration */
let _listenersRegistered = false;

/** Track whether a download is in progress to distinguish download errors from check errors */
let _isDownloading = false;
function getAutoUpdater() {
  if (_autoUpdater) return _autoUpdater;
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    // Silence the default electron-log transport (we log ourselves).
    autoUpdater.logger = null;
    _autoUpdater = autoUpdater;
    return autoUpdater;
  } catch (err) {
    console.error("[AutoUpdate] Failed to load electron-updater:", err?.message || err);
    return null;
  }
}

/**
 * Register persistent global IPC event listeners for auto-download flow.
 * Called once in init(). Forwards electron-updater events to the renderer
 * even when no manual download was initiated.
 */
function setupGlobalListeners() {
  if (_listenersRegistered) return;
  const updater = getAutoUpdater();
  if (!updater) return;
  _listenersRegistered = true;

  updater.on("update-available", (info) => {
    // autoDownload=true means the download begins immediately after this event
    _isDownloading = true;
    broadcastToAllWindows("netcatty:update:update-available", {
      version: info.version || "",
      releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : "",
      releaseDate: info.releaseDate || null,
    });
  });

  updater.on("download-progress", (info) => {
    broadcastToAllWindows("netcatty:update:download-progress", {
      percent: info.percent ?? 0,
      bytesPerSecond: info.bytesPerSecond ?? 0,
      transferred: info.transferred ?? 0,
      total: info.total ?? 0,
    });
  });

  updater.on("update-downloaded", () => {
    _isDownloading = false;
    broadcastToAllWindows("netcatty:update:downloaded");
  });

  updater.on("error", (err) => {
    // Only broadcast download-phase errors; check-phase errors (e.g. network failures
    // during checkForUpdates) are not download failures and must not set autoDownloadStatus.
    if (!_isDownloading) {
      console.warn("[AutoUpdate] Check-phase error (not broadcast to renderer):", err?.message || err);
      return;
    }
    _isDownloading = false;
    broadcastToAllWindows("netcatty:update:error", {
      error: err?.message || "Unknown update error",
    });
  });

  console.log("[AutoUpdate] Global listeners registered");
}

/**
 * Trigger an automatic update check after a delay.
 * No-op on platforms that don't support auto-update (Linux deb/rpm/snap).
 * Called from main process after the main window is created.
 *
 * @param {number} delayMs - Milliseconds to wait before checking (default: 5000)
 */
function startAutoCheck(delayMs = 5000) {
  if (!isAutoUpdateSupported()) {
    console.log("[AutoUpdate] Platform does not support auto-update, skipping auto-check");
    return;
  }
  setTimeout(async () => {
    try {
      console.log("[AutoUpdate] Starting automatic update check...");
      await getAutoUpdater()?.checkForUpdates();
    } catch (err) {
      console.warn("[AutoUpdate] Auto-check failed:", err?.message || err);
    }
  }, delayMs);
}

function init(deps) {
  _deps = deps;
  setupGlobalListeners();
}

/**
 * Broadcast an IPC event to all non-destroyed BrowserWindows.
 * Replaces single-target getSenderWindow() for auto-update events,
 * ensuring both the main window and settings window always receive them.
 * @param {string} channel
 * @param {unknown} [payload]
 */
function broadcastToAllWindows(channel, payload) {
  try {
    const { BrowserWindow } = _deps?.electronModule || {};
    if (!BrowserWindow) return;
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        if (payload !== undefined) {
          win.webContents.send(channel, payload);
        } else {
          win.webContents.send(channel);
        }
      }
    }
  } catch (err) {
    console.warn("[AutoUpdate] broadcastToAllWindows failed:", err?.message || err);
  }
}

function registerHandlers(ipcMain) {
  // ---- Check for updates ------------------------------------------------
  ipcMain.handle("netcatty:update:check", async () => {
    if (!isAutoUpdateSupported()) {
      return {
        available: false,
        supported: false,
        error: "Auto-update is not supported on this platform/package format.",
      };
    }

    const updater = getAutoUpdater();
    if (!updater) {
      return {
        available: false,
        supported: false,
        error: "Update module failed to load.",
      };
    }

    try {
      const result = await updater.checkForUpdates();
      if (!result || !result.updateInfo) {
        return { available: false, supported: true };
      }

      const { version, releaseNotes, releaseDate } = result.updateInfo;

      // Compare with current version using semver ordering.
      // Only report an update when the feed version is strictly newer,
      // avoiding false positives for pre-release or nightly builds.
      const { app } = _deps?.electronModule || {};
      const currentVersion = app?.getVersion?.() || "0.0.0";
      const isNewer = currentVersion.localeCompare(version, undefined, { numeric: true, sensitivity: 'base' }) < 0;
      if (!isNewer) {
        return { available: false, supported: true };
      }

      return {
        available: true,
        supported: true,
        version,
        releaseNotes: typeof releaseNotes === "string" ? releaseNotes : "",
        releaseDate: releaseDate || null,
      };
    } catch (err) {
      console.warn("[AutoUpdate] Check failed:", err?.message || err);
      return {
        available: false,
        supported: true,
        error: err?.message || "Unknown update check error",
      };
    }
  });

  // ---- Download update ---------------------------------------------------
  ipcMain.handle("netcatty:update:download", async () => {
    const updater = getAutoUpdater();
    if (!updater) {
      return { success: false, error: "Update module not available." };
    }
    try {
      // Global listeners (registered in setupGlobalListeners) handle all
      // progress/downloaded/error events. Just trigger the download.
      await updater.downloadUpdate();
      return { success: true };
    } catch (err) {
      console.error("[AutoUpdate] Download failed:", err?.message || err);
      return { success: false, error: err?.message || "Download failed" };
    }
  });

  // ---- Install (quit & install) ------------------------------------------
  ipcMain.handle("netcatty:update:install", () => {
    const updater = getAutoUpdater();
    if (!updater) return;
    updater.quitAndInstall(false, true);
  });

  console.log("[AutoUpdate] Handlers registered");
}

module.exports = { init, registerHandlers, isAutoUpdateSupported, startAutoCheck };
