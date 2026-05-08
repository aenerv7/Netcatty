import test from "node:test";
import assert from "node:assert/strict";

import { buildSftpHostCredentials } from "./useSftpHostCredentials.ts";
import type { Host } from "../../../domain/models.ts";

const host = (overrides: Partial<Host> = {}): Host => ({
  id: "host-1",
  label: "Host",
  hostname: "example.com",
  username: "root",
  tags: [],
  os: "linux",
  ...overrides,
});

test("buildSftpHostCredentials rejects missing jump hosts", () => {
  assert.throws(
    () => buildSftpHostCredentials({
      host: host({ hostChain: { hostIds: ["missing-jump"] } }),
      hosts: [],
      keys: [],
      identities: [],
    }),
    /Jump host "missing-jump" is missing/,
  );
});

test("buildSftpHostCredentials rejects missing saved proxy profiles", () => {
  assert.throws(
    () => buildSftpHostCredentials({
      host: host({ proxyProfileId: "missing-proxy" }),
      hosts: [],
      keys: [],
      identities: [],
    }),
    /Saved proxy for host "Host" is missing/,
  );
});

test("buildSftpHostCredentials rejects missing saved proxy profiles on jump hosts", () => {
  const jumpHost = host({ id: "jump-1", label: "Jump", proxyProfileId: "missing-proxy" });

  assert.throws(
    () => buildSftpHostCredentials({
      host: host({ hostChain: { hostIds: ["jump-1"] } }),
      hosts: [jumpHost],
      keys: [],
      identities: [],
    }),
    /Saved proxy for jump host "Jump" is missing/,
  );
});
