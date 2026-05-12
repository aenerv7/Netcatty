const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const Module = require("node:module");

const passphraseHandler = require("./passphraseHandler.cjs");

function loadSftpBridgeWithProxySocket(proxySocket, overrides = {}) {
  const bridgePath = require.resolve("./sftpBridge.cjs");
  delete require.cache[bridgePath];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "./proxyUtils.cjs") {
      return {
        createProxySocket: async () => proxySocket,
      };
    }
    if (request === "ssh2" && overrides.SSHClient) {
      const ssh2 = originalLoad.call(this, request, parent, isMain);
      return {
        ...ssh2,
        Client: overrides.SSHClient,
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require("./sftpBridge.cjs");
  } finally {
    Module._load = originalLoad;
  }
}

class FailingSshClient extends EventEmitter {
  constructor() {
    super();
    this.ended = false;
    FailingSshClient.instances.push(this);
  }

  connect() {
    queueMicrotask(() => {
      const err = new Error("jump connect failed");
      err.level = "client-socket";
      this.emit("error", err);
    });
  }

  end() {
    this.ended = true;
  }

  forwardOut() {
    throw new Error("forwardOut should not be called");
  }
}
FailingSshClient.instances = [];

function createSender() {
  return {
    id: 1,
    isDestroyed: () => false,
    send: () => {},
  };
}

test("openSftp cleans an opened proxy socket when target key passphrase is cancelled", async (t) => {
  const originalRequestPassphrase = passphraseHandler.requestPassphrase;
  t.after(() => {
    passphraseHandler.requestPassphrase = originalRequestPassphrase;
  });
  passphraseHandler.requestPassphrase = async () => ({ cancelled: true });

  const proxySocket = {
    ended: false,
    destroyed: false,
    end() {
      this.ended = true;
    },
    destroy() {
      this.destroyed = true;
    },
  };
  const bridge = loadSftpBridgeWithProxySocket(proxySocket);

  await assert.rejects(
    bridge.openSftp(
      { sender: createSender() },
      {
        sessionId: "sftp-cleanup-test",
        hostname: "target.example",
        port: 22,
        username: "alice",
        proxy: {
          type: "socks5",
          host: "proxy.example",
          port: 1080,
        },
        privateKey: "-----BEGIN ENCRYPTED PRIVATE KEY-----\nkey\n-----END ENCRYPTED PRIVATE KEY-----",
        keyId: "target-key",
      },
    ),
    /Passphrase entry cancelled/,
  );

  assert.equal(proxySocket.ended, true);
  assert.equal(proxySocket.destroyed, true);
});

test("openSftp cleans a jump proxy socket when the first jump connection fails", async () => {
  FailingSshClient.instances = [];
  const proxySocket = {
    ended: false,
    destroyed: false,
    end() {
      this.ended = true;
    },
    destroy() {
      this.destroyed = true;
    },
  };
  const bridge = loadSftpBridgeWithProxySocket(proxySocket, {
    SSHClient: FailingSshClient,
  });

  await assert.rejects(
    bridge.openSftp(
      { sender: createSender() },
      {
        sessionId: "sftp-jump-cleanup-test",
        hostname: "target.example",
        port: 22,
        username: "alice",
        jumpHosts: [
          {
            hostname: "jump.example",
            port: 22,
            username: "jump",
            proxy: {
              type: "socks5",
              host: "proxy.example",
              port: 1080,
            },
          },
        ],
      },
    ),
    /jump connect failed/,
  );

  assert.equal(proxySocket.ended, true);
  assert.equal(proxySocket.destroyed, true);
  assert.equal(FailingSshClient.instances[0]?.ended, true);
});
