import type { SyncPayload } from '../domain/sync';
import {
  STORAGE_KEY_LOCAL_VAULT_BACKUP_LAST_APP_VERSION,
  STORAGE_KEY_LOCAL_VAULT_BACKUP_MAX_COUNT,
} from '../infrastructure/config/storageKeys';
import { localStorageAdapter } from '../infrastructure/persistence/localStorageAdapter';
import { netcattyBridge } from '../infrastructure/services/netcattyBridge';
import { hasMeaningfulSyncData } from './syncPayload';

export type LocalVaultBackupReason = 'app_version_change' | 'before_restore';

export interface LocalVaultBackupPreview {
  id: string;
  createdAt: number;
  reason: LocalVaultBackupReason;
  /** App version transition fields, only for `app_version_change` records. */
  sourceAppVersion?: string;
  targetAppVersion?: string;
  fingerprint: string;
  preview: {
    hostCount: number;
    keyCount: number;
    snippetCount: number;
    identityCount: number;
    portForwardingRuleCount: number;
  };
}

export interface LocalVaultBackupDetails {
  backup: LocalVaultBackupPreview;
  payload: SyncPayload;
}

export const DEFAULT_LOCAL_VAULT_BACKUP_MAX_COUNT = 20;
export const MIN_LOCAL_VAULT_BACKUP_MAX_COUNT = 1;
export const MAX_LOCAL_VAULT_BACKUP_MAX_COUNT = 100;

export const sanitizeLocalVaultBackupMaxCount = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_LOCAL_VAULT_BACKUP_MAX_COUNT;
  return Math.max(
    MIN_LOCAL_VAULT_BACKUP_MAX_COUNT,
    Math.min(MAX_LOCAL_VAULT_BACKUP_MAX_COUNT, Math.round(value)),
  );
};

export const getLocalVaultBackupMaxCount = (): number => {
  const stored = localStorageAdapter.readNumber(STORAGE_KEY_LOCAL_VAULT_BACKUP_MAX_COUNT);
  return sanitizeLocalVaultBackupMaxCount(
    stored ?? DEFAULT_LOCAL_VAULT_BACKUP_MAX_COUNT,
  );
};

export const setLocalVaultBackupMaxCount = (value: number): number => {
  const sanitized = sanitizeLocalVaultBackupMaxCount(value);
  localStorageAdapter.writeNumber(STORAGE_KEY_LOCAL_VAULT_BACKUP_MAX_COUNT, sanitized);
  return sanitized;
};

export async function trimLocalVaultBackups(maxCount = getLocalVaultBackupMaxCount()): Promise<void> {
  const bridge = netcattyBridge.get();
  await bridge?.trimVaultBackups?.({ maxCount });
}

export async function getLocalVaultBackupCapabilities(): Promise<{
  encryptionAvailable: boolean;
}> {
  const bridge = netcattyBridge.get();
  const caps = await bridge?.getVaultBackupCapabilities?.();
  return { encryptionAvailable: Boolean(caps?.encryptionAvailable) };
}

export async function listLocalVaultBackups(): Promise<LocalVaultBackupPreview[]> {
  const bridge = netcattyBridge.get();
  const entries = await bridge?.listVaultBackups?.();
  return Array.isArray(entries) ? entries : [];
}

export async function readLocalVaultBackup(id: string): Promise<LocalVaultBackupDetails | null> {
  const bridge = netcattyBridge.get();
  if (!bridge?.readVaultBackup) return null;
  return bridge.readVaultBackup({ id });
}

export async function openLocalVaultBackupDir(): Promise<void> {
  const bridge = netcattyBridge.get();
  await bridge?.openVaultBackupDir?.();
}

export async function createLocalVaultBackup(
  payload: SyncPayload,
  options: {
    reason: LocalVaultBackupReason;
    sourceAppVersion?: string;
    targetAppVersion?: string;
    maxCount?: number;
  },
): Promise<LocalVaultBackupPreview | null> {
  if (!hasMeaningfulSyncData(payload)) {
    return null;
  }

  const bridge = netcattyBridge.get();
  if (!bridge?.createVaultBackup) {
    return null;
  }

  try {
    const result = await bridge.createVaultBackup({
      payload,
      reason: options.reason,
      sourceAppVersion: options.sourceAppVersion,
      targetAppVersion: options.targetAppVersion,
      maxCount: options.maxCount ?? getLocalVaultBackupMaxCount(),
    });
    return result?.backup ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[localVaultBackups] Backup skipped:', message);
    return null;
  }
}

/**
 * Thrown when a caller requires a protective backup and the backup
 * couldn't be written (safeStorage unavailable, bridge missing, disk error).
 */
export class ProtectiveBackupUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtectiveBackupUnavailableError';
  }
}

/**
 * Create a protective local backup before a destructive apply (restore
 * from backup list, WebDAV cloud download applied over meaningful local state).
 *
 * Returns `null` when there is nothing meaningful to back up.
 * Throws `ProtectiveBackupUnavailableError` when pre-apply state IS
 * meaningful but the backup attempt failed.
 */
export async function createRequiredProtectiveLocalVaultBackup(
  payload: SyncPayload,
): Promise<LocalVaultBackupPreview | null> {
  if (!hasMeaningfulSyncData(payload)) {
    return null;
  }

  const bridge = netcattyBridge.get();
  if (!bridge?.createVaultBackup) {
    throw new ProtectiveBackupUnavailableError(
      'Vault backup bridge is not available in this environment.',
    );
  }

  try {
    const result = await bridge.createVaultBackup({
      payload,
      reason: 'before_restore',
      maxCount: getLocalVaultBackupMaxCount(),
    });
    return result?.backup ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ProtectiveBackupUnavailableError(message);
  }
}

/**
 * On app version change, create a backup of the current vault state.
 * This protects against data loss if a new version introduces breaking changes.
 */
export async function ensureVersionChangeBackup(
  payload: SyncPayload,
  currentAppVersion: string | null | undefined,
): Promise<{ created: boolean; backup: LocalVaultBackupPreview | null }> {
  const normalizedVersion = currentAppVersion?.trim() || '';
  if (!normalizedVersion) {
    return { created: false, backup: null };
  }

  const previousVersion =
    localStorageAdapter.readString(STORAGE_KEY_LOCAL_VAULT_BACKUP_LAST_APP_VERSION)?.trim() || '';

  if (!previousVersion) {
    localStorageAdapter.writeString(STORAGE_KEY_LOCAL_VAULT_BACKUP_LAST_APP_VERSION, normalizedVersion);
    return { created: false, backup: null };
  }

  if (previousVersion === normalizedVersion) {
    return { created: false, backup: null };
  }

  let backup: LocalVaultBackupPreview | null = null;
  const payloadIsMeaningful = hasMeaningfulSyncData(payload);
  if (payloadIsMeaningful) {
    backup = await createLocalVaultBackup(payload, {
      reason: 'app_version_change',
      sourceAppVersion: previousVersion,
      targetAppVersion: normalizedVersion,
    });
  }

  const shouldAdvanceVersion = payloadIsMeaningful && backup !== null;
  if (shouldAdvanceVersion) {
    localStorageAdapter.writeString(STORAGE_KEY_LOCAL_VAULT_BACKUP_LAST_APP_VERSION, normalizedVersion);
  }

  return {
    created: Boolean(backup),
    backup,
  };
}
