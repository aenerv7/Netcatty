import { useCallback, useState } from 'react';
import { localStorageAdapter } from '../../infrastructure/persistence/localStorageAdapter';
import {
  STORAGE_KEY_AI_PROVIDERS,
  STORAGE_KEY_AI_ACTIVE_PROVIDER,
  STORAGE_KEY_AI_ACTIVE_MODEL,
  STORAGE_KEY_AI_PERMISSION_MODE,
  STORAGE_KEY_AI_HOST_PERMISSIONS,
  STORAGE_KEY_AI_EXTERNAL_AGENTS,
  STORAGE_KEY_AI_DEFAULT_AGENT,
  STORAGE_KEY_AI_COMMAND_BLOCKLIST,
  STORAGE_KEY_AI_COMMAND_TIMEOUT,
  STORAGE_KEY_AI_MAX_ITERATIONS,
  STORAGE_KEY_AI_SESSIONS,
} from '../../infrastructure/config/storageKeys';
import type {
  AISession,
  AIPermissionMode,
  ProviderConfig,
  HostAIPermission,
  ExternalAgentConfig,
  ChatMessage,
  AISessionScope,
} from '../../infrastructure/ai/types';
import { DEFAULT_COMMAND_BLOCKLIST } from '../../infrastructure/ai/types';

export function useAIState() {
  // ── Provider Config ──
  const [providers, setProvidersRaw] = useState<ProviderConfig[]>(() =>
    localStorageAdapter.read<ProviderConfig[]>(STORAGE_KEY_AI_PROVIDERS) ?? []
  );
  const [activeProviderId, setActiveProviderIdRaw] = useState<string>(() =>
    localStorageAdapter.readString(STORAGE_KEY_AI_ACTIVE_PROVIDER) ?? ''
  );
  const [activeModelId, setActiveModelIdRaw] = useState<string>(() =>
    localStorageAdapter.readString(STORAGE_KEY_AI_ACTIVE_MODEL) ?? ''
  );

  // ── Permission Model ──
  const [globalPermissionMode, setGlobalPermissionModeRaw] = useState<AIPermissionMode>(() => {
    const stored = localStorageAdapter.readString(STORAGE_KEY_AI_PERMISSION_MODE);
    if (stored === 'observer' || stored === 'confirm' || stored === 'autonomous') return stored;
    return 'confirm';
  });
  const [hostPermissions, setHostPermissionsRaw] = useState<HostAIPermission[]>(() =>
    localStorageAdapter.read<HostAIPermission[]>(STORAGE_KEY_AI_HOST_PERMISSIONS) ?? []
  );

  // ── External Agents ──
  const [externalAgents, setExternalAgentsRaw] = useState<ExternalAgentConfig[]>(() =>
    localStorageAdapter.read<ExternalAgentConfig[]>(STORAGE_KEY_AI_EXTERNAL_AGENTS) ?? []
  );
  const [defaultAgentId, setDefaultAgentIdRaw] = useState<string>(() =>
    localStorageAdapter.readString(STORAGE_KEY_AI_DEFAULT_AGENT) ?? 'catty'
  );

  // ── Safety Settings ──
  const [commandBlocklist, setCommandBlocklistRaw] = useState<string[]>(() =>
    localStorageAdapter.read<string[]>(STORAGE_KEY_AI_COMMAND_BLOCKLIST) ?? [...DEFAULT_COMMAND_BLOCKLIST]
  );
  const [commandTimeout, setCommandTimeoutRaw] = useState<number>(() =>
    localStorageAdapter.readNumber(STORAGE_KEY_AI_COMMAND_TIMEOUT) ?? 60
  );
  const [maxIterations, setMaxIterationsRaw] = useState<number>(() =>
    localStorageAdapter.readNumber(STORAGE_KEY_AI_MAX_ITERATIONS) ?? 20
  );

  // ── Sessions ──
  const [sessions, setSessionsRaw] = useState<AISession[]>(() =>
    localStorageAdapter.read<AISession[]>(STORAGE_KEY_AI_SESSIONS) ?? []
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // ── Persist helpers ──
  const setProviders = useCallback((value: ProviderConfig[] | ((prev: ProviderConfig[]) => ProviderConfig[])) => {
    setProvidersRaw(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      localStorageAdapter.write(STORAGE_KEY_AI_PROVIDERS, next);
      return next;
    });
  }, []);

  const setActiveProviderId = useCallback((id: string) => {
    setActiveProviderIdRaw(id);
    localStorageAdapter.writeString(STORAGE_KEY_AI_ACTIVE_PROVIDER, id);
  }, []);

  const setActiveModelId = useCallback((id: string) => {
    setActiveModelIdRaw(id);
    localStorageAdapter.writeString(STORAGE_KEY_AI_ACTIVE_MODEL, id);
  }, []);

  const setGlobalPermissionMode = useCallback((mode: AIPermissionMode) => {
    setGlobalPermissionModeRaw(mode);
    localStorageAdapter.writeString(STORAGE_KEY_AI_PERMISSION_MODE, mode);
  }, []);

  const setHostPermissions = useCallback((value: HostAIPermission[] | ((prev: HostAIPermission[]) => HostAIPermission[])) => {
    setHostPermissionsRaw(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      localStorageAdapter.write(STORAGE_KEY_AI_HOST_PERMISSIONS, next);
      return next;
    });
  }, []);

  const setExternalAgents = useCallback((value: ExternalAgentConfig[] | ((prev: ExternalAgentConfig[]) => ExternalAgentConfig[])) => {
    setExternalAgentsRaw(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      localStorageAdapter.write(STORAGE_KEY_AI_EXTERNAL_AGENTS, next);
      return next;
    });
  }, []);

  const setDefaultAgentId = useCallback((id: string) => {
    setDefaultAgentIdRaw(id);
    localStorageAdapter.writeString(STORAGE_KEY_AI_DEFAULT_AGENT, id);
  }, []);

  const setCommandBlocklist = useCallback((value: string[]) => {
    setCommandBlocklistRaw(value);
    localStorageAdapter.write(STORAGE_KEY_AI_COMMAND_BLOCKLIST, value);
  }, []);

  const setCommandTimeout = useCallback((value: number) => {
    setCommandTimeoutRaw(value);
    localStorageAdapter.writeNumber(STORAGE_KEY_AI_COMMAND_TIMEOUT, value);
  }, []);

  const setMaxIterations = useCallback((value: number) => {
    setMaxIterationsRaw(value);
    localStorageAdapter.writeNumber(STORAGE_KEY_AI_MAX_ITERATIONS, value);
  }, []);

  // ── Session CRUD ──
  const persistSessions = useCallback((next: AISession[]) => {
    localStorageAdapter.write(STORAGE_KEY_AI_SESSIONS, next);
  }, []);

  const createSession = useCallback((scope: AISessionScope, agentId?: string): AISession => {
    const now = Date.now();
    const session: AISession = {
      id: `ai_${now}_${Math.random().toString(36).slice(2, 8)}`,
      title: 'New Chat',
      agentId: agentId || defaultAgentId,
      scope,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    setSessionsRaw(prev => {
      const next = [session, ...prev];
      persistSessions(next);
      return next;
    });
    setActiveSessionId(session.id);
    return session;
  }, [defaultAgentId, persistSessions]);

  const deleteSession = useCallback((sessionId: string) => {
    setSessionsRaw(prev => {
      const next = prev.filter(s => s.id !== sessionId);
      persistSessions(next);
      return next;
    });
    setActiveSessionId(prev => prev === sessionId ? null : prev);
  }, [persistSessions]);

  const deleteSessionsByTarget = useCallback((scopeType: 'terminal' | 'workspace', targetId: string) => {
    const deletedIds = new Set<string>();
    setSessionsRaw(prev => {
      const next = prev.filter(s => {
        const match = s.scope.type === scopeType && s.scope.targetId === targetId;
        if (match) deletedIds.add(s.id);
        return !match;
      });
      persistSessions(next);
      return next;
    });
    setActiveSessionId(prev => (prev && deletedIds.has(prev)) ? null : prev);
  }, [persistSessions]);

  const updateSessionTitle = useCallback((sessionId: string, title: string) => {
    setSessionsRaw(prev => {
      const next = prev.map(s => s.id === sessionId ? { ...s, title, updatedAt: Date.now() } : s);
      persistSessions(next);
      return next;
    });
  }, [persistSessions]);

  const addMessageToSession = useCallback((sessionId: string, message: ChatMessage) => {
    setSessionsRaw(prev => {
      const next = prev.map(s => {
        if (s.id !== sessionId) return s;
        return { ...s, messages: [...s.messages, message], updatedAt: Date.now() };
      });
      persistSessions(next);
      return next;
    });
  }, [persistSessions]);

  const updateLastMessage = useCallback((sessionId: string, updater: (msg: ChatMessage) => ChatMessage) => {
    setSessionsRaw(prev => {
      const next = prev.map(s => {
        if (s.id !== sessionId || s.messages.length === 0) return s;
        const msgs = [...s.messages];
        msgs[msgs.length - 1] = updater(msgs[msgs.length - 1]);
        return { ...s, messages: msgs, updatedAt: Date.now() };
      });
      persistSessions(next);
      return next;
    });
  }, [persistSessions]);

  const clearSessionMessages = useCallback((sessionId: string) => {
    setSessionsRaw(prev => {
      const next = prev.map(s => s.id === sessionId ? { ...s, messages: [], updatedAt: Date.now() } : s);
      persistSessions(next);
      return next;
    });
  }, [persistSessions]);

  // ── Provider CRUD helpers ──
  const addProvider = useCallback((provider: ProviderConfig) => {
    setProviders(prev => [...prev, provider]);
  }, [setProviders]);

  const updateProvider = useCallback((id: string, updates: Partial<ProviderConfig>) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, [setProviders]);

  const removeProvider = useCallback((id: string) => {
    setProviders(prev => prev.filter(p => p.id !== id));
    // Use the raw setter to avoid stale closure over setActiveProviderId
    setActiveProviderIdRaw(prevId => {
      if (prevId === id) {
        const next = '';
        localStorageAdapter.writeString(STORAGE_KEY_AI_ACTIVE_PROVIDER, next);
        return next;
      }
      return prevId;
    });
  }, [setProviders]);

  // ── Computed ──
  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null;
  const activeProvider = providers.find(p => p.id === activeProviderId) ?? null;

  return {
    // Provider config
    providers,
    setProviders,
    addProvider,
    updateProvider,
    removeProvider,
    activeProviderId,
    setActiveProviderId,
    activeModelId,
    setActiveModelId,
    activeProvider,

    // Permission model
    globalPermissionMode,
    setGlobalPermissionMode,
    hostPermissions,
    setHostPermissions,

    // External agents
    externalAgents,
    setExternalAgents,
    defaultAgentId,
    setDefaultAgentId,

    // Safety
    commandBlocklist,
    setCommandBlocklist,
    commandTimeout,
    setCommandTimeout,
    maxIterations,
    setMaxIterations,

    // Sessions
    sessions,
    activeSessionId,
    setActiveSessionId,
    activeSession,
    createSession,
    deleteSession,
    deleteSessionsByTarget,
    updateSessionTitle,
    addMessageToSession,
    updateLastMessage,
    clearSessionMessages,
  };
}
