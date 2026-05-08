import test from "node:test";
import assert from "node:assert/strict";

import type { GroupConfig, Host } from "../types.ts";
import { getHostTreeDisplayDetails } from "./HostTreeView.tsx";

const baseHost: Host = {
  id: "host-1",
  label: "Router",
  hostname: "router.example.com",
  username: "ssh-user",
  port: 2222,
  protocol: "telnet",
  tags: [],
  os: "linux",
  createdAt: 1,
};

test("HostTreeView display details include inherited telnet defaults", () => {
  const host: Host = {
    ...baseHost,
    group: "network",
    username: "ssh-user",
    port: 2222,
    telnetUsername: undefined,
    telnetPort: undefined,
  };
  const groupConfigs: GroupConfig[] = [{
    path: "network",
    telnetUsername: "group-telnet-user",
    telnetPort: 2325,
  }];

  assert.deepEqual(getHostTreeDisplayDetails(host, groupConfigs), {
    protocol: "telnet",
    username: "group-telnet-user",
    port: 2325,
  });
});

test("HostTreeView display details keep explicit cleared telnet username", () => {
  const host: Host = {
    ...baseHost,
    group: "network",
    telnetUsername: "",
  };
  const groupConfigs: GroupConfig[] = [{
    path: "network",
    telnetUsername: "group-telnet-user",
    telnetPort: 2325,
  }];

  assert.deepEqual(getHostTreeDisplayDetails(host, groupConfigs), {
    protocol: "telnet",
    username: "",
    port: 2325,
  });
});
