/**
 * Cloud Sync Domain Types & Interfaces
 *
 * WebDAV Encrypted Sync (AES-256-GCM)
 */

// ============================================================================
// Cloud Provider Types
// ============================================================================

export type CloudProvider = 'webdav';

export type WebDAVAuthType = 'basic' | 'digest' | 'token';

export interface WebDAVConfig {
  endpoint: string;
  authType: WebDAVAuthType;
  username?: string;
  password?: string;
  token?: string;
  allowInsecure?: boolean;
}

/**
 * OAuth token storage structure (used by WebDAVAdapter interface)
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType: string;
  scope?: string;
}

/**
 * Provider account information
 */
export interface ProviderAccount {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

// ============================================================================
// Encrypted Sync File Schema
// ============================================================================

/**
 * Sync file metadata (stored in plaintext for version control)
 */
export interface SyncFileMeta {
  version: number;
  updatedAt: number;
  deviceId: string;
  deviceName?: string;
  appVersion: string;
  iv: string;
  salt: string;
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2' | 'Argon2id';
  kdfIterations?: number;
}

/**
 * Complete synced file structure
 */
export interface SyncedFile {
  meta: SyncFileMeta;
  payload: string;  // Base64 encrypted ciphertext
}

/**
 * Decrypted payload structure - contains all syncable data
 */
export interface SyncPayload {
  // Core vault data
  hosts: import('./models').Host[];
  keys: import('./models').SSHKey[];
  identities?: import('./models').Identity[];
  proxyProfiles?: import('./models').ProxyProfile[];
  snippets: import('./models').Snippet[];
  customGroups: string[];
  snippetPackages?: string[];

  // Group configs (connection defaults per host group)
  groupConfigs?: import('./models').GroupConfig[];

  // Port forwarding rules
  portForwardingRules?: import('./models').PortForwardingRule[];

  // Known hosts
  knownHosts?: import('./models').KnownHost[];

  // Settings
  settings?: {
    theme?: 'light' | 'dark' | 'system';
    lightUiThemeId?: string;
    darkUiThemeId?: string;
    accentMode?: 'theme' | 'custom';
    customAccent?: string;
    uiFontFamilyId?: string;
    uiLanguage?: string;
    customCSS?: string;
    terminalTheme?: string;
    followAppTerminalTheme?: boolean;
    terminalFontFamily?: string;
    terminalFontSize?: number;
    terminalSettings?: Record<string, unknown>;
    customTerminalThemes?: Array<{ id: string; name: string; colors: Record<string, string> }>;
    customKeyBindings?: Record<string, { mac?: string; pc?: string }>;
    editorWordWrap?: boolean;
    sftpDoubleClickBehavior?: 'open' | 'transfer';
    sftpAutoSync?: boolean;
    sftpShowHiddenFiles?: boolean;
    sftpUseCompressedUpload?: boolean;
    sftpGlobalBookmarks?: import('./models').SftpBookmark[];
    immersiveMode?: boolean;
    showRecentHosts?: boolean;
    showOnlyUngroupedHostsInRoot?: boolean;
    showSftpTab?: boolean;
    // Workspace focus indicator style
    workspaceFocusStyle?: 'dim' | 'border';
    // AI configuration
    ai?: {
      providers?: Array<Record<string, unknown>>;
      activeProviderId?: string;
      activeModelId?: string;
      globalPermissionMode?: 'observer' | 'confirm' | 'autonomous';
      toolIntegrationMode?: 'mcp' | 'skills';
      hostPermissions?: Array<Record<string, unknown>>;
      // externalAgents intentionally omitted: command/args/env are device-local
      // (binary paths, OS-specific values) and don't survive cross-device sync.
      defaultAgentId?: string;
      commandBlocklist?: string[];
      commandTimeout?: number;
      maxIterations?: number;
      agentModelMap?: Record<string, string>;
      webSearchConfig?: Record<string, unknown> | null;
    };
  };

  // Sync metadata
  syncedAt: number;
}

// ============================================================================
// Encryption Types
// ============================================================================

export interface EncryptionResult {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  salt: Uint8Array;
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2' | 'Argon2id';
  kdfIterations?: number;
}

export interface DecryptionInput {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  salt: Uint8Array;
  kdf: 'PBKDF2' | 'Argon2id';
  kdfIterations?: number;
}

// ============================================================================
// Master Key Types
// ============================================================================

export interface MasterKeyConfig {
  verificationHash: string;
  salt: string;
  kdf: 'PBKDF2' | 'Argon2id';
  kdfIterations?: number;
  createdAt: number;
}

export interface UnlockedMasterKey {
  derivedKey: CryptoKey;
  salt: Uint8Array;
  unlockedAt: number;
}

// ============================================================================
// Constants
// ============================================================================

export const SYNC_CONSTANTS = {
  // Encryption
  AES_KEY_LENGTH: 256,
  GCM_IV_LENGTH: 12,
  GCM_TAG_LENGTH: 128,
  SALT_LENGTH: 32,

  // PBKDF2
  PBKDF2_ITERATIONS: 600000,
  PBKDF2_HASH: 'SHA-256',

  // Sync
  SYNC_FILE_NAME: 'netcatty-vault.json',
} as const;
