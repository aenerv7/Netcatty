import test from "node:test";
import assert from "node:assert/strict";

import type {
  AIPanelView,
  AISession,
} from "../../infrastructure/ai/types.ts";
import { createEmptyDraft } from "./aiDraftState.ts";
import {
  pruneInactiveScopedSessions,
  pruneInactiveScopedTransientState,
} from "./aiScopeCleanup.ts";

function createSession(id: string, scope: AISession["scope"], externalSessionId?: string): AISession {
  return {
    id,
    title: id,
    agentId: "catty",
    scope,
    messages: [],
    externalSessionId,
    createdAt: 1,
    updatedAt: 1,
  };
}

test("pruneInactiveScopedTransientState removes closed workspace and terminal scope state", () => {
  const activeSessionIdMap = {
    "terminal:open-terminal": "session-open",
    "terminal:closed-terminal": "session-closed-terminal",
    "workspace:open-workspace": "session-open-workspace",
    "workspace:closed-workspace": "session-closed-workspace",
  };
  const draftsByScope = {
    "terminal:open-terminal": createEmptyDraft("catty"),
    "terminal:closed-terminal": createEmptyDraft("catty"),
    "workspace:open-workspace": createEmptyDraft("catty"),
    "workspace:closed-workspace": createEmptyDraft("catty"),
  };
  const panelViewByScope = {
    "terminal:open-terminal": { mode: "draft" },
    "terminal:closed-terminal": { mode: "session", sessionId: "session-closed-terminal" },
    "workspace:open-workspace": { mode: "draft" },
    "workspace:closed-workspace": { mode: "session", sessionId: "session-closed-workspace" },
  } satisfies Record<string, AIPanelView>;

  const next = pruneInactiveScopedTransientState(
    activeSessionIdMap,
    draftsByScope,
    panelViewByScope,
    new Set(["open-terminal", "open-workspace"]),
  );

  assert.deepEqual(next.activeSessionIdMap, {
    "terminal:open-terminal": "session-open",
    "workspace:open-workspace": "session-open-workspace",
  });
  assert.deepEqual(next.draftsByScope, {
    "terminal:open-terminal": draftsByScope["terminal:open-terminal"],
    "workspace:open-workspace": draftsByScope["workspace:open-workspace"],
  });
  assert.deepEqual(next.panelViewByScope, {
    "terminal:open-terminal": panelViewByScope["terminal:open-terminal"],
    "workspace:open-workspace": panelViewByScope["workspace:open-workspace"],
  });
});

test("pruneInactiveScopedSessions removes non-restorable terminal chats and closed workspaces", () => {
  const sessions = [
    createSession("terminal-restorable", {
      type: "terminal",
      targetId: "closed-restorable",
      hostIds: ["host-1"],
    }, "ext-1"),
    createSession("terminal-local", {
      type: "terminal",
      targetId: "closed-local",
      hostIds: ["local-shell"],
    }, "ext-2"),
    createSession("workspace-closed", {
      type: "workspace",
      targetId: "closed-workspace",
    }, "ext-3"),
    createSession("terminal-open", {
      type: "terminal",
      targetId: "open-terminal",
      hostIds: ["host-2"],
    }, "ext-4"),
  ];

  const next = pruneInactiveScopedSessions(
    sessions,
    new Set(["open-terminal"]),
  );

  assert.deepEqual(next.orphanedSessionIds, [
    "terminal-restorable",
    "terminal-local",
    "workspace-closed",
  ]);
  assert.deepEqual(next.sessions, [
    {
      ...sessions[0],
      externalSessionId: undefined,
    },
    sessions[3],
  ]);
});

test("pruneInactiveScopedSessions preserves original sessions when orphaned restorable chats are already detached", () => {
  const sessions = [
    createSession("terminal-restorable", {
      type: "terminal",
      targetId: "closed-restorable",
      hostIds: ["host-1"],
    }),
    createSession("terminal-open", {
      type: "terminal",
      targetId: "open-terminal",
      hostIds: ["host-2"],
    }, "ext-4"),
  ];

  const next = pruneInactiveScopedSessions(
    sessions,
    new Set(["open-terminal"]),
  );

  assert.deepEqual(next.orphanedSessionIds, ["terminal-restorable"]);
  assert.equal(next.sessions, sessions);
});
