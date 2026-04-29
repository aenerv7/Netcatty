import test from "node:test";
import assert from "node:assert/strict";

import type { Host } from "./models.ts";
import { serializeHostsToSshConfig } from "./sshConfigSerializer.ts";

const makeHost = (overrides: Partial<Host> = {}): Host => ({
  id: "host-1",
  label: "X11 Host",
  hostname: "x11.example.com",
  username: "root",
  port: 22,
  protocol: "ssh",
  os: "linux",
  tags: [],
  ...overrides,
});

test("serializeHostsToSshConfig writes ForwardX11 for hosts with X11 forwarding enabled", () => {
  const config = serializeHostsToSshConfig([makeHost({ x11Forwarding: true })]);

  assert.match(config, /ForwardX11 yes/);
});

test("serializeHostsToSshConfig omits ForwardX11 when X11 forwarding is disabled", () => {
  const config = serializeHostsToSshConfig([makeHost({ x11Forwarding: false })]);

  assert.doesNotMatch(config, /ForwardX11/);
});

test("serializeHostsToSshConfig omits ForwardX11 for mosh hosts", () => {
  const config = serializeHostsToSshConfig([makeHost({ moshEnabled: true, x11Forwarding: true })]);

  assert.doesNotMatch(config, /ForwardX11/);
});
