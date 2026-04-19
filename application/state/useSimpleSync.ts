import { useState, useCallback } from 'react';
import type { SyncPayload, WebDAVConfig, SyncedFile } from '../../domain/sync';
import { WebDAVAdapter } from '../../infrastructure/services/adapters/WebDAVAdapter';
import { encryptPayload, decryptPayload } from '../../infrastructure/services/EncryptionService';
import { localStorageAdapter } from '../../infrastructure/persistence/localStorageAdapter';
import packageJson from '../../package.json';

const STORAGE_KEY_WEBDAV_CONFIG = 'netcatty_simple_sync_webdav_config_v1';
const STORAGE_KEY_SYNC_PASSWORD = 'netcatty_simple_sync_password_v1';

export type SyncStatus = 'unconfigured' | 'configured' | 'syncing' | 'error';

export interface SimpleSyncState {
  status: SyncStatus;
  webdavConfig: WebDAVConfig | null;
  password: string | null;
  lastError: string | null;
  isSyncing: boolean;
}

export interface SimpleSyncActions {
  /** Configure WebDAV + encryption password, then do initial sync.
   *  Returns the remote payload if pulled, or null if pushed local data. */
  configure: (config: WebDAVConfig, password: string, localPayload: SyncPayload) => Promise<SyncPayload | null>;
  /** Disconnect and clear config */
  disconnect: () => void;
  /** Push local data to remote (overwrite remote) */
  push: (payload: SyncPayload) => Promise<void>;
  /** Pull remote data to local (overwrite local). Returns the payload to apply. */
  pull: () => Promise<SyncPayload>;
  /** Check if remote has data */
  hasRemoteData: () => Promise<boolean>;
}

export function useSimpleSync(): SimpleSyncState & SimpleSyncActions {
  const [webdavConfig, setWebdavConfig] = useState<WebDAVConfig | null>(() => {
    return localStorageAdapter.read<WebDAVConfig>(STORAGE_KEY_WEBDAV_CONFIG);
  });
  const [password, setPassword] = useState<string | null>(() => {
    return localStorageAdapter.readString(STORAGE_KEY_SYNC_PASSWORD);
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const status: SyncStatus = isSyncing
    ? 'syncing'
    : lastError
      ? 'error'
      : webdavConfig && password
        ? 'configured'
        : 'unconfigured';

  const getAdapter = useCallback((config: WebDAVConfig) => {
    return new WebDAVAdapter(config);
  }, []);

  const hasRemoteData = useCallback(async (): Promise<boolean> => {
    if (!webdavConfig) throw new Error('Not configured');
    const adapter = getAdapter(webdavConfig);
    await adapter.initializeSync();
    const remote = await adapter.download();
    return remote !== null;
  }, [webdavConfig, getAdapter]);

  const push = useCallback(async (payload: SyncPayload) => {
    if (!webdavConfig || !password) throw new Error('Not configured');
    setIsSyncing(true);
    setLastError(null);
    try {
      const adapter = getAdapter(webdavConfig);
      await adapter.initializeSync();
      const deviceId = localStorageAdapter.readString('netcatty_device_id_v1') || crypto.randomUUID();
      localStorageAdapter.writeString('netcatty_device_id_v1', deviceId);
      const syncedFile: SyncedFile = await encryptPayload(
        payload, password, deviceId, 'Netcatty', packageJson.version,
      );
      await adapter.upload(syncedFile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(msg);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [webdavConfig, password, getAdapter]);

  const pull = useCallback(async (): Promise<SyncPayload> => {
    if (!webdavConfig || !password) throw new Error('Not configured');
    setIsSyncing(true);
    setLastError(null);
    try {
      const adapter = getAdapter(webdavConfig);
      await adapter.initializeSync();
      const remote = await adapter.download();
      if (!remote) throw new Error('No remote data found');
      return await decryptPayload(remote, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(msg);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [webdavConfig, password, getAdapter]);

  const configure = useCallback(async (config: WebDAVConfig, pwd: string, localPayload: SyncPayload): Promise<SyncPayload | null> => {
    setIsSyncing(true);
    setLastError(null);
    try {
      const adapter = getAdapter(config);
      await adapter.initializeSync();
      const remote = await adapter.download();

      // Save config
      localStorageAdapter.write(STORAGE_KEY_WEBDAV_CONFIG, config);
      localStorageAdapter.writeString(STORAGE_KEY_SYNC_PASSWORD, pwd);
      setWebdavConfig(config);
      setPassword(pwd);

      if (remote) {
        // Remote has data — decrypt and return it for the caller to apply
        const payload = await decryptPayload(remote, pwd);
        return payload;
      } else {
        // No remote data — push local data
        const deviceId = localStorageAdapter.readString('netcatty_device_id_v1') || crypto.randomUUID();
        localStorageAdapter.writeString('netcatty_device_id_v1', deviceId);
        const syncedFile: SyncedFile = await encryptPayload(
          localPayload, pwd, deviceId, 'Netcatty', packageJson.version,
        );
        await adapter.upload(syncedFile);
        return null;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(msg);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [getAdapter]);

  const disconnect = useCallback(() => {
    localStorageAdapter.remove(STORAGE_KEY_WEBDAV_CONFIG);
    localStorageAdapter.remove(STORAGE_KEY_SYNC_PASSWORD);
    setWebdavConfig(null);
    setPassword(null);
    setLastError(null);
  }, []);

  return {
    status, webdavConfig, password, lastError, isSyncing,
    configure, disconnect, push, pull, hasRemoteData,
  };
}
