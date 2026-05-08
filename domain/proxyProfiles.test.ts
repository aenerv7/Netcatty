import test from "node:test";
import assert from "node:assert/strict";

import type { Host, ProxyProfile } from "./models.ts";
import {
  isCompleteProxyConfig,
  normalizeManualProxyConfig,
  materializeHostProxyProfile,
  removeProxyProfileReferences,
} from "./proxyProfiles.ts";

const profile = (overrides: Partial<ProxyProfile> = {}): ProxyProfile => ({
  id: "proxy-1",
  label: "Office Proxy",
  config: {
    type: "socks5",
    host: "proxy.example.com",
    port: 1080,
    username: "alice",
    password: "secret",
  },
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const host = (overrides: Partial<Host> = {}): Host => ({
  id: "host-1",
  label: "Server",
  hostname: "server.example.com",
  username: "root",
  os: "linux",
  tags: [],
  protocol: "ssh",
  ...overrides,
});

test("materializeHostProxyProfile resolves a selected proxy profile", () => {
  const resolved = materializeHostProxyProfile(
    host({ proxyProfileId: "proxy-1" }),
    [profile()],
  );

  assert.deepEqual(resolved.proxyConfig, profile().config);
});

test("materializeHostProxyProfile keeps explicit custom proxy ahead of profile reference", () => {
  const customProxy = {
    type: "http" as const,
    host: "custom.example.com",
    port: 3128,
  };

  const resolved = materializeHostProxyProfile(
    host({ proxyProfileId: "proxy-1", proxyConfig: customProxy }),
    [profile()],
  );

  assert.deepEqual(resolved.proxyConfig, customProxy);
});

test("removeProxyProfileReferences clears hosts and group configs that use a deleted profile", () => {
  const result = removeProxyProfileReferences("proxy-1", {
    hosts: [
      host({ id: "host-1", proxyProfileId: "proxy-1" }),
      host({ id: "host-2", proxyProfileId: "proxy-2" }),
    ],
    groupConfigs: [
      { path: "prod", proxyProfileId: "proxy-1" },
      { path: "dev", proxyProfileId: "proxy-2" },
    ],
  });

  assert.equal(result.hosts[0].proxyProfileId, undefined);
  assert.equal(result.hosts[1].proxyProfileId, "proxy-2");
  assert.equal(result.groupConfigs[0].proxyProfileId, undefined);
  assert.equal(result.groupConfigs[1].proxyProfileId, "proxy-2");
});

test("normalizeManualProxyConfig clears empty proxy drafts", () => {
  assert.equal(
    normalizeManualProxyConfig({ type: "http", host: "", port: 8080 }),
    undefined,
  );
});

test("isCompleteProxyConfig requires host and a valid port", () => {
  assert.equal(isCompleteProxyConfig({ type: "http", host: "", port: 8080 }), false);
  assert.equal(isCompleteProxyConfig({ type: "http", host: "proxy.example.com", port: 0 }), false);
  assert.equal(isCompleteProxyConfig({ type: "http", host: "proxy.example.com", port: 3128 }), true);
});
