import test from "node:test";
import assert from "node:assert/strict";

import { terminalLayerAreEqual } from "./terminalLayerMemo.ts";

const baseProps = {
  hosts: [],
  groupConfigs: [],
  proxyProfiles: [],
  keys: [],
  identities: [],
  snippets: [],
  snippetPackages: [],
  sessions: [],
  workspaces: [],
  draggingSessionId: null,
  terminalTheme: {},
  accentMode: "theme",
  customAccent: null,
  terminalSettings: {},
  fontSize: 14,
  hotkeyScheme: "default",
  keyBindings: [],
  sftpDefaultViewMode: "list",
  sftpDoubleClickBehavior: "open",
  sftpAutoSync: false,
  sftpShowHiddenFiles: false,
  sftpUseCompressedUpload: false,
  sftpAutoOpenSidebar: false,
  editorWordWrap: false,
  setEditorWordWrap: () => {},
  onHotkeyAction: () => {},
  onUpdateHost: () => {},
  onToggleWorkspaceViewMode: () => {},
  onSetWorkspaceFocusedSession: () => {},
  onSplitSession: () => {},
  toggleScriptsSidePanelRef: { current: null },
};

test("TerminalLayer re-renders when group configs change", () => {
  assert.equal(
    terminalLayerAreEqual(
      baseProps as never,
      { ...baseProps, groupConfigs: [{ path: "prod", proxyProfileId: "proxy-1" }] } as never,
    ),
    false,
  );
});

test("TerminalLayer re-renders when proxy profiles change", () => {
  assert.equal(
    terminalLayerAreEqual(
      baseProps as never,
      {
        ...baseProps,
        proxyProfiles: [{
          id: "proxy-1",
          label: "Office Proxy",
          config: { type: "http", host: "proxy.example.com", port: 3128 },
          createdAt: 1,
        }],
      } as never,
    ),
    false,
  );
});
