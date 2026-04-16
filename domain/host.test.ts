import test from "node:test";
import assert from "node:assert/strict";

import type { Host } from "./models.ts";
import { upsertHostById } from "./host.ts";

const makeHost = (overrides: Partial<Host> = {}): Host => ({
  id: "host-1",
  label: "Primary Host",
  hostname: "127.0.0.1",
  port: 22,
  username: "root",
  authType: "password",
  createdAt: 1,
  protocol: "ssh",
  ...overrides,
});

test("upsertHostById updates an existing host in place", () => {
  const existing = makeHost();
  const updated = makeHost({ label: "Updated Host" });

  assert.deepEqual(upsertHostById([existing], updated), [updated]);
});

test("upsertHostById appends a duplicated host with a fresh id", () => {
  const existing = makeHost({
    id: "serial-original",
    label: "Serial Config",
    protocol: "serial",
    hostname: "/dev/ttyUSB0",
    port: 115200,
    serialConfig: {
      path: "/dev/ttyUSB0",
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      flowControl: "none",
      localEcho: false,
      lineMode: false,
    },
  });
  const duplicate = makeHost({
    ...existing,
    id: "serial-duplicate",
    label: "Serial Config (copy)",
  });

  assert.deepEqual(upsertHostById([existing], duplicate), [existing, duplicate]);
});
