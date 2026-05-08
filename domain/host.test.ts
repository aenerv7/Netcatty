import test from "node:test";
import assert from "node:assert/strict";

import type { Host } from "./models.ts";
import {
  normalizePrimaryTelnetState,
  resolveTelnetPort,
  resolveTelnetPassword,
  resolveTelnetUsername,
  upsertHostById,
} from "./host.ts";

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

test("telnet credential helpers preserve explicitly cleared values", () => {
  const host = makeHost({
    username: "ssh-user",
    password: "ssh-password",
    telnetUsername: "",
    telnetPassword: "",
  });

  assert.equal(resolveTelnetUsername(host), "");
  assert.equal(resolveTelnetPassword(host), "");
});

test("telnet credential helpers fall back only when telnet fields are unset", () => {
  const host = makeHost({
    username: " ssh-user ",
    password: "ssh-password",
    telnetUsername: undefined,
    telnetPassword: undefined,
  });

  assert.equal(resolveTelnetUsername(host), "ssh-user");
  assert.equal(resolveTelnetPassword(host), "ssh-password");
});

test("normalizePrimaryTelnetState enables primary telnet without materializing a port", () => {
  const result = normalizePrimaryTelnetState(makeHost({
    protocol: "telnet",
    telnetEnabled: false,
    telnetPort: undefined,
    port: undefined,
  }));

  assert.equal(result.telnetEnabled, true);
  assert.equal(result.telnetPort, undefined);
  assert.equal(result.port, undefined);
});

test("normalizePrimaryTelnetState leaves optional telnet hosts unchanged", () => {
  const result = normalizePrimaryTelnetState(makeHost({
    protocol: "ssh",
    telnetEnabled: false,
    telnetPort: undefined,
  }));

  assert.equal(result.telnetEnabled, false);
  assert.equal(result.telnetPort, undefined);
});

test("normalizePrimaryTelnetState preserves an explicit telnet port", () => {
  const result = normalizePrimaryTelnetState(makeHost({
    protocol: "telnet",
    telnetEnabled: false,
    telnetPort: 2325,
  }));

  assert.equal(result.telnetEnabled, true);
  assert.equal(result.telnetPort, 2325);
});

test("resolveTelnetPort ignores ssh ports for optional telnet", () => {
  assert.equal(resolveTelnetPort(makeHost({
    protocol: "ssh",
    port: 2222,
    telnetPort: undefined,
  })), 23);
});

test("resolveTelnetPort uses primary telnet port fallback", () => {
  assert.equal(resolveTelnetPort(makeHost({
    protocol: "telnet",
    port: 2325,
    telnetPort: undefined,
  })), 2325);
});
