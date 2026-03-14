/**
 * AIChatSidePanel - Main AI chat interface side panel
 *
 * Zed-style agent panel with agent selector, scoped chat sessions,
 * message list, input area, and session history drawer.
 */

import {
  History,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { streamText, stepCountIs } from 'ai';
import { cn } from '../lib/utils';
import { useWindowControls } from '../application/state/useWindowControls';
import type {
  AIPermissionMode,
  AISession,
  AISessionScope,
  ChatMessage,
  ExternalAgentConfig,
  ProviderConfig,
} from '../infrastructure/ai/types';
import { buildSystemPrompt } from '../infrastructure/ai/cattyAgent/systemPrompt';
import { createModelFromConfig } from '../infrastructure/ai/sdk/providers';
import { createCattyTools } from '../infrastructure/ai/sdk/tools';
import { exportAsMarkdown, exportAsJSON, exportAsPlainText, getExportFilename } from '../infrastructure/ai/conversationExport';
import { runExternalAgentTurn } from '../infrastructure/ai/externalAgentAdapter';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import AgentSelector from './ai/AgentSelector';
import ChatInput from './ai/ChatInput';
import ChatMessageList from './ai/ChatMessageList';
import ConversationExport from './ai/ConversationExport';

// -------------------------------------------------------------------
// Props
// -------------------------------------------------------------------

interface AIChatSidePanelProps {
  // Session state
  sessions: AISession[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  createSession: (scope: AISessionScope, agentId?: string) => AISession;
  deleteSession: (sessionId: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  addMessageToSession: (sessionId: string, message: ChatMessage) => void;
  updateLastMessage: (
    sessionId: string,
    updater: (msg: ChatMessage) => ChatMessage,
  ) => void;
  // Provider config
  providers: ProviderConfig[];
  activeProviderId: string;
  activeModelId: string;

  // Agent info
  defaultAgentId: string;
  externalAgents: ExternalAgentConfig[];

  // Permission
  globalPermissionMode: AIPermissionMode;
  commandBlocklist?: string[];

  // Context
  scopeType: 'terminal' | 'workspace';
  scopeTargetId?: string;
  scopeHostIds?: string[];
  scopeLabel?: string;

  // Terminal session context (from parent)
  terminalSessions?: Array<{
    sessionId: string;
    hostId: string;
    hostname: string;
    label: string;
    os?: string;
    username?: string;
    connected: boolean;
  }>;

  // Visibility
  isVisible?: boolean;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

const AIChatSidePanelInner: React.FC<AIChatSidePanelProps> = ({
  sessions,
  activeSessionId,
  setActiveSessionId,
  createSession,
  deleteSession,
  updateSessionTitle,
  addMessageToSession,
  updateLastMessage,
  providers,
  activeProviderId,
  activeModelId,
  defaultAgentId,
  externalAgents,
  globalPermissionMode,
  commandBlocklist,
  scopeType,
  scopeTargetId,
  scopeHostIds,
  scopeLabel,
  terminalSessions = [],
  isVisible = true,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentAgentId, setCurrentAgentId] = useState(defaultAgentId);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { openSettingsWindow } = useWindowControls();

  // Active session
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const messages = activeSession?.messages ?? [];

  // Active provider info
  const activeProvider = useMemo(
    () => providers.find((p) => p.id === activeProviderId),
    [providers, activeProviderId],
  );

  const providerDisplayName = activeProvider?.name ?? '';
  const modelDisplayName = activeModelId || activeProvider?.defaultModel || '';

  // Filtered sessions for history (matching current scope type)
  const historySessions = useMemo(
    () =>
      sessions
        .filter((s) => s.scope.type === scopeType)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions, scopeType],
  );

  // -------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------

  const handleNewChat = useCallback(() => {
    const scope: AISessionScope = {
      type: scopeType,
      targetId: scopeTargetId,
      hostIds: scopeHostIds,
    };
    const session = createSession(scope, currentAgentId);
    setActiveSessionId(session.id);
    setShowHistory(false);
    setInputValue('');
  }, [
    scopeType,
    scopeTargetId,
    scopeHostIds,
    currentAgentId,
    createSession,
    setActiveSessionId,
  ]);

  const handleOpenSettings = useCallback(() => {
    void openSettingsWindow();
  }, [openSettingsWindow]);

  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;
    if (!activeProvider) return;

    // Create session if needed
    let sessionId = activeSessionId;
    if (!sessionId) {
      const scope: AISessionScope = {
        type: scopeType,
        targetId: scopeTargetId,
        hostIds: scopeHostIds,
      };
      const session = createSession(scope, currentAgentId);
      sessionId = session.id;
      setActiveSessionId(sessionId);
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };
    addMessageToSession(sessionId, userMessage);
    setInputValue('');
    setIsStreaming(true);

    // Create assistant message placeholder for streaming
    addMessageToSession(sessionId, {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model: activeModelId || activeProvider.defaultModel || '',
      providerId: activeProvider.providerId,
    });

    // Abort controller for cancellation
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Get current session for context
    const currentSession = sessions.find((s) => s.id === sessionId);

    // Check if using an external agent
    const isExternalAgent = currentAgentId !== 'catty';

    if (isExternalAgent) {
      const agentConfig = externalAgents.find(a => a.id === currentAgentId);
      if (!agentConfig) {
        updateLastMessage(sessionId, msg => ({
          ...msg,
          content: 'External agent not found. Please check settings.',
          executionStatus: 'failed',
        }));
        setIsStreaming(false);
        return;
      }

      try {
        await runExternalAgentTurn(
          agentConfig,
          trimmed,
          {
            onTextDelta: (text: string) => {
              updateLastMessage(sessionId!, msg => ({ ...msg, content: msg.content + text }));
            },
            onError: (error: string) => {
              updateLastMessage(sessionId!, msg => ({
                ...msg,
                content: msg.content + '\n\n**Error:** ' + error,
                executionStatus: 'failed',
              }));
            },
            onDone: () => {},
          },
          (window as unknown as Record<string, unknown>).netcatty as Parameters<typeof runExternalAgentTurn>[3],
          abortController.signal,
        );
      } catch (err) {
        if (!abortController.signal.aborted) {
          updateLastMessage(sessionId!, msg => ({
            ...msg,
            content: msg.content + '\n\n**Error:** ' + (err instanceof Error ? err.message : String(err)),
          }));
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
        if (
          currentSession &&
          (!currentSession.title || currentSession.title === 'New Chat')
        ) {
          const title =
            trimmed.length > 50 ? trimmed.slice(0, 50) + '...' : trimmed;
          updateSessionTitle(sessionId!, title);
        }
      }
      return;
    }

    // --- Catty Agent: Vercel AI SDK streamText ---
    const bridge = (window as unknown as { netcatty?: Record<string, unknown> }).netcatty;
    const tools = createCattyTools(bridge, {
      sessions: terminalSessions,
      workspaceId: scopeTargetId,
      workspaceName: scopeLabel,
    }, commandBlocklist);

    const systemPrompt = buildSystemPrompt({
      scopeType,
      scopeLabel,
      hosts: terminalSessions.map(s => ({
        sessionId: s.sessionId,
        hostname: s.hostname,
        label: s.label,
        os: s.os,
        username: s.username,
        connected: s.connected,
      })),
      permissionMode: globalPermissionMode,
    });

    const model = createModelFromConfig({
      ...activeProvider,
      defaultModel: activeModelId || activeProvider.defaultModel || '',
    });

    try {
      // Build message array for the SDK
      const sdkMessages = (currentSession?.messages ?? [])
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      sdkMessages.push({ role: 'user', content: trimmed });

      const result = streamText({
        model,
        messages: sdkMessages,
        system: systemPrompt,
        tools,
        stopWhen: stepCountIs(20),
        abortSignal: abortController.signal,
      });

      // Stream the response
      for await (const chunk of result.fullStream) {
        switch (chunk.type) {
          case 'text-delta':
            updateLastMessage(sessionId!, msg => ({
              ...msg,
              content: msg.content + chunk.textDelta,
            }));
            break;
          case 'tool-call':
            updateLastMessage(sessionId!, msg => ({
              ...msg,
              toolCalls: [...(msg.toolCalls || []), {
                id: chunk.toolCallId,
                name: chunk.toolName,
                arguments: chunk.args,
              }],
              executionStatus: 'running',
            }));
            break;
          case 'tool-result':
            addMessageToSession(sessionId!, {
              id: generateId(),
              role: 'tool',
              content: '',
              toolResults: [{
                toolCallId: chunk.toolCallId,
                content: typeof chunk.result === 'string'
                  ? chunk.result
                  : JSON.stringify(chunk.result),
                isError: false,
              }],
              timestamp: Date.now(),
              executionStatus: 'completed',
            });
            break;
          case 'error':
            updateLastMessage(sessionId!, msg => ({
              ...msg,
              content: msg.content + '\n\n**Error:** ' + String(chunk.error),
              executionStatus: 'failed',
            }));
            break;
        }
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        updateLastMessage(sessionId!, msg => ({
          ...msg,
          content: msg.content + '\n\n**Error:** ' + (err instanceof Error ? err.message : String(err)),
        }));
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
      // Auto-title the session from first user message
      const finalSession = sessions.find(s => s.id === sessionId);
      if (
        finalSession &&
        (!finalSession.title || finalSession.title === 'New Chat')
      ) {
        const title =
          trimmed.length > 50 ? trimmed.slice(0, 50) + '...' : trimmed;
        updateSessionTitle(sessionId!, title);
      }
    }
  }, [
    inputValue,
    isStreaming,
    activeProvider,
    activeSessionId,
    scopeType,
    scopeTargetId,
    scopeHostIds,
    scopeLabel,
    currentAgentId,
    activeModelId,
    globalPermissionMode,
    commandBlocklist,
    sessions,
    externalAgents,
    terminalSessions,
    createSession,
    setActiveSessionId,
    addMessageToSession,
    updateLastMessage,
    updateSessionTitle,
  ]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
      setShowHistory(false);
    },
    [setActiveSessionId],
  );

  const handleDeleteSession = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      deleteSession(sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
    },
    [deleteSession, activeSessionId, setActiveSessionId],
  );

  const handleAgentChange = useCallback((agentId: string) => {
    setCurrentAgentId(agentId);
  }, []);

  const handleExport = useCallback((format: 'md' | 'json' | 'txt') => {
    if (!activeSession) return;
    let content: string;
    switch (format) {
      case 'md': content = exportAsMarkdown(activeSession); break;
      case 'json': content = exportAsJSON(activeSession); break;
      case 'txt': content = exportAsPlainText(activeSession); break;
    }
    const filename = getExportFilename(activeSession, format);
    // Create a download blob
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeSession]);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  if (!isVisible) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Header ── */}
      <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-border/50 shrink-0">
        <AgentSelector
          currentAgentId={currentAgentId}
          externalAgents={externalAgents}
          onSelectAgent={handleAgentChange}
          onManageAgents={handleOpenSettings}
        />
        <div className="flex items-center gap-0.5">
          <ConversationExport
            session={activeSession}
            onExport={handleExport}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-muted-foreground/62 hover:bg-white/[0.05] hover:text-foreground"
            onClick={() => setShowHistory(!showHistory)}
            title="Session history"
          >
            <History size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-primary/82 hover:bg-primary/[0.10] hover:text-primary"
            onClick={handleNewChat}
            title="New chat"
          >
            <Plus size={15} />
          </Button>
        </div>
      </div>

      {/* ── Main content ── */}
      {showHistory ? (
        <SessionHistoryDrawer
          sessions={historySessions}
          activeSessionId={activeSessionId}
          onSelect={handleSelectSession}
          onDelete={handleDeleteSession}
          onClose={() => setShowHistory(false)}
        />
      ) : (
        <>
          {/* Chat messages */}
          <ChatMessageList messages={messages} isStreaming={isStreaming} />

          {/* Recent sessions (Zed-style, shown when no messages) */}
          {messages.length === 0 && historySessions.length > 0 && (
            <div className="shrink-0 px-4 pb-1">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[11px] text-muted-foreground/30 tracking-wide">Recent</span>
                <button
                  onClick={() => setShowHistory(true)}
                  className="text-[11px] text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors cursor-pointer"
                >
                  View All
                </button>
              </div>
              {historySessions.slice(0, 3).map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className="w-full flex items-baseline justify-between py-1.5 text-left hover:text-foreground transition-colors cursor-pointer"
                >
                  <span className="text-[13px] text-foreground/60 truncate pr-4">
                    {session.title || 'Untitled'}
                  </span>
                  <span className="text-[11px] text-muted-foreground/25 shrink-0">
                    {formatRelativeTime(new Date(session.updatedAt))}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            providerName={providerDisplayName}
            modelName={modelDisplayName}
            permissionMode={globalPermissionMode}
            agentName={currentAgentId === 'catty' ? 'Catty Agent' : externalAgents.find(a => a.id === currentAgentId)?.name}
          />
        </>
      )}
    </div>
  );
};

// -------------------------------------------------------------------
// Session History Drawer
// -------------------------------------------------------------------

interface SessionHistoryDrawerProps {
  sessions: AISession[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onDelete: (e: React.MouseEvent, sessionId: string) => void;
  onClose: () => void;
}

const SessionHistoryDrawer: React.FC<SessionHistoryDrawerProps> = ({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onClose,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-2.5 flex items-center justify-between shrink-0 border-b border-border/30">
        <span className="text-[13px] font-medium text-foreground/80">All Sessions</span>
        <button
          onClick={onClose}
          className="text-[12px] text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-3">
          {sessions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[13px] text-muted-foreground/40">
                No previous sessions
              </p>
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const time = new Date(session.updatedAt);
              const timeStr = formatRelativeTime(time);

              return (
                <button
                  key={session.id}
                  onClick={() => onSelect(session.id)}
                  className={cn(
                    'w-full flex items-center justify-between py-2.5 border-b border-border/20 text-left transition-colors cursor-pointer group',
                    isActive ? 'text-foreground' : 'text-foreground/70 hover:text-foreground',
                  )}
                >
                  <span className="text-[13px] truncate pr-3 flex-1 min-w-0">
                    {session.title || 'Untitled'}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[12px] text-muted-foreground/50">
                      {timeStr}
                    </span>
                    <button
                      onClick={(e) => onDelete(e, session.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-all cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// -------------------------------------------------------------------
// Export
// -------------------------------------------------------------------

const AIChatSidePanel = React.memo(AIChatSidePanelInner);
AIChatSidePanel.displayName = 'AIChatSidePanel';

export default AIChatSidePanel;
export { AIChatSidePanel };
export type { AIChatSidePanelProps };
