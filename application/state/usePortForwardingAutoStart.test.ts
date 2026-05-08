import test from "node:test";
import assert from "node:assert/strict";

import { getAutoStartRuleBlockReason, isAutoStartProxyReady } from "./usePortForwardingAutoStart.ts";
import type { GroupConfig, Host, PortForwardingRule, ProxyProfile } from "../../domain/models.ts";

const host = (overrides: Partial<Host> = {}): Host => ({
  id: "host-1",
  label: "Host",
  hostname: "example.com",
  username: "root",
  tags: [],
  os: "linux",
  ...overrides,
});

const proxyProfile = (id: string): ProxyProfile => ({
  id,
  label: "Proxy",
  config: { type: "http", host: "proxy.example.com", port: 3128 },
  createdAt: 1,
});

const rule = (overrides: Partial<PortForwardingRule> = {}): PortForwardingRule => ({
  id: "rule-1",
  label: "Rule",
  type: "local",
  localPort: 8080,
  bindAddress: "127.0.0.1",
  remoteHost: "127.0.0.1",
  remotePort: 80,
  hostId: "host-1",
  autoStart: true,
  status: "inactive",
  createdAt: 1,
  ...overrides,
});

test("isAutoStartProxyReady waits when a host saved proxy is unresolved", () => {
  assert.equal(
    isAutoStartProxyReady(
      host({ proxyProfileId: "missing-proxy" }),
      [],
      [],
      [],
    ),
    false,
  );
});

test("isAutoStartProxyReady waits when a missing host proxy has a group fallback", () => {
  const groupConfigs: GroupConfig[] = [{ path: "prod", proxyProfileId: "group-proxy" }];
  const currentHost = host({ group: "prod", proxyProfileId: "missing-proxy" });

  assert.equal(
    isAutoStartProxyReady(
      currentHost,
      [currentHost],
      [proxyProfile("group-proxy")],
      groupConfigs,
    ),
    false,
  );
});

test("isAutoStartProxyReady waits when a group saved proxy is unresolved", () => {
  const groupConfigs: GroupConfig[] = [{ path: "prod", proxyProfileId: "missing-proxy" }];
  const currentHost = host({ group: "prod" });

  assert.equal(
    isAutoStartProxyReady(
      currentHost,
      [currentHost],
      [],
      groupConfigs,
    ),
    false,
  );
});

test("isAutoStartProxyReady checks group-inherited jump hosts", () => {
  const currentHost = host({ group: "prod" });
  const jumpHost = host({ id: "jump-1", proxyProfileId: "missing-proxy" });

  assert.equal(
    isAutoStartProxyReady(
      currentHost,
      [currentHost, jumpHost],
      [],
      [{ path: "prod", hostChain: { hostIds: ["jump-1"] } }],
    ),
    false,
  );
});

test("getAutoStartRuleBlockReason only blocks the affected rule", () => {
  const goodHost = host();
  const badHost = host({ id: "host-2", proxyProfileId: "missing-proxy" });
  const hosts = [goodHost, badHost];
  const isHostAuthReady = () => true;

  assert.equal(
    getAutoStartRuleBlockReason(rule({ id: "good", hostId: "host-1" }), hosts, [], [], isHostAuthReady),
    undefined,
  );
  assert.equal(
    getAutoStartRuleBlockReason(rule({ id: "bad", hostId: "host-2" }), hosts, [], [], isHostAuthReady),
    "Proxy or jump host configuration is not ready",
  );
});

test("getAutoStartRuleBlockReason marks rules without a host", () => {
  assert.equal(
    getAutoStartRuleBlockReason(rule({ hostId: undefined }), [], [], [], () => true),
    "Rule host is not configured",
  );
});
