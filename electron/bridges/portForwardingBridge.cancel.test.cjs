const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const passphraseHandler = require("./passphraseHandler.cjs");
const {
  startPortForward,
  stopPortForward,
  stopPortForwardByRuleId,
  getPortForwardStatus,
} = require("./portForwardingBridge.cjs");

function createEncryptedKey(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "netcatty-port-forward-"));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const keyPath = path.join(dir, "id_ed25519");
  const result = spawnSync("ssh-keygen", [
    "-q",
    "-t",
    "ed25519",
    "-N",
    "secret",
    "-f",
    keyPath,
    "-C",
    "netcatty-test",
  ], { encoding: "utf8" });

  if (result.status !== 0) {
    t.skip("ssh-keygen is unavailable");
    return null;
  }

  return keyPath;
}

function createSender() {
  return createCapturingSender();
}

function createCapturingSender(onSend = () => {}) {
  return {
    id: 1,
    isDestroyed: () => false,
    send: (channel, payload) => onSend(channel, payload),
  };
}

test("port forwarding can be stopped while waiting for a key passphrase", async (t) => {
  const keyPath = createEncryptedKey(t);
  if (!keyPath) return;
  const privateKey = fs.readFileSync(keyPath, "utf8");

  const sent = [];
  let passphraseRequest;
  const promptStarted = new Promise((resolve) => {
    passphraseRequest = resolve;
  });

  const tunnelId = "pf-rule-cancel-1";
  const event = {
    sender: createCapturingSender((channel, payload) => {
      sent.push({ channel, payload });
      if (channel === "netcatty:passphrase-request") {
        passphraseRequest(payload);
      }
    }),
  };
  const startPromise = startPortForward(event, {
    tunnelId,
    type: "local",
    localPort: 0,
    bindAddress: "127.0.0.1",
    remoteHost: "127.0.0.1",
    remotePort: 80,
    hostname: "example.test",
    username: "alice",
    privateKey,
    keyId: "key-1",
  });

  const request = await promptStarted;
  assert.deepEqual(await getPortForwardStatus(event, { tunnelId }), {
    tunnelId,
    status: "connecting",
    type: "local",
  });

  assert.deepEqual(await stopPortForward(event, { tunnelId }), {
    tunnelId,
    success: true,
  });
  assert.deepEqual(await getPortForwardStatus(event, { tunnelId }), {
    tunnelId,
    status: "inactive",
  });

  assert.deepEqual(await startPromise, {
    tunnelId,
    success: false,
    cancelled: true,
  });
  assert.ok(sent.some((event) =>
    event.channel === "netcatty:passphrase-cancelled" &&
    event.payload.requestId === request.requestId
  ));
  assert.deepEqual(await getPortForwardStatus(event, { tunnelId }), {
    tunnelId,
    status: "inactive",
  });
});

test("port forwarding stops when the key passphrase prompt is cancelled", async (t) => {
  const keyPath = createEncryptedKey(t);
  if (!keyPath) return;
  const privateKey = fs.readFileSync(keyPath, "utf8");

  const originalRequestPassphrase = passphraseHandler.requestPassphrase;
  t.after(() => {
    passphraseHandler.requestPassphrase = originalRequestPassphrase;
  });
  passphraseHandler.requestPassphrase = async () => ({ cancelled: true });

  const tunnelId = "pf-rule-cancel-2";
  const event = { sender: createSender() };
  const result = await startPortForward(event, {
    tunnelId,
    type: "local",
    localPort: 0,
    bindAddress: "127.0.0.1",
    remoteHost: "127.0.0.1",
    remotePort: 80,
    hostname: "example.test",
    username: "alice",
    privateKey,
    keyId: "key-1",
  });

  assert.deepEqual(result, {
    tunnelId,
    success: false,
    cancelled: true,
  });
  assert.deepEqual(await getPortForwardStatus(event, { tunnelId }), {
    tunnelId,
    status: "inactive",
  });
});

test("stop by rule id only cancels the matching passphrase prompt", async (t) => {
  const keyPath = createEncryptedKey(t);
  if (!keyPath) return;
  const privateKey = fs.readFileSync(keyPath, "utf8");

  const sent = [];
  const requests = [];
  let resolveBothPrompts;
  const bothPromptsStarted = new Promise((resolve) => {
    resolveBothPrompts = resolve;
  });
  const event = {
    sender: createCapturingSender((channel, payload) => {
      sent.push({ channel, payload });
      if (channel === "netcatty:passphrase-request") {
        requests.push(payload);
        if (requests.length === 2) {
          resolveBothPrompts();
        }
      }
    }),
  };

  const firstTunnelId = "pf-rule-1";
  const secondTunnelId = "pf-rule-long-1";
  const firstStart = startPortForward(event, {
    ruleId: "rule",
    tunnelId: firstTunnelId,
    type: "local",
    localPort: 0,
    bindAddress: "127.0.0.1",
    remoteHost: "127.0.0.1",
    remotePort: 80,
    hostname: "first.example",
    username: "alice",
    privateKey,
    keyId: "key-1",
  });
  const secondStart = startPortForward(event, {
    ruleId: "rule-long",
    tunnelId: secondTunnelId,
    type: "local",
    localPort: 0,
    bindAddress: "127.0.0.1",
    remoteHost: "127.0.0.1",
    remotePort: 80,
    hostname: "second.example",
    username: "alice",
    privateKey,
    keyId: "key-2",
  });

  await bothPromptsStarted;
  const firstRequest = requests.find((request) => request.hostname === "first.example");
  const secondRequest = requests.find((request) => request.hostname === "second.example");
  assert.ok(firstRequest);
  assert.ok(secondRequest);

  assert.deepEqual(stopPortForwardByRuleId(event, { ruleId: "rule" }), { stopped: 1 });
  assert.deepEqual(await firstStart, {
    tunnelId: firstTunnelId,
    success: false,
    cancelled: true,
  });
  assert.ok(sent.some((event) =>
    event.channel === "netcatty:passphrase-cancelled" &&
    event.payload.requestId === firstRequest.requestId
  ));
  assert.equal(sent.some((event) =>
    event.channel === "netcatty:passphrase-cancelled" &&
    event.payload.requestId === secondRequest.requestId
  ), false);
  assert.deepEqual(await getPortForwardStatus(event, { tunnelId: secondTunnelId }), {
    tunnelId: secondTunnelId,
    status: "connecting",
    type: "local",
  });

  assert.deepEqual(await stopPortForward(event, { tunnelId: secondTunnelId }), {
    tunnelId: secondTunnelId,
    success: true,
  });
  assert.deepEqual(await secondStart, {
    tunnelId: secondTunnelId,
    success: false,
    cancelled: true,
  });
});
