import { useCallback, useEffect, useRef, useState } from 'react';
import { checkForUpdates, getReleaseUrl, type ReleaseInfo, type UpdateCheckResult } from '../../infrastructure/services/updateService';
import { localStorageAdapter } from '../../infrastructure/persistence/localStorageAdapter';
import { STORAGE_KEY_UPDATE_DISMISSED_VERSION, STORAGE_KEY_UPDATE_LAST_CHECK, STORAGE_KEY_UPDATE_LATEST_RELEASE } from '../../infrastructure/config/storageKeys';
import { netcattyBridge } from '../../infrastructure/services/netcattyBridge';

// Check for updates at most once per hour
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
// Delay startup check to avoid slowing down app launch.
// 8s instead of 5s gives electron-updater's startAutoCheck(5000) time to
// emit 'update-available' first, so the redundancy guard can skip the GitHub
// API check when auto-download is already active.
const STARTUP_CHECK_DELAY_MS = 8000;
// Enable demo mode for development (set via localStorage: localStorage.setItem('debug.updateDemo', '1'))
const IS_UPDATE_DEMO_MODE = typeof window !== 'undefined' && 
  window.localStorage?.getItem('debug.updateDemo') === '1';

// Debug logging for update checks
const debugLog = (...args: unknown[]) => {
  if (IS_UPDATE_DEMO_MODE || (typeof window !== 'undefined' && window.localStorage?.getItem('debug.updateCheck') === '1')) {
    console.log('[UpdateCheck]', ...args);
  }
};

export type AutoDownloadStatus = 'idle' | 'downloading' | 'ready' | 'error';

export type ManualCheckStatus = 'idle' | 'checking' | 'available' | 'up-to-date' | 'error';

export interface UpdateState {
  isChecking: boolean;
  hasUpdate: boolean;
  currentVersion: string;
  latestRelease: ReleaseInfo | null;
  error: string | null;
  lastCheckedAt: number | null;
  // Auto-download state — driven by electron-updater IPC events
  autoDownloadStatus: AutoDownloadStatus;
  downloadPercent: number;
  downloadError: string | null;
  /** Manual check state — driven by user clicking "Check for Updates" */
  manualCheckStatus: ManualCheckStatus;
}

export interface UseUpdateCheckResult {
  updateState: UpdateState;
  checkNow: () => Promise<UpdateCheckResult | null>;
  dismissUpdate: () => void;
  openReleasePage: () => void;
  installUpdate: () => void;
}

/**
 * Hook for managing update checks
 * - Automatically checks for updates on startup (with delay)
 * - Respects dismissed version to avoid nagging
 * - Provides manual check capability
 */
export function useUpdateCheck(): UseUpdateCheckResult {
  const [updateState, setUpdateState] = useState<UpdateState>({
    isChecking: false,
    hasUpdate: false,
    currentVersion: '',
    latestRelease: null,
    error: null,
    lastCheckedAt: null,
    autoDownloadStatus: 'idle',
    downloadPercent: 0,
    downloadError: null,
    manualCheckStatus: 'idle',
  });

  const hasCheckedOnStartupRef = useRef(false);
  const isCheckingRef = useRef(false);
  const startupCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track current version in a ref to avoid stale closure in checkNow
  const currentVersionRef = useRef(updateState.currentVersion);
  // Track autoDownloadStatus in a ref so checkNow always reads the latest value
  const autoDownloadStatusRef = useRef<AutoDownloadStatus>('idle');
  // Timer ref for auto-resetting manualCheckStatus='up-to-date' back to 'idle'
  const manualCheckResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep currentVersionRef in sync so checkNow always reads the latest version
  useEffect(() => {
    currentVersionRef.current = updateState.currentVersion;
  }, [updateState.currentVersion]);

  // Keep autoDownloadStatusRef in sync so checkNow always reads the latest download state
  useEffect(() => {
    autoDownloadStatusRef.current = updateState.autoDownloadStatus;
  }, [updateState.autoDownloadStatus]);

  // Cleanup: clear any pending manualCheckStatus reset timer on unmount
  useEffect(() => {
    return () => {
      if (manualCheckResetTimeoutRef.current) {
        clearTimeout(manualCheckResetTimeoutRef.current);
      }
    };
  }, []);

  // Get current app version
  useEffect(() => {
    const loadVersion = async () => {
      try {
        const bridge = netcattyBridge.get();
        const info = await bridge?.getAppInfo?.();
        if (info?.version) {
          setUpdateState((prev) => ({ ...prev, currentVersion: info.version }));
        }
      } catch {
        // Ignore - running without Electron bridge
      }
    };
    void loadVersion();
  }, []);

  // Hydrate auto-download status from the main process so windows opened
  // after the download started (e.g. Settings) immediately reflect the
  // current state instead of showing stale 'idle'.
  useEffect(() => {
    const bridge = netcattyBridge.get();
    void bridge?.getUpdateStatus?.().then((snapshot) => {
      if (!snapshot || snapshot.status === 'idle') return;
      setUpdateState((prev) => {
        // Don't overwrite if the renderer already has a newer state
        if (prev.autoDownloadStatus !== 'idle') return prev;
        return {
          ...prev,
          autoDownloadStatus: snapshot.status,
          downloadPercent: snapshot.percent,
          downloadError: snapshot.error,
          // Use snapshot version if no release data or if versions differ
          latestRelease: (!prev.latestRelease || (snapshot.version && prev.latestRelease.version !== snapshot.version)) ? (snapshot.version ? {
            version: snapshot.version,
            tagName: `v${snapshot.version}`,
            name: `v${snapshot.version}`,
            body: '',
            htmlUrl: '',
            publishedAt: new Date().toISOString(),
            assets: [],
          } : prev.latestRelease) : prev.latestRelease,
        };
      });
    });
  }, []);

  // Subscribe to electron-updater auto-download IPC events.
  // These fire automatically when autoDownload=true in the main process.
  useEffect(() => {
    const bridge = netcattyBridge.get();

    const cleanupAvailable = bridge?.onUpdateAvailable?.((info) => {
      // Check if this version was dismissed by the user
      const dismissedVersion = localStorageAdapter.readString(STORAGE_KEY_UPDATE_DISMISSED_VERSION);
      const isDismissed = dismissedVersion === info.version;
      setUpdateState((prev) => ({
        ...prev,
        hasUpdate: !isDismissed,
        autoDownloadStatus: 'downloading',
        downloadPercent: 0,
        downloadError: null,
        // Use electron-updater's version if GitHub API hasn't resolved yet or
        // if the updater reports a different version than the cached release.
        latestRelease: (!prev.latestRelease || prev.latestRelease.version !== info.version) ? {
          version: info.version,
          tagName: `v${info.version}`,
          name: `v${info.version}`,
          body: info.releaseNotes || '',
          htmlUrl: '',
          publishedAt: info.releaseDate || new Date().toISOString(),
          assets: [],
        } : prev.latestRelease,
      }));
    });

    const cleanupProgress = bridge?.onUpdateDownloadProgress?.((p) => {
      setUpdateState((prev) => ({
        ...prev,
        autoDownloadStatus: 'downloading',
        downloadPercent: Math.round(p.percent),
      }));
    });

    const cleanupDownloaded = bridge?.onUpdateDownloaded?.(() => {
      setUpdateState((prev) => ({
        ...prev,
        autoDownloadStatus: 'ready',
        downloadPercent: 100,
      }));
    });

    const cleanupError = bridge?.onUpdateError?.((payload) => {
      setUpdateState((prev) => ({
        ...prev,
        autoDownloadStatus: 'error',
        downloadError: payload.error,
      }));
    });

    return () => {
      cleanupAvailable?.();
      cleanupProgress?.();
      cleanupDownloaded?.();
      cleanupError?.();
    };
  }, []);

  const performCheck = useCallback(async (currentVersion: string): Promise<UpdateCheckResult | null> => {
    debugLog('performCheck called', { currentVersion, IS_UPDATE_DEMO_MODE });
    
    // In demo mode, use a fake version to allow checking
    const effectiveVersion = IS_UPDATE_DEMO_MODE ? '0.0.1' : currentVersion;
    
    if (!effectiveVersion || effectiveVersion === '0.0.0') {
      debugLog('Skipping check - invalid version:', effectiveVersion);
      // Skip check for dev builds
      return null;
    }

    if (isCheckingRef.current) {
      debugLog('Already checking, skipping');
      return null;
    }

    isCheckingRef.current = true;
    setUpdateState((prev) => ({ ...prev, isChecking: true, error: null }));

    try {
      let result: UpdateCheckResult;
      
      if (IS_UPDATE_DEMO_MODE) {
        debugLog('Demo mode: creating fake update result');
        // Simulate a short delay like a real API call
        await new Promise(resolve => setTimeout(resolve, 500));
        // In demo mode, create a fake update result
        result = {
          hasUpdate: true,
          currentVersion: '0.0.1',
          latestRelease: {
            version: '1.0.0',
            tagName: 'v1.0.0',
            name: 'Netcatty v1.0.0',
            body: 'Demo release for testing update notification',
            htmlUrl: 'https://github.com/binaricat/Netcatty/releases',
            publishedAt: new Date().toISOString(),
            assets: [],
          },
        };
      } else {
        result = await checkForUpdates(currentVersion);
      }
      debugLog('Check result:', result);
      debugLog('Latest release version:', result.latestRelease?.version);
      const now = Date.now();

      // Save last check time and release info for cross-window hydration
      localStorageAdapter.writeNumber(STORAGE_KEY_UPDATE_LAST_CHECK, now);
      if (result.latestRelease) {
        localStorageAdapter.writeString(STORAGE_KEY_UPDATE_LATEST_RELEASE, JSON.stringify(result.latestRelease));
      }

      // Check if this version was dismissed
      const dismissedVersion = localStorageAdapter.readString(STORAGE_KEY_UPDATE_DISMISSED_VERSION);
      const showUpdate = result.hasUpdate && 
        result.latestRelease?.version !== dismissedVersion;
      
      debugLog('Show update:', showUpdate, 'dismissed version:', dismissedVersion);
      debugLog('Setting state with hasUpdate:', showUpdate);

      setUpdateState((prev) => {
        debugLog('State updated:', { ...prev, hasUpdate: showUpdate, latestRelease: result.latestRelease });
        return {
          ...prev,
          isChecking: false,
          hasUpdate: showUpdate,
          latestRelease: result.latestRelease,
          error: result.error || null,
          lastCheckedAt: now,
        };
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setUpdateState((prev) => ({
        ...prev,
        isChecking: false,
        error: errorMsg,
      }));
      return null;
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  const checkNow = useCallback(async (): Promise<UpdateCheckResult | null> => {
    // Prevent concurrent checks (performCheck owns isCheckingRef)
    if (isCheckingRef.current) {
      debugLog('checkNow: already checking, skipping');
      return null;
    }

    // Clear any pending "up-to-date" auto-reset timer
    if (manualCheckResetTimeoutRef.current) {
      clearTimeout(manualCheckResetTimeoutRef.current);
      manualCheckResetTimeoutRef.current = null;
    }

    // Immediately reflect 'checking' in the UI; reset download error so the user can retry
    setUpdateState((prev) => {
      // Eagerly sync the ref so the checkForUpdate gate below reads the updated value
      if (prev.autoDownloadStatus === 'error') {
        autoDownloadStatusRef.current = 'idle';
      }
      return {
        ...prev,
        manualCheckStatus: 'checking',
        error: null,
        // P2: reset download error state so auto-download can retry on next available update
        autoDownloadStatus: prev.autoDownloadStatus === 'error' ? 'idle' : prev.autoDownloadStatus,
        downloadError: prev.autoDownloadStatus === 'error' ? null : prev.downloadError,
      };
    });

    // Skip check for dev/invalid builds (demo mode overrides to '0.0.1' inside performCheck)
    const effectiveVersion = IS_UPDATE_DEMO_MODE ? '0.0.1' : currentVersionRef.current;
    if (!effectiveVersion || effectiveVersion === '0.0.0') {
      // Dev/invalid build — can't determine update status, reset to idle
      setUpdateState((prev) => ({
        ...prev,
        manualCheckStatus: 'idle',
      }));
      return null;
    }

    // Delegate to performCheck (GitHub API) — completely independent of
    // electron-updater's startAutoCheck() in the main process.
    // performCheck sets isCheckingRef, isChecking, hasUpdate, latestRelease.
    const result = await performCheck(effectiveVersion);

    const nextStatus: ManualCheckStatus =
      result === null || result.error ? 'error' : result.hasUpdate ? 'available' : 'up-to-date';

    setUpdateState((prev) => ({
      ...prev,
      manualCheckStatus: nextStatus,
    }));

    if (nextStatus === 'up-to-date') {
      // Auto-reset "up-to-date" badge back to idle after 5s
      manualCheckResetTimeoutRef.current = setTimeout(() => {
        setUpdateState((prev) => ({ ...prev, manualCheckStatus: 'idle' }));
      }, 5000);
    } else if (nextStatus === 'available' && autoDownloadStatusRef.current === 'idle') {
      // Update found but electron-updater hasn't started a download yet
      // (startAutoCheck may not have fired yet, or may have been skipped).
      // Trigger electron-updater and surface any check-phase failures so
      // users know auto-download won't proceed on broken feeds.
      void netcattyBridge.get()?.checkForUpdate?.().then((res) => {
        // Only surface actual download-feed errors; unsupported platforms
        // (res.supported === false) are expected and should keep
        // autoDownloadStatus at 'idle' so the manual download link shows.
        if (res?.error && res?.supported !== false) {
          setUpdateState((prev) => ({
            ...prev,
            autoDownloadStatus: 'error',
            downloadError: res.error,
          }));
        }
      }).catch(() => {
        // Bridge unavailable — ignore; the manual download link remains visible
      });
    }

    return result;
  }, [performCheck]);

  const dismissUpdate = useCallback(() => {
    if (updateState.latestRelease?.version) {
      localStorageAdapter.writeString(
        STORAGE_KEY_UPDATE_DISMISSED_VERSION,
        updateState.latestRelease.version
      );
    }
    setUpdateState((prev) => ({ ...prev, hasUpdate: false }));
  }, [updateState.latestRelease?.version]);

  const openReleasePage = useCallback(async () => {
    const url = updateState.latestRelease
      ? getReleaseUrl(updateState.latestRelease.version)
      : getReleaseUrl();

    try {
      const bridge = netcattyBridge.get();
      if (bridge?.openExternal) {
        await bridge.openExternal(url);
        return;
      }
    } catch {
      // Fallback to window.open
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [updateState.latestRelease]);

  const installUpdate = useCallback(() => {
    netcattyBridge.get()?.installUpdate?.();
  }, []);

  // Startup check with delay - runs once on mount
  useEffect(() => {
    debugLog('Startup check effect mounted, IS_UPDATE_DEMO_MODE:', IS_UPDATE_DEMO_MODE);
    
    // In demo mode, trigger check immediately after a short delay
    if (IS_UPDATE_DEMO_MODE) {
      debugLog('Demo mode: scheduling update check in', STARTUP_CHECK_DELAY_MS, 'ms');
      
      startupCheckTimeoutRef.current = setTimeout(() => {
        debugLog('=== Demo mode: Triggering update check ===');
        void performCheck('0.0.1');
      }, STARTUP_CHECK_DELAY_MS);
      
      return () => {
        if (startupCheckTimeoutRef.current) {
          clearTimeout(startupCheckTimeoutRef.current);
        }
      };
    }
    
    // Normal mode: wait for version to be loaded, then check
    // This is handled by the version-dependent effect below
  }, [performCheck]);

  // Normal mode startup check - depends on currentVersion
  useEffect(() => {
    // Skip in demo mode (handled above)
    if (IS_UPDATE_DEMO_MODE) {
      return;
    }
    
    debugLog('Version check effect', { 
      hasChecked: hasCheckedOnStartupRef.current, 
      currentVersion: updateState.currentVersion
    });
    
    if (hasCheckedOnStartupRef.current) {
      return;
    }

    if (!updateState.currentVersion || updateState.currentVersion === '0.0.0') {
      return;
    }

    // Check if we've checked recently
    const lastCheck = localStorageAdapter.readNumber(STORAGE_KEY_UPDATE_LAST_CHECK);
    const now = Date.now();
    if (lastCheck && now - lastCheck < UPDATE_CHECK_INTERVAL_MS) {
      hasCheckedOnStartupRef.current = true;
      // Hydrate cached release info so late-opening windows show the result
      const cachedRelease = localStorageAdapter.readString(STORAGE_KEY_UPDATE_LATEST_RELEASE);
      if (cachedRelease) {
        try {
          const release = JSON.parse(cachedRelease) as ReleaseInfo;
          const dismissedVersion = localStorageAdapter.readString(STORAGE_KEY_UPDATE_DISMISSED_VERSION);
          const isNewer = updateState.currentVersion.localeCompare(release.version, undefined, { numeric: true, sensitivity: 'base' }) < 0;
          const showUpdate = isNewer && release.version !== dismissedVersion;
          setUpdateState((prev) => ({
            ...prev,
            latestRelease: prev.latestRelease ?? release,
            hasUpdate: prev.hasUpdate || showUpdate,
            lastCheckedAt: lastCheck,
          }));
        } catch {
          // Ignore corrupted cache
        }
      }
      return;
    }

    hasCheckedOnStartupRef.current = true;
    debugLog('Starting delayed update check for version:', updateState.currentVersion);

    startupCheckTimeoutRef.current = setTimeout(() => {
      // If electron-updater's auto-check already started a download, skip the
      // redundant GitHub API check to avoid duplicate toast notifications.
      if (autoDownloadStatusRef.current !== 'idle') {
        debugLog('Skipping startup check — auto-download already active');
        return;
      }
      debugLog('=== Delayed check triggered ===');
      void performCheck(updateState.currentVersion);
    }, STARTUP_CHECK_DELAY_MS);

    return () => {
      if (startupCheckTimeoutRef.current) {
        clearTimeout(startupCheckTimeoutRef.current);
      }
    };
  }, [updateState.currentVersion, performCheck]);

  return {
    updateState,
    checkNow,
    dismissUpdate,
    openReleasePage,
    installUpdate,
  };
}
