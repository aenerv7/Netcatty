import test from "node:test";
import assert from "node:assert/strict";

import type { SyncPayload } from "../domain/sync.ts";
import type { KnownHost } from "../domain/models.ts";
import type { SyncableVaultData } from "./syncPayload.ts";

type LocalStorageMock = {
  clear(): void;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function installLocalStorage(): LocalStorageMock {
  const store = new Map<string, string>();
  const localStorage: LocalStorageMock = {
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorage,
    configurable: true,
  });
  return localStorage;
}

const localStorage = installLocalStorage();
const {
  applyLocalVaultPayload,
  applySyncPayload,
  buildLocalVaultPayload,
  buildSyncPayload,
  hasMeaningfulCloudSyncData,
} = await import("./syncPayload.ts");

const knownHost = (id = "kh-1"): KnownHost => ({
  id,
  hostname: `${id}.example.com`,
  port: 22,
  keyType: "ssh-ed25519",
  publicKey: `SHA256:${id}`,
  discoveredAt: 1,
});

const vault = (knownHosts: KnownHost[] = [knownHost()]): SyncableVaultData => ({
  hosts: [],
  keys: [],
  identities: [],
  snippets: [],
  customGroups: [],
  snippetPackages: [],
  knownHosts,
  groupConfigs: [],
});

test.beforeEach(() => {
  localStorage.clear();
});

test("buildSyncPayload treats known hosts as local-only data", () => {
  const payload = buildSyncPayload(vault([knownHost("kh-cloud")]));

  assert.equal("knownHosts" in payload, false);
});

test("buildSyncPayload includes reusable proxy profiles", () => {
  const proxyProfiles = [
    {
      id: "proxy-1",
      label: "Office Proxy",
      config: { type: "socks5", host: "proxy.example.com", port: 1080 },
      createdAt: 1,
      updatedAt: 1,
    },
  ];

  const payload = buildSyncPayload({
    ...vault(),
    proxyProfiles,
  } as SyncableVaultData & { proxyProfiles: typeof proxyProfiles });

  assert.deepEqual(payload.proxyProfiles, proxyProfiles);
});

test("hasMeaningfulCloudSyncData ignores legacy cloud known hosts", () => {
  assert.equal(
    hasMeaningfulCloudSyncData({
      hosts: [],
      keys: [],
      identities: [],
      snippets: [],
      customGroups: [],
      knownHosts: [knownHost("kh-only")],
      syncedAt: 1,
    }),
    false,
  );
});

test("buildLocalVaultPayload preserves known hosts for local backups", () => {
  const payload = buildLocalVaultPayload(vault([knownHost("kh-local")]));

  assert.deepEqual(payload.knownHosts, [knownHost("kh-local")]);
});

test("applySyncPayload ignores legacy cloud known hosts", async () => {
  let imported: Record<string, unknown> | null = null;
  const proxyProfiles = [
    {
      id: "proxy-1",
      label: "Office Proxy",
      config: { type: "socks5", host: "proxy.example.com", port: 1080 },
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  const payload: SyncPayload = {
    hosts: [],
    keys: [],
    identities: [],
    snippets: [],
    customGroups: [],
    knownHosts: [knownHost("kh-legacy")],
    proxyProfiles,
    syncedAt: 1,
  } as SyncPayload & { proxyProfiles: typeof proxyProfiles };

  await applySyncPayload(payload, {
    importVaultData: (json) => {
      imported = JSON.parse(json);
    },
  });

  assert.ok(imported);
  assert.equal("knownHosts" in imported, false);
  assert.deepEqual(imported.proxyProfiles, proxyProfiles);
});

test("applySyncPayload keeps missing proxy references visible to connection guards", async () => {
  let imported: Record<string, unknown> | null = null;
  const payload: SyncPayload = {
    hosts: [{
      id: "host-1",
      label: "Host",
      hostname: "example.com",
      username: "root",
      tags: [],
      os: "linux",
      proxyProfileId: "missing-proxy",
    }],
    keys: [],
    identities: [],
    proxyProfiles: [],
    snippets: [],
    customGroups: [],
    groupConfigs: [{ path: "prod", proxyProfileId: "missing-proxy" }],
    syncedAt: 1,
  };

  await applySyncPayload(payload, {
    importVaultData: (json) => {
      imported = JSON.parse(json);
    },
  });

  assert.ok(imported);
  assert.equal((imported.hosts as SyncPayload["hosts"])[0]?.proxyProfileId, "missing-proxy");
  assert.equal((imported.groupConfigs as SyncPayload["groupConfigs"])?.[0]?.proxyProfileId, "missing-proxy");
});

test("applySyncPayload preserves host proxy references when group configs are absent", async () => {
  let imported: Record<string, unknown> | null = null;
  const payload: SyncPayload = {
    hosts: [{
      id: "host-1",
      label: "Host",
      hostname: "example.com",
      username: "root",
      tags: [],
      os: "linux",
      proxyProfileId: "missing-proxy",
    }],
    keys: [],
    identities: [],
    proxyProfiles: [],
    snippets: [],
    customGroups: [],
    syncedAt: 1,
  };

  await applySyncPayload(payload, {
    importVaultData: (json) => {
      imported = JSON.parse(json);
    },
  });

  assert.ok(imported);
  assert.equal((imported.hosts as SyncPayload["hosts"])[0]?.proxyProfileId, "missing-proxy");
  assert.equal("groupConfigs" in imported, false);
});

test("applySyncPayload waits for async vault imports", async () => {
  let finished = false;
  const payload: SyncPayload = {
    hosts: [],
    keys: [],
    identities: [],
    snippets: [],
    customGroups: [],
    syncedAt: 1,
  };

  const promise = applySyncPayload(payload, {
    importVaultData: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      finished = true;
    },
  });

  assert.equal(finished, false);
  await promise;
  assert.equal(finished, true);
});

test("applyLocalVaultPayload restores known hosts from local backups", async () => {
  let imported: Record<string, unknown> | null = null;
  const payload: SyncPayload = {
    hosts: [],
    keys: [],
    identities: [],
    snippets: [],
    customGroups: [],
    knownHosts: [knownHost("kh-backup")],
    syncedAt: 1,
  };

  await applyLocalVaultPayload(payload, {
    importVaultData: (json) => {
      imported = JSON.parse(json);
    },
  });

  assert.ok(imported);
  assert.deepEqual(imported.knownHosts, [knownHost("kh-backup")]);
});
