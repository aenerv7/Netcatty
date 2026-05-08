import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { I18nProvider } from "../application/i18n/I18nProvider.tsx";
import { isValidProxyPort } from "../domain/proxyProfiles.ts";
import { STORAGE_KEY_VAULT_PROXY_PROFILES_VIEW_MODE } from "../infrastructure/config/storageKeys.ts";
import type { ProxyProfile } from "../types.ts";
import { ProxyProfilesManager } from "./ProxyProfilesManager.tsx";

const proxyProfile: ProxyProfile = {
  id: "proxy-1",
  label: "Office Proxy",
  config: {
    type: "http",
    host: "127.0.0.1",
    port: 8080,
  },
  createdAt: 1,
};

const installStorageStub = (viewMode: string | null = null) => {
  const values = new Map<string, string>();
  if (viewMode) {
    values.set(STORAGE_KEY_VAULT_PROXY_PROFILES_VIEW_MODE, viewMode);
  }

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    },
  });
};

const renderManager = (viewMode: string | null = null) => {
  installStorageStub(viewMode);
  return renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      { locale: "en" },
      React.createElement(ProxyProfilesManager, {
        proxyProfiles: [proxyProfile],
        hosts: [],
        groupConfigs: [],
        onUpdateProxyProfiles: () => {},
        onUpdateHosts: () => {},
        onUpdateGroupConfigs: () => {},
      }),
    ),
  );
};

test("ProxyProfilesManager uses the shared Vault grid card style by default", () => {
  const markup = renderManager();

  assert.match(markup, /Add Proxy/);
  assert.match(markup, /aria-label="Search proxies…"/);
  assert.match(markup, /aria-label="Office Proxy, HTTP, 127\.0\.0\.1:8080, 0 linked"/);
  assert.match(markup, /Office Proxy/);
  assert.match(markup, /127\.0\.0\.1:8080/);
});

test("ProxyProfilesManager uses the shared Vault list row style when persisted", () => {
  const markup = renderManager("list");

  assert.match(markup, /aria-label="Office Proxy, HTTP, 127\.0\.0\.1:8080, 0 linked"/);
  assert.match(markup, /Office Proxy/);
  assert.match(markup, /127\.0\.0\.1:8080/);
});

test("ProxyProfilesManager validates proxy ports", () => {
  assert.equal(isValidProxyPort(1), true);
  assert.equal(isValidProxyPort(65535), true);
  assert.equal(isValidProxyPort(0), false);
  assert.equal(isValidProxyPort(65536), false);
  assert.equal(isValidProxyPort(10.5), false);
});
