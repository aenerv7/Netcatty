import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { I18nProvider } from "../application/i18n/I18nProvider.tsx";
import type { Host } from "../types.ts";
import HostDetailsPanel from "./HostDetailsPanel.tsx";

const hostWithMissingProxyProfile: Host = {
  id: "host-1",
  label: "DB",
  hostname: "db.example.com",
  username: "root",
  tags: [],
  os: "linux",
  port: 22,
  protocol: "ssh",
  authMethod: "password",
  proxyProfileId: "missing-proxy",
  createdAt: 1,
};

const renderHostDetails = (initialData: Host = hostWithMissingProxyProfile) =>
  renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      { locale: "en" },
      React.createElement(HostDetailsPanel, {
        initialData,
        availableKeys: [],
        identities: [],
        proxyProfiles: [],
        groups: [],
        managedSources: [],
        allTags: [],
        allHosts: [],
        terminalThemeId: "default",
        terminalFontSize: 14,
        onSave: () => {},
        onCancel: () => {},
      }),
    ),
  );

test("HostDetailsPanel shows a missing saved proxy without undefined fields", () => {
  const markup = renderHostDetails();

  assert.match(markup, /Missing saved proxy/);
  assert.doesNotMatch(markup, /undefined:undefined/);
});

test("HostDetailsPanel keeps explicitly cleared telnet credentials empty", () => {
  const markup = renderHostDetails({
    ...hostWithMissingProxyProfile,
    protocol: "telnet",
    telnetEnabled: true,
    telnetPort: 23,
    username: "root",
    password: "ssh-password",
    telnetUsername: "",
    telnetPassword: "",
    proxyProfileId: undefined,
  });

  assert.match(markup, /placeholder="Telnet Username"[^>]*value=""/);
  assert.match(markup, /placeholder="Telnet Password"[^>]*value=""/);
  assert.doesNotMatch(markup, /placeholder="Telnet Username"[^>]*value="root"/);
  assert.doesNotMatch(markup, /placeholder="Telnet Password"[^>]*value="ssh-password"/);
});

test("HostDetailsPanel gives the telnet port field the same roomy layout as SSH", () => {
  const markup = renderHostDetails({
    ...hostWithMissingProxyProfile,
    protocol: "telnet",
    telnetEnabled: true,
    telnetPort: 2325,
    proxyProfileId: undefined,
  });

  assert.match(markup, /Telnet on[\s\S]*ml-auto w-1\/2 min-w-0 flex items-center gap-2 justify-end/);
  assert.match(markup, /class="[^"]*h-8 flex-1 min-w-0 text-center[^"]*"[^>]*value="2325"/);
  assert.doesNotMatch(markup, /class="[^"]*w-16[^"]*"[^>]*value="2325"/);
});
