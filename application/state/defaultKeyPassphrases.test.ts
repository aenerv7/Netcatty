import test from "node:test";
import assert from "node:assert/strict";
import {
  clearKeyPassphrasesByIds,
  clearReferenceKeyPassphrases,
  loadDefaultKeyPassphrase,
  rememberKeyPassphrase,
  shouldUpdateReferenceKeyPassphrase,
} from "../defaultKeyPassphrases";
import { STORAGE_KEY_DEFAULT_KEY_PASSPHRASES } from "../../infrastructure/config/storageKeys";
import type { SSHKey } from "../../domain/models";

function installLocalStorage(t: test.TestContext): void {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { netcatty: undefined },
  });

  t.after(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "window");
  });
}

const referenceKey = (): SSHKey => ({
  id: "reference-key",
  label: "id_ed25519",
  type: "ED25519",
  category: "key",
  source: "reference",
  filePath: "/Users/alice/.ssh/id_ed25519",
  privateKey: "",
  created: 1,
});

test("loadDefaultKeyPassphrase removes undecryptable credential placeholders", async (t) => {
  installLocalStorage(t);
  const keyPath = "/Users/alice/.ssh/id_ed25519";
  globalThis.localStorage.setItem(
    STORAGE_KEY_DEFAULT_KEY_PASSPHRASES,
    JSON.stringify({
      [keyPath]: "enc:v1:djEwYWJj",
      "/Users/alice/.ssh/id_rsa": "still-valid",
    }),
  );

  const result = await loadDefaultKeyPassphrase(keyPath);

  assert.equal(result, null);
  assert.deepEqual(
    JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY_DEFAULT_KEY_PASSPHRASES) ?? "{}"),
    { "/Users/alice/.ssh/id_rsa": "still-valid" },
  );
});

test("loadDefaultKeyPassphrase returns plain stored passphrases", async (t) => {
  installLocalStorage(t);
  const keyPath = "/Users/alice/.ssh/id_ed25519";
  globalThis.localStorage.setItem(
    STORAGE_KEY_DEFAULT_KEY_PASSPHRASES,
    JSON.stringify({ [keyPath]: "correct horse battery staple" }),
  );

  assert.equal(await loadDefaultKeyPassphrase(keyPath), "correct horse battery staple");
});

test("clearReferenceKeyPassphrases clears matching reference key paths only", () => {
  const keys: SSHKey[] = [
    {
      ...referenceKey(),
      passphrase: "bad",
      savePassphrase: true,
    },
    {
      ...referenceKey(),
      id: "other-key",
      label: "other",
      filePath: "/Users/alice/.ssh/other",
      passphrase: "keep",
      savePassphrase: true,
    },
  ];

  const updated = clearReferenceKeyPassphrases(keys, ["/Users/alice/.ssh/id_ed25519"]);

  assert.equal(updated[0].passphrase, undefined);
  assert.equal(updated[0].savePassphrase, false);
  assert.equal(updated[1].passphrase, "keep");
});

test("clearKeyPassphrasesByIds clears matching saved key passphrases", () => {
  const keys: SSHKey[] = [
    {
      ...referenceKey(),
      id: "inline-key",
      source: "imported",
      filePath: undefined,
      privateKey: "PRIVATE KEY",
      passphrase: "bad",
      savePassphrase: true,
    },
    {
      ...referenceKey(),
      id: "other-key",
      label: "other",
      passphrase: "keep",
      savePassphrase: true,
    },
  ];

  const updated = clearKeyPassphrasesByIds(keys, ["inline-key"]);

  assert.equal(updated[0].passphrase, undefined);
  assert.equal(updated[0].savePassphrase, false);
  assert.equal(updated[1].passphrase, "keep");
});

test("shouldUpdateReferenceKeyPassphrase replaces missing or undecryptable passphrases", () => {
  assert.equal(shouldUpdateReferenceKeyPassphrase(null), false);
  assert.equal(shouldUpdateReferenceKeyPassphrase(referenceKey()), true);
  assert.equal(
    shouldUpdateReferenceKeyPassphrase({
      ...referenceKey(),
      passphrase: "enc:v1:djEwAAAA",
    }),
    true,
  );
  assert.equal(
    shouldUpdateReferenceKeyPassphrase({
      ...referenceKey(),
      passphrase: "saved",
    }),
    false,
  );
});

test("rememberKeyPassphrase updates reference key state before completing", async (t) => {
  installLocalStorage(t);
  const keys = [referenceKey()];
  let currentKeys = keys;
  let releaseUpdate: (() => void) | undefined;
  let rememberPromise: Promise<void> | undefined;
  const updateStarted = new Promise<void>((resolve) => {
    const updateKeys = async (updated: SSHKey[]) => {
      assert.equal(currentKeys[0].passphrase, "saved");
      assert.equal(updated[0].passphrase, "saved");
      resolve();
      await new Promise<void>((release) => {
        releaseUpdate = release;
      });
    };

    rememberPromise = rememberKeyPassphrase({
      keyPath: "/Users/alice/.ssh/id_ed25519",
      passphrase: "saved",
      keys,
      updateKeys,
      setCurrentKeys: (updated) => {
        currentKeys = updated;
      },
    });
  });

  await updateStarted;
  assert.equal(currentKeys[0].passphrase, "saved");
  releaseUpdate?.();
  await rememberPromise;
});
