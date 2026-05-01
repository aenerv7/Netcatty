import test from "node:test";
import assert from "node:assert/strict";

import type { FigSpec } from "./autocomplete/figSpecLoader.ts";

type LocalStorageMock = {
  clear(): void;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type MockDirEntry = {
  name: string;
  type: "file" | "directory" | "symlink";
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
const storySpec: FigSpec = {
  name: "story",
  subcommands: [
    {
      name: "open",
      args: { template: "filepaths" },
    },
    {
      name: "pick",
      args: { name: "item", generators: {} },
    },
  ],
};
const bridgeState: { localEntries: MockDirEntry[] } = {
  localEntries: [],
};

Object.defineProperty(globalThis, "window", {
  value: {
    netcatty: {
      listFigSpecs: async () => ["story"],
      loadFigSpec: async (commandName: string) => commandName === "story" ? storySpec : null,
      listAutocompleteLocalDir: async (
        _path: string,
        foldersOnly: boolean,
        filterPrefix?: string,
        limit?: number,
      ) => {
        const prefix = (filterPrefix ?? "").toLowerCase();
        const entries = bridgeState.localEntries
          .filter((entry) => !foldersOnly || entry.type === "directory")
          .filter((entry) => !prefix || entry.name.toLowerCase().startsWith(prefix))
          .slice(0, limit ?? bridgeState.localEntries.length);
        return { success: true, entries };
      },
    },
  },
  configurable: true,
});

const { getCompletions } = await import("./autocomplete/completionEngine.ts");
const { clearHistory, recordCommand } = await import("./autocomplete/commandHistoryStore.ts");

test.beforeEach(() => {
  localStorage.clear();
  clearHistory();
  bridgeState.localEntries = [{ name: "package.json", type: "file" }];
});

test("getCompletions prioritizes spec-driven path suggestions over history", async () => {
  recordCommand("story open package-lock.json", "host-1");

  const completions = await getCompletions("story open pa", {
    hostId: "host-1",
    protocol: "local",
    cwd: "/repo",
  });

  assert.ok(completions.length > 0);
  assert.equal(completions[0]?.source, "path");
  assert.equal(completions[0]?.text, "story open package.json");

  const historyIndex = completions.findIndex((entry) =>
    entry.source === "history" && entry.text === "story open package-lock.json"
  );
  assert.ok(historyIndex > 0);
});

test("getCompletions does not treat generator-only spec args as path contexts", async () => {
  recordCommand("story pick package-choice", "host-1");

  const completions = await getCompletions("story pick pa", {
    hostId: "host-1",
    protocol: "local",
    cwd: "/repo",
  });

  assert.ok(completions.length > 0);
  assert.equal(completions[0]?.source, "history");
  assert.equal(completions[0]?.text, "story pick package-choice");
  assert.equal(completions.some((entry) => entry.source === "path"), false);
});
