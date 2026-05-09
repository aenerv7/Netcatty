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
const storageKeys = await import("../infrastructure/config/storageKeys.ts");

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

test("buildSyncPayload includes AI configuration settings", () => {
  const providers = [{
    id: "openai-main",
    providerId: "openai",
    name: "OpenAI",
    apiKey: "enc:v1:test",
    defaultModel: "gpt-test",
    enabled: true,
  }];
  const externalAgents = [{
    id: "codex",
    name: "Codex",
    command: "codex",
    enabled: true,
    acpCommand: "codex-acp",
  }];
  const webSearch = {
    providerId: "tavily",
    apiKey: "enc:v1:web",
    enabled: true,
    maxResults: 7,
  };

  localStorage.setItem(storageKeys.STORAGE_KEY_AI_PROVIDERS, JSON.stringify(providers));
  localStorage.setItem(storageKeys.STORAGE_KEY_AI_ACTIVE_PROVIDER, "openai-main");
  localStorage.setItem(storageKeys.STORAGE_KEY_AI_ACTIVE_MODEL, "gpt-test");
  localStorage.setItem(storageKeys.STORAGE_KEY_AI_PERMISSION_MODE, "autonomous");
  localStorage.setItem(storageKeys.STORAGE_KEY_AI_TOOL_INTEGRATION_MODE, "skills");
  localStorage.setItem(storageKeys.STORAGE_KEY_AI_EXTERNAL_AGENTS, JSON.stringify(externalAgents));
  localStorage.setItem(storageKeys.STORAGE_KEY_AI_DEFAULT_AGENT, "codex");
  localStorage.setItem(storageKeys.STORAGE_KEY_AI_COMMAND_BLOCKLIST, JSON.stringify(["rm -rf"]));
  localStorage.setItem(storageKeys.STORAGE_KEY_AI_COMMAND_TIMEOUT, "120");
  localStorage.setItem(storageKeys.STORAGE_KEY_AI_MAX_ITERATIONS, "10");
  localStorage.setItem(storageKeys.STORAGE_KEY_AI_AGENT_MODEL_MAP, JSON.stringify({ codex: "gpt-test" }));
  localStorage.setItem(storageKeys.STORAGE_KEY_AI_WEB_SEARCH, JSON.stringify(webSearch));

  const payload = buildSyncPayload(vault([]));

  assert.deepEqual(payload.settings?.ai, {
    providers,
    activeProviderId: "openai-main",
    activeModelId: "gpt-test",
    globalPermissionMode: "autonomous",
    toolIntegrationMode: "skills",
    externalAgents,
    defaultAgentId: "codex",
    commandBlocklist: ["rm -rf"],
    commandTimeout: 120,
    maxIterations: 10,
    agentModelMap: { codex: "gpt-test" },
    webSearchConfig: webSearch,
  });
});

test("buildSyncPayload omits device-bound encrypted AI API keys", () => {
  localStorage.setItem(storageKeys.STORAGE_KEY_AI_PROVIDERS, JSON.stringify([{
    id: "openai-main",
    providerId: "openai",
    name: "OpenAI",
    apiKey: "enc:v1:djEwAAAA",
    enabled: true,
  }]));
  localStorage.setItem(storageKeys.STORAGE_KEY_AI_WEB_SEARCH, JSON.stringify({
    providerId: "tavily",
    apiKey: "enc:v1:djEwAAAA",
    enabled: true,
  }));

  const payload = buildSyncPayload(vault([]));

  assert.equal("apiKey" in (payload.settings?.ai?.providers?.[0] ?? {}), false);
  assert.equal("apiKey" in (payload.settings?.ai?.webSearchConfig ?? {}), false);
});

test("applySyncPayload restores AI configuration settings", async () => {
  const providers = [{
    id: "anthropic-main",
    providerId: "anthropic",
    name: "Anthropic",
    apiKey: "enc:v1:test",
    enabled: true,
  }];
  const externalAgents = [{
    id: "claude",
    name: "Claude",
    command: "claude",
    enabled: true,
  }];
  const webSearch = {
    providerId: "exa",
    apiKey: "enc:v1:web",
    enabled: true,
  };

  const payload: SyncPayload = {
    hosts: [],
    keys: [],
    identities: [],
    snippets: [],
    customGroups: [],
    settings: {
      ai: {
        providers,
        activeProviderId: "anthropic-main",
        activeModelId: "claude-test",
        globalPermissionMode: "observer",
        toolIntegrationMode: "mcp",
        externalAgents,
        defaultAgentId: "claude",
        commandBlocklist: ["shutdown"],
        commandTimeout: 30,
        maxIterations: 5,
        agentModelMap: { claude: "claude-test" },
        webSearchConfig: webSearch,
      },
    },
    syncedAt: 1,
  } as SyncPayload;

  await applySyncPayload(payload, { importVaultData: () => {} });

  assert.deepEqual(JSON.parse(localStorage.getItem(storageKeys.STORAGE_KEY_AI_PROVIDERS)!), providers);
  assert.equal(localStorage.getItem(storageKeys.STORAGE_KEY_AI_ACTIVE_PROVIDER), "anthropic-main");
  assert.equal(localStorage.getItem(storageKeys.STORAGE_KEY_AI_ACTIVE_MODEL), "claude-test");
  assert.equal(localStorage.getItem(storageKeys.STORAGE_KEY_AI_PERMISSION_MODE), "observer");
  assert.equal(localStorage.getItem(storageKeys.STORAGE_KEY_AI_TOOL_INTEGRATION_MODE), "mcp");
  assert.deepEqual(JSON.parse(localStorage.getItem(storageKeys.STORAGE_KEY_AI_EXTERNAL_AGENTS)!), externalAgents);
  assert.equal(localStorage.getItem(storageKeys.STORAGE_KEY_AI_DEFAULT_AGENT), "claude");
  assert.deepEqual(JSON.parse(localStorage.getItem(storageKeys.STORAGE_KEY_AI_COMMAND_BLOCKLIST)!), ["shutdown"]);
  assert.equal(localStorage.getItem(storageKeys.STORAGE_KEY_AI_COMMAND_TIMEOUT), "30");
  assert.equal(localStorage.getItem(storageKeys.STORAGE_KEY_AI_MAX_ITERATIONS), "5");
  assert.deepEqual(JSON.parse(localStorage.getItem(storageKeys.STORAGE_KEY_AI_AGENT_MODEL_MAP)!), { claude: "claude-test" });
  assert.deepEqual(JSON.parse(localStorage.getItem(storageKeys.STORAGE_KEY_AI_WEB_SEARCH)!), webSearch);
});

test("buildSyncPayload includes syncable terminal options from settings", () => {
  localStorage.setItem(storageKeys.STORAGE_KEY_TERM_FOLLOW_APP_THEME, "true");
  localStorage.setItem(storageKeys.STORAGE_KEY_TERM_SETTINGS, JSON.stringify({
    terminalEmulationType: "vt100",
    altAsMeta: true,
    showServerStats: false,
    serverStatsRefreshInterval: 12,
    rendererType: "dom",
    localShell: "/bin/zsh",
  }));

  const payload = buildSyncPayload(vault([]));

  assert.equal(payload.settings?.followAppTerminalTheme, true);
  assert.deepEqual(payload.settings?.terminalSettings, {
    terminalEmulationType: "vt100",
    altAsMeta: true,
    showServerStats: false,
    serverStatsRefreshInterval: 12,
    rendererType: "dom",
  });
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
