/**
 * WebDAV Adapter - webdav client library
 */

import { AuthType, createClient } from 'webdav';
import {
  SYNC_CONSTANTS,
  type WebDAVConfig,
  type SyncedFile,
  type ProviderAccount,
  type OAuthTokens,
} from '../../../domain/sync';
import { netcattyBridge } from '../netcattyBridge';

type WebDAVClient = ReturnType<typeof createClient>;

const normalizeEndpoint = (endpoint: string): string => {
  const trimmed = endpoint.trim();
  let url = trimmed;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  // Remove trailing slash to avoid double-slash when joining paths
  return url.replace(/\/+$/, "");
};

const ensureLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value : `/${value}`;

export class WebDAVAdapter {
  private config: WebDAVConfig | null;
  private resource: string | null;
  private account: ProviderAccount | null;
  private client: WebDAVClient | null;

  constructor(config?: WebDAVConfig, resourceId?: string) {
    this.config = config
      ? { ...config, endpoint: normalizeEndpoint(config.endpoint) }
      : null;
    this.resource = resourceId || null;
    this.account = this.buildAccountInfo(this.config);
    this.client = this.config ? this.createClient(this.config) : null;
  }

  get isAuthenticated(): boolean {
    return !!this.config;
  }

  get accountInfo(): ProviderAccount | null {
    return this.account;
  }

  get resourceId(): string | null {
    return this.resource;
  }

  signOut(): void {
    this.config = null;
    this.resource = null;
    this.account = null;
    this.client = null;
  }

  async initializeSync(): Promise<string | null> {
    return this.withWebdavErrorContext('initialize', async () => {
      if (!this.config) {
        throw new Error('Missing WebDAV config');
      }
      const bridge = netcattyBridge.get();
      if (bridge?.cloudSyncWebdavInitialize) {
        const result = await bridge.cloudSyncWebdavInitialize(this.config);
        this.resource = result?.resourceId || this.getSyncPath();
        return this.resource;
      }
      const client = this.getClient();
      await this.ensureSyncDir(client);
      const path = this.getSyncPath();
      await client.exists(path);
      this.resource = path;
      return this.resource;
    });
  }

  async upload(syncedFile: SyncedFile): Promise<string> {
    return this.withWebdavErrorContext('upload', async () => {
      if (!this.config) {
        throw new Error('Missing WebDAV config');
      }
      const bridge = netcattyBridge.get();
      if (bridge?.cloudSyncWebdavUpload) {
        const result = await bridge.cloudSyncWebdavUpload(this.config, syncedFile);
        this.resource = result?.resourceId || this.getSyncPath();
        return this.resource;
      }
      const client = this.getClient();
      await this.ensureSyncDir(client);
      const path = this.getSyncPath();
      await client.putFileContents(path, JSON.stringify(syncedFile), { overwrite: true });
      this.resource = path;
      return path;
    });
  }

  async download(): Promise<SyncedFile | null> {
    return this.withWebdavErrorContext('download', async () => {
      if (!this.config) {
        throw new Error('Missing WebDAV config');
      }
      const bridge = netcattyBridge.get();
      if (bridge?.cloudSyncWebdavDownload) {
        const result = await bridge.cloudSyncWebdavDownload(this.config);
        return (result?.syncedFile ?? null) as SyncedFile | null;
      }
      const client = this.getClient();
      const path = this.getSyncPath();
      const exists = await client.exists(path);
      if (!exists) return null;
      const data = await client.getFileContents(path, { format: 'text' });
      if (!data) return null;
      return JSON.parse(data as string) as SyncedFile;
    });
  }

  async deleteSync(): Promise<void> {
    return this.withWebdavErrorContext('delete', async () => {
      if (!this.config) {
        throw new Error('Missing WebDAV config');
      }
      const bridge = netcattyBridge.get();
      if (bridge?.cloudSyncWebdavDelete) {
        await bridge.cloudSyncWebdavDelete(this.config);
        return;
      }
      const client = this.getClient();
      const path = this.getSyncPath();
      const exists = await client.exists(path);
      if (!exists) return;
      await client.deleteFile(path);
    });
  }

  getTokens(): OAuthTokens | null {
    return null;
  }

  private getClient(): WebDAVClient {
    if (!this.config || !this.client) {
      throw new Error('Missing WebDAV config');
    }
    return this.client;
  }

  private createClient(config: WebDAVConfig): WebDAVClient {
    const extraOpts: Record<string, unknown> = {};
    if (config.allowInsecure && typeof globalThis.process !== 'undefined') {
      const https = require('https');
      extraOpts.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    }

    if (config.authType === 'token') {
      return createClient(config.endpoint, {
        authType: AuthType.Token,
        token: {
          access_token: config.token || '',
          token_type: 'Bearer',
        },
        ...extraOpts,
      });
    }

    if (config.authType === 'digest') {
      return createClient(config.endpoint, {
        authType: AuthType.Digest,
        username: config.username || '',
        password: config.password || '',
        ...extraOpts,
      });
    }

    return createClient(config.endpoint, {
      authType: AuthType.Password,
      username: config.username || '',
      password: config.password || '',
      ...extraOpts,
    });
  }

  private async withWebdavErrorContext<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw this.buildWebdavError(operation, error);
    }
  }

  private buildWebdavError(operation: string, error: unknown): Error {
    const baseMessage = error instanceof Error ? error.message : String(error);
    const details: Record<string, string | number | boolean | null | undefined> = {
      operation,
    };
    const raw = error as {
      status?: number;
      statusText?: string;
      url?: string;
      method?: string;
      code?: string;
      response?: {
        status?: number;
        statusText?: string;
        url?: string;
      };
      cause?: unknown;
    };

    if (raw?.status) details.status = raw.status;
    if (raw?.statusText) details.statusText = raw.statusText;
    if (raw?.url) details.url = raw.url;
    if (raw?.method) details.method = raw.method;
    if (raw?.code) details.code = raw.code;
    if (raw?.response?.status) details.status = raw.response.status;
    if (raw?.response?.statusText) details.statusText = raw.response.statusText;
    if (raw?.response?.url) details.url = raw.response.url;
    if (raw?.cause && typeof raw.cause === 'object') {
      Object.assign(details, raw.cause as Record<string, unknown>);
      details.operation = operation;
      const cause = raw.cause as { code?: string };
      if (cause?.code) details.causeCode = cause.code;
    } else if (raw?.cause) {
      details.cause = String(raw.cause);
    }

    const err = new Error(`WebDAV ${operation} failed: ${baseMessage}`);
    (err as Error & { cause?: unknown }).cause = details;
    return err;
  }

  private getSyncPath(): string {
    return ensureLeadingSlash(`Netcatty/${SYNC_CONSTANTS.SYNC_FILE_NAME}`);
  }

  private getSyncDir(): string {
    return ensureLeadingSlash('Netcatty');
  }

  private async ensureSyncDir(client: WebDAVClient): Promise<void> {
    const dir = this.getSyncDir();
    try {
      const exists = await client.exists(dir);
      if (!exists) {
        await client.createDirectory(dir);
      }
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
        ?? (err as { response?: { status?: number } })?.response?.status;
      if (status === 405) return; // directory already exists
      throw err;
    }
  }

  private buildAccountInfo(config: WebDAVConfig | null): ProviderAccount | null {
    if (!config) return null;
    try {
      const url = new URL(config.endpoint);
      const host = url.host;
      const name = config.username ? `${config.username}@${host}` : host;
      return { id: host, name };
    } catch {
      return { id: config.endpoint, name: config.endpoint };
    }
  }
}

export default WebDAVAdapter;
