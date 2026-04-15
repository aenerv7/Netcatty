import type {
  AIPanelView,
  AISession,
} from "../../infrastructure/ai/types.ts";

const DEFAULT_PANEL_VIEW: AIPanelView = { mode: "draft" };

interface HistorySessionSelectionActions {
  showSessionView: (sessionId: string) => void;
  setActiveSessionId: (sessionId: string) => void;
  closeHistory?: () => void;
}

export function resolveDisplayedPanelView(
  panelView: AIPanelView | undefined,
  hasDraft: boolean,
  sessions: AISession[],
  persistedSessionId?: string | null,
): AIPanelView {
  if (panelView) {
    return normalizePanelView(panelView, sessions);
  }

  if (hasDraft) {
    return DEFAULT_PANEL_VIEW;
  }

  // Honour the persisted active-session selection (survives cold mount)
  // before falling back to the newest history entry.
  if (persistedSessionId && sessions.some((s) => s.id === persistedSessionId)) {
    return { mode: "session", sessionId: persistedSessionId };
  }

  if (sessions[0]) {
    return { mode: "session", sessionId: sessions[0].id };
  }

  return DEFAULT_PANEL_VIEW;
}

export function normalizePanelView(
  panelView: AIPanelView,
  sessions: AISession[],
): AIPanelView {
  if (panelView.mode !== "session") {
    return panelView;
  }

  return sessions.some((session) => session.id === panelView.sessionId)
    ? panelView
    : DEFAULT_PANEL_VIEW;
}

export function resolveDisplayedSession(
  panelView: AIPanelView,
  sessions: AISession[],
): AISession | null {
  if (panelView.mode !== "session") {
    return null;
  }

  return sessions.find((session) => session.id === panelView.sessionId) ?? null;
}

export function shouldRetargetSessionForScope(
  session: AISession | null,
  scopeType: "terminal" | "workspace",
  scopeTargetId?: string,
  scopeHostIds?: string[],
  activeTerminalTargetIds?: Set<string>,
): boolean {
  if (!session || scopeType !== "terminal" || !scopeTargetId || !scopeHostIds?.length) {
    return false;
  }

  if (session.scope.type !== scopeType || session.scope.targetId === scopeTargetId) {
    return false;
  }

  if (session.scope.targetId && activeTerminalTargetIds?.has(session.scope.targetId)) {
    return false;
  }

  return session.scope.hostIds?.some((hostId) => scopeHostIds.includes(hostId)) ?? false;
}

export function applyHistorySessionSelection(
  sessionId: string,
  actions: HistorySessionSelectionActions,
): void {
  actions.showSessionView(sessionId);
  actions.setActiveSessionId(sessionId);
  actions.closeHistory?.();
}
