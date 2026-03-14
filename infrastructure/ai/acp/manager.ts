import { ACPClient } from './client';
import type { ExternalAgentConfig } from '../types';
import type { SessionUpdateParams, PermissionRequestParams, InitializeResult } from './protocol';

interface AgentBridge {
  aiSpawnAgent(agentId: string, command: string, args?: string[], env?: Record<string, string>): Promise<{ ok: boolean; pid?: number; error?: string }>;
  aiWriteToAgent(agentId: string, data: string): Promise<{ ok: boolean; error?: string }>;
  aiKillAgent(agentId: string): Promise<{ ok: boolean; error?: string }>;
  onAiAgentStdout(agentId: string, cb: (data: string) => void): () => void;
  onAiAgentStderr(agentId: string, cb: (data: string) => void): () => void;
  onAiAgentExit(agentId: string, cb: (code: number) => void): () => void;
}

export interface ACPManagerCallbacks {
  onSessionUpdate: (agentConfigId: string, params: SessionUpdateParams) => void;
  onPermissionRequest: (agentConfigId: string, params: PermissionRequestParams) => void;
  onAgentError: (agentConfigId: string, error: string) => void;
  onAgentExit: (agentConfigId: string, code: number) => void;
}

/**
 * Manages multiple ACP agent connections.
 */
export class ACPManager {
  private clients = new Map<string, ACPClient>();
  private bridge: AgentBridge;
  private callbacks: ACPManagerCallbacks;

  constructor(bridge: AgentBridge, callbacks: ACPManagerCallbacks) {
    this.bridge = bridge;
    this.callbacks = callbacks;
  }

  /** Connect to an external agent */
  async connect(config: ExternalAgentConfig): Promise<InitializeResult> {
    if (this.clients.has(config.id)) {
      await this.disconnect(config.id);
    }

    const client = new ACPClient(config, this.bridge);

    client
      .on('session_update', (params) => {
        this.callbacks.onSessionUpdate(config.id, params);
      })
      .on('permission_request', (params) => {
        this.callbacks.onPermissionRequest(config.id, params);
      })
      .on('stderr', (data) => {
        this.callbacks.onAgentError(config.id, data);
      })
      .on('exit', (code) => {
        this.clients.delete(config.id);
        this.callbacks.onAgentExit(config.id, code);
      });

    const result = await client.connect();
    this.clients.set(config.id, client);
    return result;
  }

  /** Get a connected client */
  getClient(configId: string): ACPClient | undefined {
    return this.clients.get(configId);
  }

  /** Check if an agent is connected */
  isConnected(configId: string): boolean {
    return this.clients.get(configId)?.isConnected ?? false;
  }

  /** Disconnect a specific agent */
  async disconnect(configId: string): Promise<void> {
    const client = this.clients.get(configId);
    if (client) {
      await client.disconnect();
      this.clients.delete(configId);
    }
  }

  /** Disconnect all agents */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.clients.keys()).map(id => this.disconnect(id));
    await Promise.allSettled(promises);
  }

  /** Get list of connected agent IDs */
  getConnectedAgentIds(): string[] {
    return Array.from(this.clients.entries())
      .filter(([, client]) => client.isConnected)
      .map(([id]) => id);
  }
}
