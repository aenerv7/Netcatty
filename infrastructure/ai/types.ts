// AI Provider types
export type AIProviderId = 'openai' | 'anthropic' | 'google' | 'ollama' | 'openrouter' | 'custom';

export interface ProviderConfig {
  id: string;
  providerId: AIProviderId;
  name: string;
  apiKey?: string;           // encrypted via credentialBridge (enc:v1: prefix)
  baseURL?: string;          // custom endpoint URL
  defaultModel?: string;
  customHeaders?: Record<string, string>;
  enabled: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  providerId: AIProviderId;
  contextWindow?: number;
  supportsTools?: boolean;
  supportsStreaming?: boolean;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: number;
  model?: string;
  providerId?: AIProviderId;
  executionStatus?: 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'failed';
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

// Streaming events
export type ChatStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'error'; error: string }
  | { type: 'done'; usage?: { promptTokens: number; completionTokens: number } };

// AI Session types
export interface AISession {
  id: string;
  title: string;
  agentId: string;
  scope: AISessionScope;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AISessionScope {
  type: 'terminal' | 'workspace' | 'global';
  targetId?: string;        // sessionId or workspaceId
  hostIds?: string[];       // resolved host IDs in scope
}

// Permission model
export type AIPermissionMode = 'observer' | 'confirm' | 'autonomous';

export interface HostAIPermission {
  hostId: string;
  mode: AIPermissionMode;
  allowedCommands?: string[];   // regex patterns
  blockedCommands?: string[];   // regex patterns
  allowFileWrite?: boolean;
  maxConcurrentCommands?: number;
}

// Agent types
export interface AgentInfo {
  id: string;
  name: string;
  type: 'builtin' | 'external';
  icon?: string;
  description?: string;
  command?: string;             // for external agents
  args?: string[];
  available: boolean;
}

// External Agent (ACP) config
export interface ExternalAgentConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  icon?: string;
  enabled: boolean;
}

// AI Settings (stored in localStorage)
export interface AISettings {
  providers: ProviderConfig[];
  activeProviderId: string;
  activeModelId: string;
  globalPermissionMode: AIPermissionMode;
  hostPermissions: HostAIPermission[];
  externalAgents: ExternalAgentConfig[];
  defaultAgentId: string;
  commandBlocklist: string[];    // global command blocklist patterns
  commandTimeout: number;        // seconds, default 60
  maxIterations: number;         // doom loop prevention, default 20
}

export const DEFAULT_COMMAND_BLOCKLIST = [
  'rm\\s+-rf\\s+/',
  'mkfs\\.',
  'dd\\s+if=.*\\s+of=/dev/',
  '(shutdown|reboot|poweroff|halt)\\b',
  ':\\(\\)\\{\\s*:\\|:\\&\\s*\\};:',  // fork bomb
  '>\\s*/dev/sd',
  'chmod\\s+-R\\s+777\\s+/',
  'mv\\s+/\\s',
  ':\\s*>\\s*/etc/',
];

export const DEFAULT_AI_SETTINGS: AISettings = {
  providers: [],
  activeProviderId: '',
  activeModelId: '',
  globalPermissionMode: 'confirm',
  hostPermissions: [],
  externalAgents: [],
  defaultAgentId: 'catty',
  commandBlocklist: [...DEFAULT_COMMAND_BLOCKLIST],
  commandTimeout: 60,
  maxIterations: 20,
};

// Provider presets for quick setup
export const PROVIDER_PRESETS: Record<AIProviderId, { name: string; defaultBaseURL: string; modelsEndpoint?: string }> = {
  openai: { name: 'OpenAI', defaultBaseURL: 'https://api.openai.com/v1', modelsEndpoint: '/models' },
  anthropic: { name: 'Anthropic', defaultBaseURL: 'https://api.anthropic.com', modelsEndpoint: '/v1/models' },
  google: { name: 'Google AI', defaultBaseURL: 'https://generativelanguage.googleapis.com/v1beta' },
  ollama: { name: 'Ollama', defaultBaseURL: 'http://localhost:11434/v1', modelsEndpoint: '/models' },
  openrouter: { name: 'OpenRouter', defaultBaseURL: 'https://openrouter.ai/api/v1', modelsEndpoint: '/models' },
  custom: { name: 'Custom', defaultBaseURL: '' },
};
