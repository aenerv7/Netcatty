import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { I18nProvider } from "../../application/i18n/I18nProvider.tsx";
import type { Host } from "../../types.ts";
import { TerminalToolbar } from "./TerminalToolbar.tsx";

const sshHost: Host = {
  id: "host-1",
  label: "Host",
  hostname: "example.com",
  username: "root",
  tags: [],
  os: "linux",
  protocol: "ssh",
};

const renderToolbar = (
  host: Host,
  status: "connecting" | "connected" | "disconnected" = "connected",
  props: Partial<React.ComponentProps<typeof TerminalToolbar>> = {},
) =>
  renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      { locale: "en" },
      React.createElement(TerminalToolbar, {
        status,
        host,
        onOpenSettings: () => {},
        ...props,
      }),
    ),
  );

test("uses the terminal active button color for pressed toolbar actions", () => {
  const markup = renderToolbar(sshHost, "connected", {
    isSearchOpen: true,
    onToggleSearch: () => {},
  });

  assert.match(
    markup,
    /aria-label="Search terminal"[^>]*style="background-color:var\(--terminal-toolbar-btn-active\)"/,
  );
});
