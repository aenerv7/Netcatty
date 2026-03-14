import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcMessage,
  InitializeParams,
  InitializeResult,
  SessionCreateParams,
  PromptParams,
  SessionUpdateParams,
  PermissionRequestParams,
  AgentCapabilities,
} from './protocol';
import { ACP_METHODS } from './protocol';
import type { ExternalAgentConfig } from '../types';

type EventHandler<T = unknown> = (params: T) => void;

/**
 * Bridge interface to the Electron main process for agent management
 */
interface AgentBridge {
  aiSpawnAgent(agentId: string, command: string, args?: string[], env?: Record<string, string>): Promise<{ ok: boolean; pid?: number; error?: string }>;
  aiWriteToAgent(agentId: string, data: string): Promise<{ ok: boolean; error?: string }>;
  aiKillAgent(agentId: string): Promise<{ ok: boolean; error?: string }>;
  onAiAgentStdout(agentId: string, cb: (data: string) => void): () => void;
  onAiAgentStderr(agentId: string, cb: (data: string) => void): () => void;
  onAiAgentExit(agentId: string, cb: (code: number) => void): () => void;
}

/**
 * ACP Client - manages a single external agent connection over JSON-RPC 2.0 / NDJSON stdio.
 */
export class ACPClient {
  private agentId: string;
  private config: ExternalAgentConfig;
  private bridge: AgentBridge;
  private nextId = 1;
  private pendingRequests = new Map<number | string, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private buffer = '';
  private cleanupFns: (() => void)[] = [];
  private agentCapabilities: AgentCapabilities | null = null;
  private _isConnected = false;

  // Event handlers
  private onSessionUpdate: EventHandler<SessionUpdateParams> | null = null;
  private onPermissionRequest: EventHandler<PermissionRequestParams> | null = null;
  private onStderr: EventHandler<string> | null = null;
  private onExit: EventHandler<number> | null = null;

  constructor(config: ExternalAgentConfig, bridge: AgentBridge) {
    this.agentId = `acp_${config.id}_${Date.now()}`;
    this.config = config;
    this.bridge = bridge;
  }

  get isConnected() { return this._isConnected; }
  get capabilities() { return this.agentCapabilities; }

  /** Set event handlers */
  on(event: 'session_update', handler: EventHandler<SessionUpdateParams>): this;
  on(event: 'permission_request', handler: EventHandler<PermissionRequestParams>): this;
  on(event: 'stderr', handler: EventHandler<string>): this;
  on(event: 'exit', handler: EventHandler<number>): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: EventHandler<any>): this {
    switch (event) {
      case 'session_update': this.onSessionUpdate = handler as EventHandler<SessionUpdateParams>; break;
      case 'permission_request': this.onPermissionRequest = handler as EventHandler<PermissionRequestParams>; break;
      case 'stderr': this.onStderr = handler as EventHandler<string>; break;
      case 'exit': this.onExit = handler as EventHandler<number>; break;
    }
    return this;
  }

  /** Start the agent process and perform ACP initialization handshake */
  async connect(): Promise<InitializeResult> {
    // Spawn the agent process
    const result = await this.bridge.aiSpawnAgent(
      this.agentId,
      this.config.command,
      this.config.args,
      this.config.env,
    );

    if (!result.ok) {
      throw new Error(`Failed to spawn agent: ${result.error}`);
    }

    // Listen for stdout (NDJSON messages)
    const unsubStdout = this.bridge.onAiAgentStdout(this.agentId, (data) => {
      this.handleStdoutData(data);
    });
    this.cleanupFns.push(unsubStdout);

    // Listen for stderr (logging)
    const unsubStderr = this.bridge.onAiAgentStderr(this.agentId, (data) => {
      this.onStderr?.(data);
    });
    this.cleanupFns.push(unsubStderr);

    // Listen for exit
    const unsubExit = this.bridge.onAiAgentExit(this.agentId, (code) => {
      this._isConnected = false;
      this.onExit?.(code);
      // Reject all pending requests
      for (const [, pending] of this.pendingRequests) {
        pending.reject(new Error(`Agent exited with code ${code}`));
      }
      this.pendingRequests.clear();
    });
    this.cleanupFns.push(unsubExit);

    // Send initialize request
    const initParams: InitializeParams = {
      clientInfo: { name: 'netcatty', version: '1.0.0' },
      capabilities: {
        terminal: { create: true, output: true, waitForExit: true, kill: true },
        fileSystem: { read: true, write: true },
        permissions: { requestPermission: true },
      },
    };

    const initResult = await this.sendRequest<InitializeResult>(ACP_METHODS.INITIALIZE, initParams);
    this.agentCapabilities = initResult.capabilities;
    this._isConnected = true;

    return initResult;
  }

  /** Create a new session */
  async createSession(params?: SessionCreateParams): Promise<{ sessionId: string }> {
    return this.sendRequest(ACP_METHODS.SESSION_CREATE, params || {});
  }

  /** Send a prompt to the agent */
  async prompt(params: PromptParams): Promise<void> {
    return this.sendRequest(ACP_METHODS.SESSION_PROMPT, params);
  }

  /** Cancel the current operation */
  async cancel(sessionId: string): Promise<void> {
    return this.sendRequest(ACP_METHODS.SESSION_CANCEL, { sessionId });
  }

  /** Respond to a permission request */
  respondPermission(requestId: number | string, approved: boolean): void {
    this.sendResponse(requestId, { approved });
  }

  /** Respond to a terminal create request */
  respondTerminalCreate(requestId: number | string, terminalId: string): void {
    this.sendResponse(requestId, { terminalId });
  }

  /** Respond to a file read request */
  respondFileRead(requestId: number | string, content: string): void {
    this.sendResponse(requestId, { content });
  }

  /** Respond to a file write request */
  respondFileWrite(requestId: number | string, success: boolean): void {
    this.sendResponse(requestId, { success });
  }

  /** Disconnect and kill the agent process */
  async disconnect(): Promise<void> {
    this._isConnected = false;
    for (const cleanup of this.cleanupFns) {
      try { cleanup(); } catch { /* ignore cleanup errors */ }
    }
    this.cleanupFns = [];
    await this.bridge.aiKillAgent(this.agentId);
    this.pendingRequests.clear();
  }

  // ── Private methods ──

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async sendRequest<T = unknown>(method: string, params?: Record<string, any>): Promise<T> {
    const id = this.nextId++;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
      });

      const line = JSON.stringify(request) + '\n';
      this.bridge.aiWriteToAgent(this.agentId, line).catch(reject);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  private sendResponse(id: number | string, result: unknown): void {
    const response: JsonRpcResponse = { jsonrpc: '2.0', id, result };
    const line = JSON.stringify(response) + '\n';
    this.bridge.aiWriteToAgent(this.agentId, line).catch((err) => {
      console.error('[ACP] Failed to send response:', err);
    });
  }

  private sendErrorResponse(id: number | string, code: number, message: string): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message },
    };
    const line = JSON.stringify(response) + '\n';
    this.bridge.aiWriteToAgent(this.agentId, line).catch(() => { /* best-effort */ });
  }

  private handleStdoutData(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message = JSON.parse(trimmed) as JsonRpcMessage;
        this.handleMessage(message);
      } catch {
        // Skip non-JSON lines (agent may print logs to stdout)
      }
    }
  }

  private handleMessage(message: JsonRpcMessage): void {
    // Response to our request
    if ('id' in message && ('result' in message || 'error' in message)) {
      const response = message as JsonRpcResponse;
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        this.pendingRequests.delete(response.id);
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
      return;
    }

    // Request from agent (needs our response)
    if ('id' in message && 'method' in message) {
      const request = message as JsonRpcRequest;
      this.handleAgentRequest(request);
      return;
    }

    // Notification from agent (no response needed)
    if ('method' in message && !('id' in message)) {
      const notification = message as JsonRpcNotification;
      this.handleAgentNotification(notification);
    }
  }

  private handleAgentRequest(request: JsonRpcRequest): void {
    switch (request.method) {
      case ACP_METHODS.REQUEST_PERMISSION: {
        const permParams = request.params as unknown as PermissionRequestParams;
        this.onPermissionRequest?.({
          ...permParams,
          // Attach the request ID so the handler can respond via respondPermission()
          _requestId: request.id,
        } as PermissionRequestParams & { _requestId: number | string });
        }
        break;

      case ACP_METHODS.TERMINAL_CREATE:
      case ACP_METHODS.TERMINAL_WAIT_EXIT:
      case ACP_METHODS.TERMINAL_KILL:
      case ACP_METHODS.FS_READ:
      case ACP_METHODS.FS_WRITE:
        // Surface as tool_call so the UI layer can handle and respond
        this.onSessionUpdate?.({
          sessionId: String(request.params?.sessionId || ''),
          type: 'tool_call',
          toolCall: {
            id: String(request.id),
            name: request.method,
            arguments: (request.params as Record<string, unknown>) || {},
          },
        });
        break;

      default:
        // Unknown method - respond with JSON-RPC method-not-found error
        this.sendErrorResponse(request.id, -32601, `Method not found: ${request.method}`);
    }
  }

  private handleAgentNotification(notification: JsonRpcNotification): void {
    switch (notification.method) {
      case ACP_METHODS.SESSION_UPDATE:
        this.onSessionUpdate?.(notification.params as unknown as SessionUpdateParams);
        break;
      case ACP_METHODS.TERMINAL_OUTPUT:
        // Surface terminal output as a session update with tool_result type
        this.onSessionUpdate?.({
          sessionId: String(notification.params?.sessionId || ''),
          type: 'tool_result',
          toolResult: {
            toolCallId: String(notification.params?.terminalId || ''),
            content: String(notification.params?.data || ''),
          },
        });
        break;
      default:
        // Ignore unknown notifications
        break;
    }
  }
}
