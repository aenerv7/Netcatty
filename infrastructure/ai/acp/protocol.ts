// JSON-RPC 2.0 base types
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// ACP-specific types

/** Capabilities that the client (Netcatty) declares it supports */
export interface ClientCapabilities {
  fileSystem?: { read?: boolean; write?: boolean };
  terminal?: { create?: boolean; output?: boolean; waitForExit?: boolean; kill?: boolean };
  permissions?: { requestPermission?: boolean };
}

/** Capabilities that the agent declares it supports */
export interface AgentCapabilities {
  streaming?: boolean;
  tools?: string[];
}

/** ACP initialize params */
export interface InitializeParams {
  clientInfo: { name: string; version: string };
  capabilities: ClientCapabilities;
}

/** ACP initialize result */
export interface InitializeResult {
  agentInfo: { name: string; version: string };
  capabilities: AgentCapabilities;
}

/** ACP session create params */
export interface SessionCreateParams {
  sessionId?: string;
  context?: Record<string, unknown>;
}

/** ACP prompt params - send a user message */
export interface PromptParams {
  sessionId: string;
  message: string;
  context?: Record<string, unknown>;
}

/** ACP session update events (streamed as notifications) */
export interface SessionUpdateParams {
  sessionId: string;
  type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'done';
  content?: string;
  toolCall?: { id: string; name: string; arguments: Record<string, unknown> };
  toolResult?: { toolCallId: string; content: string; isError?: boolean };
}

/** ACP permission request */
export interface PermissionRequestParams {
  sessionId: string;
  toolCall: { name: string; arguments: Record<string, unknown> };
  description?: string;
}

// ACP method names
export const ACP_METHODS = {
  INITIALIZE: 'initialize',
  SESSION_CREATE: 'session/create',
  SESSION_PROMPT: 'session/prompt',
  SESSION_CANCEL: 'session/cancel',
  SESSION_UPDATE: 'session/update',           // notification from agent
  REQUEST_PERMISSION: 'session/request_permission', // request from agent
  TERMINAL_CREATE: 'terminal/create',          // request from agent
  TERMINAL_OUTPUT: 'terminal/output',          // notification from agent
  TERMINAL_WAIT_EXIT: 'terminal/waitForExit',  // request from agent
  TERMINAL_KILL: 'terminal/kill',              // request from agent
  FS_READ: 'fs/readTextFile',                  // request from agent
  FS_WRITE: 'fs/writeTextFile',                // request from agent
} as const;
