import test from "node:test";
import assert from "node:assert/strict";

import { resolveBridgeKeyAuth, resolveHostAuth } from "./sshAuth.ts";
import type { Host, SSHKey } from "./models.ts";

const referenceKey: SSHKey = {
  id: "key-1",
  label: "Reference key",
  type: "ED25519",
  privateKey: "",
  source: "reference",
  category: "key",
  created: 1,
  filePath: "/Users/alice/.ssh/id_ed25519",
};

test("resolveBridgeKeyAuth passes reference keys as identity file paths", () => {
  assert.deepEqual(
    resolveBridgeKeyAuth({
      key: referenceKey,
      fallbackIdentityFilePaths: ["/legacy/key"],
      passphrase: "saved-passphrase",
    }),
    {
      privateKey: undefined,
      identityFilePaths: ["/Users/alice/.ssh/id_ed25519"],
      passphrase: "saved-passphrase",
    },
  );
});

test("resolveBridgeKeyAuth ignores undecryptable passphrase placeholders", () => {
  assert.equal(
    resolveBridgeKeyAuth({
      key: {
        ...referenceKey,
        passphrase: "enc:v1:djEwAAAA",
      },
    }).passphrase,
    undefined,
  );
});

test("resolveBridgeKeyAuth ignores undecryptable private key placeholders", () => {
  assert.equal(
    resolveBridgeKeyAuth({
      key: {
        ...referenceKey,
        source: "imported",
        filePath: undefined,
        privateKey: "enc:v1:djEwAAAA",
      },
    }).privateKey,
    undefined,
  );
});

test("resolveBridgeKeyAuth preserves imported key material", () => {
  const importedKey: SSHKey = {
    ...referenceKey,
    source: "imported",
    privateKey: "PRIVATE KEY",
    filePath: undefined,
  };

  assert.deepEqual(
    resolveBridgeKeyAuth({
      key: importedKey,
      fallbackIdentityFilePaths: ["/legacy/key"],
    }),
    {
      privateKey: "PRIVATE KEY",
      identityFilePaths: ["/legacy/key"],
      passphrase: undefined,
    },
  );
});

test("resolveHostAuth respects password auth over stale key selections", () => {
  const host: Host = {
    id: "host-1",
    label: "Host",
    hostname: "example.com",
    username: "root",
    authMethod: "password",
    identityFileId: "key-1",
  };

  const resolved = resolveHostAuth({
    host,
    keys: [referenceKey],
    identities: [],
  });

  assert.equal(resolved.authMethod, "password");
  assert.equal(resolved.key, undefined);
  assert.equal(resolved.keyId, undefined);
});
