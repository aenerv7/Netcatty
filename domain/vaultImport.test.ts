import test from "node:test";
import assert from "node:assert/strict";

import { importVaultHostsFromText } from "./vaultImport.ts";

test("ssh_config import maps ForwardX11 yes to host X11 forwarding", () => {
  const result = importVaultHostsFromText("ssh_config", [
    "Host x11-host",
    "  HostName x11.example.com",
    "  User root",
    "  ForwardX11 yes",
  ].join("\n"));

  assert.equal(result.hosts.length, 1);
  assert.equal(result.hosts[0].x11Forwarding, true);
});

test("ssh_config import maps ForwardX11 no to disabled host X11 forwarding", () => {
  const result = importVaultHostsFromText("ssh_config", [
    "Host no-x11-host",
    "  HostName no-x11.example.com",
    "  User root",
    "  ForwardX11 no",
  ].join("\n"));

  assert.equal(result.hosts.length, 1);
  assert.equal(result.hosts[0].x11Forwarding, false);
});
