import test from "node:test";
import assert from "node:assert/strict";

import type { KnownHost } from "./models";
import { upsertKnownHost } from "./knownHosts";

const knownHost = (overrides: Partial<KnownHost> = {}): KnownHost => ({
  id: "kh-existing",
  hostname: "10.2.0.32",
  port: 22,
  keyType: "ssh-ed25519",
  publicKey: "ssh-ed25519 old-key",
  fingerprint: "old-fingerprint",
  discoveredAt: 100,
  ...overrides,
});

test("upsertKnownHost updates an existing host key instead of appending a duplicate", () => {
  const existing = knownHost({ convertedToHostId: "host-1" });
  const incoming = knownHost({
    id: "kh-new",
    publicKey: "ssh-ed25519 new-key",
    fingerprint: "new-fingerprint",
    discoveredAt: 200,
  });

  const result = upsertKnownHost([existing], incoming);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    ...existing,
    publicKey: "ssh-ed25519 new-key",
    fingerprint: "new-fingerprint",
    lastSeen: 200,
  });
});

test("upsertKnownHost updates by id even when the incoming key type is unknown", () => {
  const existing = knownHost({
    id: "kh-1",
    keyType: "ssh-ed25519",
    publicKey: "SHA256:old-key",
    fingerprint: "old-fingerprint",
    discoveredAt: 100,
  });
  const incoming = knownHost({
    id: "kh-1",
    keyType: "unknown",
    publicKey: undefined,
    fingerprint: "new-fingerprint",
    discoveredAt: 200,
  });

  const result = upsertKnownHost([existing], incoming);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "kh-1");
  assert.equal(result[0].keyType, "unknown");
  assert.equal(result[0].fingerprint, "new-fingerprint");
  assert.equal(result[0].lastSeen, 200);
});

test("upsertKnownHost prefers the matching id over an earlier selector match", () => {
  const duplicate = knownHost({
    id: "kh-duplicate",
    fingerprint: "duplicate-fingerprint",
    discoveredAt: 50,
  });
  const target = knownHost({
    id: "kh-target",
    fingerprint: "target-fingerprint",
    discoveredAt: 100,
  });
  const incoming = knownHost({
    id: "kh-target",
    fingerprint: "new-fingerprint",
    discoveredAt: 200,
  });

  const result = upsertKnownHost([duplicate, target], incoming);

  assert.equal(result.length, 2);
  assert.equal(result[0].fingerprint, "duplicate-fingerprint");
  assert.equal(result[1].id, "kh-target");
  assert.equal(result[1].fingerprint, "new-fingerprint");
});

test("upsertKnownHost appends genuinely new host keys", () => {
  const existing = knownHost();
  const incoming = knownHost({
    id: "kh-other",
    hostname: "10.2.0.33",
    fingerprint: "other-fingerprint",
  });

  const result = upsertKnownHost([existing], incoming);

  assert.deepEqual(result, [existing, incoming]);
});
