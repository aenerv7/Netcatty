import test from "node:test";
import assert from "node:assert/strict";

import { createTerminalSessionStarters, getMissingChainHostIds } from "./createTerminalSessionStarters";

const noop = () => undefined;
const ENCRYPTED_CREDENTIAL_PLACEHOLDER = "enc:v1:djEwAAAA";

test("getMissingChainHostIds reports unresolved jump hosts", () => {
  assert.deepEqual(
    getMissingChainHostIds(
      {
        id: "host-1",
        label: "Example",
        hostname: "example.test",
        username: "alice",
        hostChain: { hostIds: ["jump-1", "jump-2"] },
      } as never,
      [{ id: "jump-1" }] as never,
    ),
    ["jump-2"],
  );
});

test("startSSH allows jump hosts that use reference key files with unavailable saved passphrases", async () => {
  let capturedOptions: Record<string, unknown> | null = null;
  let error = "";

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "ssh-session";
    },
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Target",
      hostname: "target.example.test",
      username: "alice",
      hostChain: { hostIds: ["jump-1"] },
      port: 2200,
    },
    keys: [{
      id: "jump-key",
      label: "Jump key",
      source: "reference",
      privateKey: "",
      filePath: "/Users/alice/.ssh/id_ed25519",
      passphrase: ENCRYPTED_CREDENTIAL_PLACEHOLDER,
    }],
    resolvedChainHosts: [{
      id: "jump-1",
      label: "Jump",
      hostname: "jump.example.test",
      username: "jumper",
      authMethod: "key",
      identityFileId: "jump-key",
    }],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: (message: string) => { error = message; },
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startSSH(term as never);

  assert.equal(error, "");
  assert.ok(capturedOptions);
  const jumpHosts = capturedOptions.jumpHosts as Array<Record<string, unknown>>;
  assert.deepEqual(jumpHosts[0]?.identityFilePaths, ["/Users/alice/.ssh/id_ed25519"]);
  assert.equal(jumpHosts[0]?.privateKey, undefined);
  assert.equal(jumpHosts[0]?.passphrase, undefined);
});

test("startSSH omits identity file paths when password auth is selected", async () => {
  let capturedOptions: Record<string, unknown> | null = null;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "ssh-session";
    },
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Target",
      hostname: "target.example.test",
      username: "alice",
      authMethod: "password",
      password: "secret",
      identityFilePaths: ["/Users/alice/.ssh/id_ed25519"],
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startSSH(term as never);

  assert.ok(capturedOptions);
  assert.equal(capturedOptions.password, "secret");
  assert.equal(capturedOptions.identityFilePaths, undefined);
});

test("startSSH omits jump host identity file paths when password auth is selected", async () => {
  let capturedOptions: Record<string, unknown> | null = null;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "ssh-session";
    },
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Target",
      hostname: "target.example.test",
      username: "alice",
      hostChain: { hostIds: ["jump-1"] },
    },
    keys: [],
    resolvedChainHosts: [{
      id: "jump-1",
      label: "Jump",
      hostname: "jump.example.test",
      username: "jumper",
      authMethod: "password",
      password: "secret",
      identityFilePaths: ["/Users/alice/.ssh/jump_ed25519"],
    }],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startSSH(term as never);

  assert.ok(capturedOptions);
  const jumpHosts = capturedOptions.jumpHosts as Array<Record<string, unknown>>;
  assert.equal(jumpHosts[0]?.password, "secret");
  assert.equal(jumpHosts[0]?.identityFilePaths, undefined);
});

test("startSSH tries local identity file paths before saved passwords for key auth", async () => {
  let capturedOptions: Record<string, unknown> | null = null;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "ssh-session";
    },
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Target",
      hostname: "target.example.test",
      username: "alice",
      authMethod: "key",
      password: "saved-password",
      identityFilePaths: ["/Users/alice/.ssh/id_ed25519"],
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startSSH(term as never);

  assert.ok(capturedOptions);
  assert.equal(capturedOptions.password, undefined);
  assert.deepEqual(capturedOptions.identityFilePaths, ["/Users/alice/.ssh/id_ed25519"]);
});

test("startSSH accepts jump host local identity file paths with unreadable saved passwords", async () => {
  let capturedOptions: Record<string, unknown> | null = null;
  let error = "";

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "ssh-session";
    },
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Target",
      hostname: "target.example.test",
      username: "alice",
      hostChain: { hostIds: ["jump-1"] },
    },
    keys: [],
    resolvedChainHosts: [{
      id: "jump-1",
      label: "Jump",
      hostname: "jump.example.test",
      username: "jumper",
      authMethod: "key",
      password: ENCRYPTED_CREDENTIAL_PLACEHOLDER,
      identityFilePaths: ["/Users/alice/.ssh/jump_ed25519"],
    }],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: (message: string) => { error = message; },
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startSSH(term as never);

  assert.equal(error, "");
  assert.ok(capturedOptions);
  const jumpHosts = capturedOptions.jumpHosts as Array<Record<string, unknown>>;
  assert.equal(jumpHosts[0]?.password, undefined);
  assert.deepEqual(jumpHosts[0]?.identityFilePaths, ["/Users/alice/.ssh/jump_ed25519"]);
});

test("startSSH does not use stale local key paths when selected key material is unavailable", async () => {
  let capturedOptions: Record<string, unknown> | null = null;
  let needsAuth = false;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "ssh-session";
    },
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Target",
      hostname: "target.example.test",
      username: "alice",
      authMethod: "key",
      identityFileId: "bad-key",
      identityFilePaths: ["/Users/alice/.ssh/stale_ed25519"],
    },
    keys: [{
      id: "bad-key",
      label: "Imported key",
      source: "imported",
      privateKey: ENCRYPTED_CREDENTIAL_PLACEHOLDER,
    }],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: (value: boolean) => { needsAuth = value; },
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startSSH(term as never);

  assert.equal(capturedOptions, null);
  assert.equal(needsAuth, true);
});

test("startSSH does not use stale jump host local key paths when selected key material is unavailable", async () => {
  let capturedOptions: Record<string, unknown> | null = null;
  let error = "";

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "ssh-session";
    },
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Target",
      hostname: "target.example.test",
      username: "alice",
      hostChain: { hostIds: ["jump-1"] },
    },
    keys: [{
      id: "bad-jump-key",
      label: "Jump key",
      source: "imported",
      privateKey: ENCRYPTED_CREDENTIAL_PLACEHOLDER,
    }],
    resolvedChainHosts: [{
      id: "jump-1",
      label: "Jump",
      hostname: "jump.example.test",
      username: "jumper",
      authMethod: "key",
      identityFileId: "bad-jump-key",
      identityFilePaths: ["/Users/alice/.ssh/stale_jump_ed25519"],
    }],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: (message: string) => { error = message; },
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startSSH(term as never);

  assert.equal(capturedOptions, null);
  assert.match(error, /jump host has saved credentials/i);
});

test("startMosh does not pass legacy configured mosh client paths to the backend", async () => {
  let capturedOptions: Record<string, unknown> | null = null;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "mosh-session";
    },
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "alice",
      port: 2200,
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {
      terminalEmulationType: "xterm-256color",
      moshClientPath: "/usr/local/bin/mosh-client",
    },
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null as (() => void) | null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startMosh(term as never);

  assert.ok(capturedOptions);
  assert.equal("moshClientPath" in capturedOptions, false);
  assert.equal(capturedOptions.hostname, "example.test");
  assert.equal(capturedOptions.port, 2200);
});

test("startMosh passes the saved password to the mosh backend", async () => {
  let capturedOptions: Record<string, unknown> | null = null;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "mosh-session";
    },
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "alice",
      password: "saved-secret",
      port: 2200,
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null as (() => void) | null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startMosh(term as never);

  assert.ok(capturedOptions);
  assert.equal(capturedOptions.username, "alice");
  assert.equal(capturedOptions.password, "saved-secret");
});

test("startMosh passes configured key material to the mosh backend", async () => {
  let capturedOptions: Record<string, unknown> | null = null;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "mosh-session";
    },
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "alice",
      password: "wrong-password",
      authMethod: "key",
      identityFileId: "key-1",
      identityFilePaths: ["/should/not/be/used"],
      port: 2200,
    },
    keys: [{
      id: "key-1",
      label: "Deploy key",
      privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nkey\n-----END OPENSSH PRIVATE KEY-----",
      passphrase: "key-passphrase",
    }],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startMosh(term as never);

  assert.ok(capturedOptions);
  assert.equal(capturedOptions.password, "wrong-password");
  assert.equal(capturedOptions.privateKey, "-----BEGIN OPENSSH PRIVATE KEY-----\nkey\n-----END OPENSSH PRIVATE KEY-----");
  assert.equal(capturedOptions.keyId, "key-1");
  assert.equal(capturedOptions.passphrase, "key-passphrase");
  assert.equal(capturedOptions.identityFilePaths, undefined);
});

test("startMosh asks for credential re-entry when saved key material cannot be decrypted", async () => {
  let started = false;
  let needsAuth = false;
  let retryMessage: string | null = null;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async () => {
      started = true;
      return "mosh-session";
    },
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "alice",
      authMethod: "key",
      identityFileId: "key-1",
      port: 2200,
    },
    keys: [{
      id: "key-1",
      label: "Deploy key",
      privateKey: "enc:v1:djEwAAAA",
    }],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: (value: boolean) => { needsAuth = value; },
    setAuthRetryMessage: (message: string | null) => { retryMessage = message; },
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startMosh(term as never);

  assert.equal(started, false);
  assert.equal(needsAuth, true);
  assert.match(retryMessage || "", /Saved credentials cannot be decrypted/);
});

test("startMosh does not use stale local key paths when selected key material is unavailable", async () => {
  let started = false;
  let needsAuth = false;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async () => {
      started = true;
      return "mosh-session";
    },
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "alice",
      authMethod: "key",
      identityFileId: "key-1",
      identityFilePaths: ["/Users/alice/.ssh/stale_ed25519"],
      port: 2200,
    },
    keys: [{
      id: "key-1",
      label: "Deploy key",
      privateKey: "enc:v1:djEwAAAA",
    }],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null as (() => void) | null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: (value: boolean) => { needsAuth = value; },
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startMosh(term as never);

  assert.equal(started, false);
  assert.equal(needsAuth, true);
});

test("startMosh omits identity file paths when password auth is explicit", async () => {
  let capturedOptions: Record<string, unknown> | null = null;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "mosh-session";
    },
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "alice",
      authMethod: "password",
      password: "saved-secret",
      identityFilePaths: ["/should/not/be/used"],
      port: 2200,
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startMosh(term as never);

  assert.ok(capturedOptions);
  assert.equal(capturedOptions.password, "saved-secret");
  assert.equal(capturedOptions.identityFilePaths, undefined);
});

test("startMosh rejects missing saved proxy profiles", async () => {
  let started = false;
  let error = "";

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async () => {
      started = true;
      return "mosh-session";
    },
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "alice",
      port: 2200,
      proxyProfileId: "missing-proxy",
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: (message: string) => { error = message; },
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startMosh(term as never);

  assert.equal(started, false);
  assert.match(error, /Saved proxy/);
});

test("startMosh rejects configured proxies instead of connecting directly", async () => {
  let started = false;
  let error = "";

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async () => {
      started = true;
      return "mosh-session";
    },
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "alice",
      port: 2200,
      proxyProfileId: "proxy-1",
      proxyConfig: { type: "http", host: "proxy.example.com", port: 3128 },
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: (message: string) => { error = message; },
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startMosh(term as never);

  assert.equal(started, false);
  assert.match(error, /Mosh does not support proxy/);
});

test("startMosh rejects jump host chains instead of connecting directly", async () => {
  let started = false;
  let error = "";

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async () => "telnet-session",
    startMoshSession: async () => {
      started = true;
      return "mosh-session";
    },
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "alice",
      hostChain: { hostIds: ["jump-1"] },
      port: 2200,
    },
    keys: [],
    resolvedChainHosts: [{ id: "jump-1", hostname: "jump.example.test" }],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: (message: string) => { error = message; },
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startMosh(term as never);

  assert.equal(started, false);
  assert.match(error, /Mosh does not support jump host chains/);
});

test("startTelnet rejects missing saved proxy profiles", async () => {
  let started = false;
  let error = "";

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async () => {
      started = true;
      return "telnet-session";
    },
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "alice",
      telnetPort: 2323,
      proxyProfileId: "missing-proxy",
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: (message: string) => { error = message; },
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startTelnet(term as never);

  assert.equal(started, false);
  assert.match(error, /Saved proxy/);
});

test("startTelnet passes saved telnet credentials without falling back after explicit clears", async () => {
  let capturedOptions: Record<string, unknown> | null = null;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "telnet-session";
    },
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "ssh-user",
      password: "ssh-password",
      telnetUsername: "",
      telnetPassword: "telnet-password",
      telnetPort: 2323,
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startTelnet(term as never);

  assert.ok(capturedOptions);
  assert.equal(capturedOptions.username, "");
  assert.equal(capturedOptions.password, "telnet-password");
  assert.equal(capturedOptions.port, 2323);
});

test("startTelnet preserves an explicitly cleared telnet password", async () => {
  let capturedOptions: Record<string, unknown> | null = null;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "telnet-session";
    },
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "ssh-user",
      password: "ssh-password",
      telnetUsername: "telnet-user",
      telnetPassword: "",
      telnetPort: 2323,
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startTelnet(term as never);

  assert.ok(capturedOptions);
  assert.equal(capturedOptions.username, "telnet-user");
  assert.equal(capturedOptions.password, "");
});

test("startTelnet rejects unreadable saved telnet passwords before connecting", async () => {
  let started = false;
  let error = "";
  let needsAuth = true;
  let retryMessage: string | null = "previous";
  let status = "";
  const writes: string[] = [];

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async () => {
      started = true;
      return "telnet-session";
    },
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "ssh-user",
      password: "ssh-password",
      telnetUsername: "telnet-user",
      telnetPassword: ENCRYPTED_CREDENTIAL_PLACEHOLDER,
      telnetPort: 2323,
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: (next: string) => { status = next; },
    setStatus: noop,
    setError: (message: string) => { error = message; },
    setNeedsAuth: (value: boolean) => { needsAuth = value; },
    setAuthRetryMessage: (message: string | null) => { retryMessage = message; },
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: (data: string) => { writes.push(data); },
    writeln: (data: string) => { writes.push(data); },
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startTelnet(term as never);

  assert.equal(started, false);
  assert.equal(needsAuth, false);
  assert.equal(retryMessage, null);
  assert.equal(status, "disconnected");
  assert.match(error, /Saved credentials cannot be decrypted/);
  assert.match(writes.join("\n"), /Saved credentials cannot be decrypted/);
});

test("startTelnet waits for auto-login before running the startup command", async () => {
  const writtenCommands: string[] = [];
  const executedCommands: string[] = [];
  let capturedOptions: Record<string, unknown> | null = null;
  let autoLoginComplete: ((evt: { sessionId: string }) => void) | null = null;
  let disposedAutoLoginCancelListener = false;
  let resolveCommand: (() => void) | null = null;
  const commandWritten = new Promise<void>((resolve) => {
    resolveCommand = resolve;
  });

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "telnet-session";
    },
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onTelnetAutoLoginComplete: (sessionId: string, cb: (evt: { sessionId: string }) => void) => {
      assert.equal(sessionId, "session-1");
      autoLoginComplete = cb;
      return noop;
    },
    onTelnetAutoLoginCancelled: () => () => {
      disposedAutoLoginCancelListener = true;
    },
    onChainProgress: () => noop,
    writeToSession: (_sessionId: string, data: string) => {
      writtenCommands.push(data);
      resolveCommand?.();
    },
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "ssh-user",
      telnetUsername: "telnet-user",
      telnetPassword: "",
      telnetPort: 2323,
      startupCommand: "show version",
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
    onCommandExecuted: (command: string) => {
      executedCommands.push(command);
    },
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startTelnet(term as never);
  assert.ok(capturedOptions);
  assert.ok(autoLoginComplete);

  await new Promise((resolve) => setTimeout(resolve, 700));
  assert.deepEqual(writtenCommands, []);
  assert.deepEqual(executedCommands, []);

  autoLoginComplete({ sessionId: "session-1" });

  await Promise.race([
    commandWritten,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for startup command")), 1000)),
  ]);

  assert.deepEqual(writtenCommands, ["show version\r"]);
  assert.deepEqual(executedCommands, ["show version"]);
  assert.equal(disposedAutoLoginCancelListener, true);
});

test("startTelnet cancels pending startup command when user takes over", async () => {
  const writtenCommands: string[] = [];
  let capturedOptions: Record<string, unknown> | null = null;
  let autoLoginComplete: ((evt: { sessionId: string }) => void) | null = null;
  let autoLoginCancelled: ((evt: { sessionId: string }) => void) | null = null;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "telnet-session";
    },
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onTelnetAutoLoginComplete: (_sessionId: string, cb: (evt: { sessionId: string }) => void) => {
      autoLoginComplete = cb;
      return noop;
    },
    onTelnetAutoLoginCancelled: (_sessionId: string, cb: (evt: { sessionId: string }) => void) => {
      autoLoginCancelled = cb;
      return noop;
    },
    onChainProgress: () => noop,
    writeToSession: (_sessionId: string, data: string) => {
      writtenCommands.push(data);
    },
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      telnetUsername: "telnet-user",
      telnetPassword: "secret",
      startupCommand: "show version",
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startTelnet(term as never);
  assert.ok(capturedOptions);
  assert.ok(autoLoginComplete);
  assert.ok(autoLoginCancelled);

  autoLoginComplete({ sessionId: "session-1" });
  autoLoginCancelled({ sessionId: "session-1" });
  await new Promise((resolve) => setTimeout(resolve, 700));

  assert.deepEqual(writtenCommands, []);
});

test("startTelnet does not run startup command if auto-login never completes", async () => {
  const writtenCommands: string[] = [];
  const executedCommands: string[] = [];
  let capturedOptions: Record<string, unknown> | null = null;
  let autoLoginComplete: ((evt: { sessionId: string }) => void) | null = null;
  let disposedAutoLoginListener = false;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "telnet-session";
    },
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onTelnetAutoLoginComplete: (_sessionId: string, cb: (evt: { sessionId: string }) => void) => {
      autoLoginComplete = cb;
      return () => {
        disposedAutoLoginListener = true;
      };
    },
    onChainProgress: () => noop,
    writeToSession: (_sessionId: string, data: string) => {
      writtenCommands.push(data);
    },
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "ssh-user",
      telnetUsername: "telnet-user",
      telnetPassword: "",
      telnetPort: 2323,
      startupCommand: "show version",
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
    onCommandExecuted: (command: string) => {
      executedCommands.push(command);
    },
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startTelnet(term as never);
  assert.ok(capturedOptions);
  assert.ok(autoLoginComplete);

  await new Promise((resolve) => setTimeout(resolve, 700));

  assert.deepEqual(writtenCommands, []);
  assert.deepEqual(executedCommands, []);

  ctx.disposeExitRef.current?.();
  assert.equal(disposedAutoLoginListener, true);
});

test("startTelnet does not run startup command during manual login", async () => {
  const writtenCommands: string[] = [];
  let capturedOptions: Record<string, unknown> | null = null;

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async (options: Record<string, unknown>) => {
      capturedOptions = options;
      return "telnet-session";
    },
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: (_sessionId: string, data: string) => {
      writtenCommands.push(data);
    },
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: undefined,
      password: undefined,
      telnetUsername: undefined,
      telnetPassword: undefined,
      port: 2222,
      startupCommand: "show version",
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: noop,
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startTelnet(term as never);
  await new Promise((resolve) => setTimeout(resolve, 700));

  assert.ok(capturedOptions);
  assert.equal(capturedOptions.port, 23);
  assert.deepEqual(writtenCommands, []);
});

test("startTelnet rejects configured proxies instead of connecting directly", async () => {
  let started = false;
  let error = "";

  const terminalBackend = {
    backendAvailable: () => true,
    telnetAvailable: () => true,
    moshAvailable: () => true,
    localAvailable: () => true,
    serialAvailable: () => true,
    execAvailable: () => true,
    startSSHSession: async () => "ssh-session",
    startTelnetSession: async () => {
      started = true;
      return "telnet-session";
    },
    startMoshSession: async () => "mosh-session",
    startLocalSession: async () => "local-session",
    startSerialSession: async () => "serial-session",
    execCommand: async () => ({}),
    onSessionData: () => noop,
    onSessionExit: () => noop,
    onChainProgress: () => noop,
    writeToSession: noop,
    resizeSession: noop,
  };

  const ctx = {
    host: {
      id: "host-1",
      label: "Example",
      hostname: "example.test",
      username: "alice",
      telnetPort: 2323,
      proxyProfileId: "proxy-1",
      proxyConfig: { type: "http", host: "proxy.example.com", port: 3128 },
    },
    keys: [],
    resolvedChainHosts: [],
    sessionId: "session-1",
    terminalSettings: {},
    terminalBackend,
    sessionRef: { current: null },
    hasConnectedRef: { current: false },
    hasRunStartupCommandRef: { current: false },
    disposeDataRef: { current: null },
    disposeExitRef: { current: null },
    fitAddonRef: { current: null },
    serializeAddonRef: { current: null },
    pendingAuthRef: { current: null },
    updateStatus: noop,
    setStatus: noop,
    setError: (message: string) => { error = message; },
    setNeedsAuth: noop,
    setAuthRetryMessage: noop,
    setAuthPassword: noop,
    setProgressLogs: noop,
    setProgressValue: noop,
    setChainProgress: noop,
  };

  const term = {
    cols: 120,
    rows: 32,
    write: noop,
    writeln: noop,
    scrollToBottom: noop,
  };

  await createTerminalSessionStarters(ctx as never).startTelnet(term as never);

  assert.equal(started, false);
  assert.match(error, /Telnet does not support proxy/);
});
