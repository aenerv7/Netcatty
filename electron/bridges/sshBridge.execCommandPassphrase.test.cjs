const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const Module = require("node:module");

const passphraseHandler = require("./passphraseHandler.cjs");

function loadBridgeWithMockedSsh2(t) {
  const bridgePath = require.resolve("./sshBridge.cjs");
  const authHelperPath = require.resolve("./sshAuthHelper.cjs");
  const originalLoad = Module._load;
  let connectCount = 0;

  class MockSSHClient extends EventEmitter {
    connect() {
      connectCount += 1;
      this.emit("error", new Error("unexpected connect"));
    }

    end() {}

    exec() {}
  }

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "ssh2") {
      return {
        Client: MockSSHClient,
        utils: {
          parseKey: () => new Error("bad passphrase"),
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[bridgePath];
  delete require.cache[authHelperPath];
  const bridge = require("./sshBridge.cjs");

  t.after(() => {
    delete require.cache[bridgePath];
    delete require.cache[authHelperPath];
    Module._load = originalLoad;
  });

  return {
    bridge,
    getConnectCount: () => connectCount,
  };
}

function createEncryptedIdentityFile(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "netcatty-ssh-exec-"));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const keyPath = path.join(dir, "id_ed25519");
  fs.writeFileSync(
    keyPath,
    "-----BEGIN ENCRYPTED PRIVATE KEY-----\nabc\n-----END ENCRYPTED PRIVATE KEY-----\n",
    "utf8",
  );
  return keyPath;
}

test("execCommand stops when an identity file passphrase prompt is cancelled", async (t) => {
  const keyPath = createEncryptedIdentityFile(t);
  const originalRequestPassphrase = passphraseHandler.requestPassphrase;
  t.after(() => {
    passphraseHandler.requestPassphrase = originalRequestPassphrase;
  });
  passphraseHandler.requestPassphrase = async () => ({ cancelled: true });

  const { bridge, getConnectCount } = loadBridgeWithMockedSsh2(t);
  const ipcMain = {
    handlers: new Map(),
    handle(channel, handler) {
      this.handlers.set(channel, handler);
    },
  };
  bridge.registerHandlers(ipcMain);
  const execHandler = ipcMain.handlers.get("netcatty:ssh:exec");

  await assert.rejects(
    () => execHandler(
      {
        sender: {
          isDestroyed: () => false,
          send: () => {},
        },
      },
      {
        hostname: "example.test",
        username: "alice",
        command: "true",
        identityFilePaths: [keyPath],
        timeout: 100,
      },
    ),
    /Passphrase entry cancelled/,
  );
  assert.equal(getConnectCount(), 0);
});
