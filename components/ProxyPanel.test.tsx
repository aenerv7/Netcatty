import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { I18nProvider } from "../application/i18n/I18nProvider.tsx";
import type { ProxyProfile } from "../types.ts";
import { ProxyPanel } from "./host-details/ProxyPanel.tsx";

const proxyProfile: ProxyProfile = {
  id: "proxy-1",
  label: "Office Proxy",
  config: {
    type: "socks5",
    host: "office-proxy.example.com",
    port: 1080,
  },
  createdAt: 1,
};

const renderPanel = (props: Partial<React.ComponentProps<typeof ProxyPanel>> = {}) =>
  renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      { locale: "en" },
      React.createElement(ProxyPanel, {
        proxyConfig: undefined,
        proxyProfiles: [],
        selectedProxyProfileId: undefined,
        onUpdateProxy: () => {},
        onSelectProxyProfile: () => {},
        onClearProxy: () => {},
        onBack: () => {},
        onCancel: () => {},
        layout: "inline",
        ...props,
      }),
    ),
  );

test("ProxyPanel shows saved proxy selection when reusable profiles exist", () => {
  const markup = renderPanel({
    proxyProfiles: [proxyProfile],
    selectedProxyProfileId: proxyProfile.id,
  });

  assert.match(markup, /Saved proxy/);
  assert.match(markup, /office-proxy\.example\.com:1080/);
  assert.doesNotMatch(markup, /Proxy host/);
});

test("ProxyPanel keeps manual proxy fields available without a saved profile selection", () => {
  const markup = renderPanel({
    proxyProfiles: [proxyProfile],
    proxyConfig: { type: "http", host: "manual-proxy.example.com", port: 3128 },
  });

  assert.match(markup, /Saved proxy/);
  assert.match(markup, /Proxy host/);
  assert.match(markup, /manual-proxy\.example\.com/);
});

test("ProxyPanel shows a clear missing state for stale saved proxy selections", () => {
  const markup = renderPanel({
    proxyProfiles: [proxyProfile],
    selectedProxyProfileId: "missing-proxy",
  });

  assert.match(markup, /Missing saved proxy/);
  assert.match(markup, /Proxy host/);
});

test("ProxyPanel disables saving invalid manual proxy ports", () => {
  const markup = renderPanel({
    proxyConfig: { type: "http", host: "manual-proxy.example.com", port: 65536 },
  });

  assert.match(markup, /Port must be between 1 and 65535/);
  assert.match(markup, /disabled=""/);
});
