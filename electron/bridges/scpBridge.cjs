/**
 * SCP Bridge - Handles SCP file operations via SSH exec + SCP protocol
 *
 * For devices that don't support SFTP subsystem, this bridge provides:
 * - Directory listing via SSH exec (`ls -la`)
 * - File upload/download via ssh2 SCP (sftp.fastPut/fastGet fallback to exec scp)
 * - File operations (mkdir, rm, rename, chmod) via SSH exec
 *
 * Uses the same SSH connection pattern as sftpBridge.cjs but without
 * requiring the SFTP subsystem.
 */

const { Client } = require("ssh2");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const sshAuthHelper = require("./sshAuthHelper.cjs");
const proxyUtils = require("./proxyUtils.cjs");

let electronModule = null;

// Active SCP sessions: connId -> { client, ready }
const scpSessions = new Map();

function init(deps) {
  electronModule = deps.electronModule;
}

// ── SSH Connection Setup ──

/**
 * Build SSH algorithms config (same as sftpBridge)
 */
function buildScpAlgorithms(legacyAlgorithms) {
  if (!legacyAlgorithms) return undefined;
  return {
    kex: [
      "ecdh-sha2-nistp256", "ecdh-sha2-nistp384", "ecdh-sha2-nistp521",
      "diffie-hellman-group-exchange-sha256", "diffie-hellman-group14-sha256",
      "diffie-hellman-group16-sha512", "diffie-hellman-group18-sha512",
      "diffie-hellman-group14-sha1", "diffie-hellman-group-exchange-sha1",
      "diffie-hellman-group1-sha1",
    ],
    serverHostKey: [
      "ssh-ed25519", "ecdsa-sha2-nistp256", "ecdsa-sha2-nistp384",
      "ecdsa-sha2-nistp521", "rsa-sha2-512", "rsa-sha2-256", "ssh-rsa", "ssh-dss",
    ],
    cipher: [
      "aes128-gcm", "aes128-gcm@openssh.com", "aes256-gcm", "aes256-gcm@openssh.com",
      "aes128-ctr", "aes192-ctr", "aes256-ctr",
      "aes256-cbc", "aes192-cbc", "aes128-cbc", "3des-cbc",
    ],
  };
}


/**
 * Open an SCP session (SSH connection without SFTP subsystem)
 */
async function openScp(event, options) {
  const connId = options.sessionId || `${Date.now()}-scp-${Math.random().toString(16).slice(2)}`;
  const defaultKeys = await sshAuthHelper.findAllDefaultPrivateKeys();
  const agentSocket = await sshAuthHelper.getAvailableAgentSocket();

  // Build proxy socket if needed
  let connectionSocket = null;
  if (options.proxy) {
    connectionSocket = await proxyUtils.createProxySocket(
      options.proxy, options.hostname, options.port || 22
    );
  }

  const connOpts = {
    host: options.hostname,
    port: options.port || 22,
    username: options.username || "root",
    tryKeyboard: true,
    readyTimeout: 120000,
    algorithms: buildScpAlgorithms(options.legacyAlgorithms),
  };

  if (connectionSocket) {
    connOpts.sock = connectionSocket;
    delete connOpts.host;
    delete connOpts.port;
  }

  // Build auth
  const authConfig = sshAuthHelper.buildAuthHandler({
    privateKey: options.privateKey,
    password: options.password,
    passphrase: options.passphrase,
    agent: agentSocket,
    username: options.username || "root",
    logPrefix: "[SCP]",
    defaultKeys,
  });
  sshAuthHelper.applyAuthToConnOpts(connOpts, authConfig);

  if (options.password) {
    connOpts.password = options.password;
  }

  // Keyboard-interactive handler for 2FA
  const kiHandler = sshAuthHelper.createKeyboardInteractiveHandler({
    sender: event.sender,
    sessionId: connId,
    hostname: options.hostname,
    password: options.password,
    logPrefix: "[SCP]",
  });

  return new Promise((resolve, reject) => {
    const client = new Client();
    let settled = false;

    const done = (fn) => (val) => {
      if (settled) return;
      settled = true;
      fn(val);
    };

    const onReady = done(() => {
      scpSessions.set(connId, { client, hostname: options.hostname });
      console.log(`[SCP] Session ${connId} connected to ${options.hostname}`);
      resolve({ scpId: connId });
    });

    const onError = done((err) => {
      console.error(`[SCP] Connection error for ${connId}:`, err.message);
      try { client.end(); } catch {}
      reject(err);
    });

    const onEnd = done(() => {
      reject(new Error("Connection ended before ready"));
    });

    client.once("ready", onReady);
    client.once("error", onError);
    client.once("end", onEnd);
    client.on("keyboard-interactive", kiHandler);

    // Send connection progress to renderer
    const sendProgress = (message) => {
      try {
        event.sender.send("netcatty:scp:connection-progress", {
          connId, hostname: options.hostname, message,
        });
      } catch {}
    };

    sendProgress(`Connecting to ${options.hostname}:${options.port || 22}...`);
    client.connect(connOpts);
  });
}

/**
 * Close an SCP session
 */
function closeScp(_event, { scpId }) {
  const session = scpSessions.get(scpId);
  if (!session) return;
  try { session.client.end(); } catch {}
  scpSessions.delete(scpId);
  console.log(`[SCP] Session ${scpId} closed`);
}


// ── Directory Listing via SSH exec ──

/**
 * Execute a command on the remote host and return stdout
 */
function execCommand(client, command, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Command timed out")), timeoutMs);
    client.exec(command, (err, stream) => {
      if (err) { clearTimeout(timer); return reject(err); }
      let stdout = "";
      let stderr = "";
      stream.on("data", (data) => { stdout += data.toString("utf8"); });
      stream.stderr.on("data", (data) => { stderr += data.toString("utf8"); });
      stream.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0 && !stdout.trim()) {
          reject(new Error(stderr.trim() || `Command exited with code ${code}`));
        } else {
          resolve(stdout);
        }
      });
    });
  });
}

/**
 * Parse `ls -la` output into file entries
 */
function parseLsOutput(output, dirPath) {
  const lines = output.split("\n").filter((l) => l.trim());
  const entries = [];

  for (const line of lines) {
    // Skip "total N" line
    if (/^total\s+\d+/i.test(line.trim())) continue;

    // Parse ls -la format:
    // drwxr-xr-x  2 user group  4096 Jan  1 12:00 dirname
    // -rw-r--r--  1 user group  1234 Jan  1 12:00 filename
    // lrwxrwxrwx  1 user group    10 Jan  1 12:00 link -> target
    const match = line.match(
      /^([dlcbps-])([rwxsStT-]{9})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+(\w+\s+\d+\s+[\d:]+)\s+(.+)$/
    );
    if (!match) continue;

    const [, typeChar, perms, owner, group, sizeStr, dateStr, nameRaw] = match;
    const name = nameRaw.trim();

    // Skip . and ..
    if (name === "." || name === "..") continue;

    // Handle symlinks: "name -> target"
    let displayName = name;
    let linkTarget = null;
    if (typeChar === "l") {
      const arrowIdx = name.indexOf(" -> ");
      if (arrowIdx !== -1) {
        displayName = name.slice(0, arrowIdx);
        linkTarget = "file"; // We can't easily determine target type without stat
      }
    }

    const type = typeChar === "d" ? "directory" : typeChar === "l" ? "symlink" : "file";
    const size = parseInt(sizeStr, 10) || 0;
    const lastModified = parseLsDate(dateStr);

    entries.push({
      name: displayName,
      type,
      size,
      sizeFormatted: formatFileSize(size),
      lastModified,
      lastModifiedFormatted: formatDate(lastModified),
      permissions: typeChar + perms,
      owner,
      group,
      linkTarget,
    });
  }

  return entries;
}

/**
 * Parse ls date string into timestamp
 */
function parseLsDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.getTime();
    // If year is missing, ls shows time instead — assume current year
    const now = new Date();
    const withYear = new Date(`${dateStr} ${now.getFullYear()}`);
    if (!isNaN(withYear.getTime())) return withYear.getTime();
  } catch {}
  return Date.now();
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function formatDate(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

/**
 * List directory contents via SSH exec
 */
async function listScp(_event, { scpId, remotePath }) {
  const session = scpSessions.get(scpId);
  if (!session) throw new Error("SCP session not found");

  const safePath = remotePath.replace(/'/g, "'\\''");
  const output = await execCommand(session.client, `LC_ALL=C ls -la '${safePath}'`);
  return parseLsOutput(output, remotePath);
}

/**
 * Get home directory
 */
async function getHomeDir(_event, { scpId }) {
  const session = scpSessions.get(scpId);
  if (!session) throw new Error("SCP session not found");
  const output = await execCommand(session.client, "echo $HOME");
  return output.trim() || "/";
}


// ── File Operations via SSH exec ──

async function mkdirScp(_event, { scpId, remotePath }) {
  const session = scpSessions.get(scpId);
  if (!session) throw new Error("SCP session not found");
  const safePath = remotePath.replace(/'/g, "'\\''");
  await execCommand(session.client, `mkdir -p '${safePath}'`);
  return true;
}

async function deleteScp(_event, { scpId, remotePath }) {
  const session = scpSessions.get(scpId);
  if (!session) throw new Error("SCP session not found");
  const safePath = remotePath.replace(/'/g, "'\\''");
  await execCommand(session.client, `rm -rf '${safePath}'`);
  return true;
}

async function renameScp(_event, { scpId, oldPath, newPath }) {
  const session = scpSessions.get(scpId);
  if (!session) throw new Error("SCP session not found");
  const safeOld = oldPath.replace(/'/g, "'\\''");
  const safeNew = newPath.replace(/'/g, "'\\''");
  await execCommand(session.client, `mv '${safeOld}' '${safeNew}'`);
  return true;
}

async function chmodScp(_event, { scpId, remotePath, mode }) {
  const session = scpSessions.get(scpId);
  if (!session) throw new Error("SCP session not found");
  const safePath = remotePath.replace(/'/g, "'\\''");
  await execCommand(session.client, `chmod ${mode} '${safePath}'`);
  return true;
}

async function statScp(_event, { scpId, remotePath }) {
  const session = scpSessions.get(scpId);
  if (!session) throw new Error("SCP session not found");
  const safePath = remotePath.replace(/'/g, "'\\''");
  try {
    const output = await execCommand(session.client,
      `LC_ALL=C stat -c '%F|%s|%Y|%a|%U|%G' '${safePath}' 2>/dev/null || LC_ALL=C stat -f '%HT|%z|%m|%Lp|%Su|%Sg' '${safePath}'`
    );
    const parts = output.trim().split("|");
    if (parts.length < 6) return null;
    const [typeStr, sizeStr, mtimeStr, permsStr, owner, group] = parts;
    const isDir = /directory/i.test(typeStr);
    const size = parseInt(sizeStr, 10) || 0;
    const mtime = parseInt(mtimeStr, 10) * 1000 || Date.now();
    return {
      name: path.basename(remotePath),
      type: isDir ? "directory" : "file",
      size,
      sizeFormatted: formatFileSize(size),
      lastModified: mtime,
      lastModifiedFormatted: formatDate(mtime),
      permissions: permsStr,
      owner: owner.trim(),
      group: group.trim(),
    };
  } catch {
    return null;
  }
}

// ── File Transfer via SCP (ssh2 exec) ──

/**
 * Download a remote file to a local path using SCP protocol via ssh2 exec
 */
function scpDownload(client, remotePath, localPath) {
  return new Promise((resolve, reject) => {
    const safePath = remotePath.replace(/'/g, "'\\''");
    client.exec(`cat '${safePath}'`, (err, stream) => {
      if (err) return reject(err);
      const ws = fs.createWriteStream(localPath);
      stream.pipe(ws);
      stream.stderr.on("data", () => {}); // ignore stderr
      ws.on("finish", () => resolve());
      ws.on("error", (e) => reject(e));
      stream.on("error", (e) => { ws.destroy(); reject(e); });
    });
  });
}

/**
 * Upload a local file to a remote path using SCP protocol via ssh2 exec
 */
function scpUpload(client, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const safePath = remotePath.replace(/'/g, "'\\''");
    const stat = fs.statSync(localPath);
    const fileSize = stat.size;

    // Use cat to write file content to remote
    client.exec(`cat > '${safePath}'`, (err, stream) => {
      if (err) return reject(err);
      const rs = fs.createReadStream(localPath);
      rs.pipe(stream);
      rs.on("error", (e) => { stream.destroy(); reject(e); });
      stream.on("close", (code) => {
        if (code !== 0) reject(new Error(`Upload failed with code ${code}`));
        else resolve();
      });
      stream.stderr.on("data", () => {});
    });
  });
}

/**
 * Read a remote file content as string
 */
async function readScp(_event, { scpId, remotePath }) {
  const session = scpSessions.get(scpId);
  if (!session) throw new Error("SCP session not found");
  const safePath = remotePath.replace(/'/g, "'\\''");
  return execCommand(session.client, `cat '${safePath}'`, 30000);
}

/**
 * Write content to a remote file
 */
async function writeScp(_event, { scpId, remotePath, content }) {
  const session = scpSessions.get(scpId);
  if (!session) throw new Error("SCP session not found");

  return new Promise((resolve, reject) => {
    const safePath = remotePath.replace(/'/g, "'\\''");
    session.client.exec(`cat > '${safePath}'`, (err, stream) => {
      if (err) return reject(err);
      stream.on("close", (code) => {
        if (code !== 0) reject(new Error(`Write failed with code ${code}`));
        else resolve(true);
      });
      stream.end(content);
    });
  });
}

/**
 * Download remote file to temp directory (for external editing)
 */
async function downloadToTemp(_event, { scpId, remotePath, fileName }) {
  const session = scpSessions.get(scpId);
  if (!session) throw new Error("SCP session not found");

  const tempDirBridge = require("./tempDirBridge.cjs");
  const localPath = await tempDirBridge.getTempFilePath(fileName);
  await scpDownload(session.client, remotePath, localPath);
  return localPath;
}

/**
 * Transfer a file with progress reporting via IPC events
 */
async function transferWithProgress(event, { scpId, transferId, sourcePath, targetPath, direction, totalBytes }) {
  const session = scpSessions.get(scpId);
  if (!session) throw new Error("SCP session not found");

  const sendProgress = (transferred) => {
    try {
      event.sender.send("netcatty:transfer:progress", { transferId, transferred, total: totalBytes });
    } catch {}
  };

  const sendComplete = () => {
    try {
      event.sender.send("netcatty:transfer:complete", { transferId });
    } catch {}
  };

  const sendError = (error) => {
    try {
      event.sender.send("netcatty:transfer:error", { transferId, error: error.message || String(error) });
    } catch {}
  };

  try {
    if (direction === "download") {
      // Remote -> Local
      const safePath = sourcePath.replace(/'/g, "'\\''");
      await new Promise((resolve, reject) => {
        session.client.exec(`cat '${safePath}'`, (err, stream) => {
          if (err) return reject(err);
          const ws = fs.createWriteStream(targetPath);
          let transferred = 0;
          stream.on("data", (chunk) => {
            transferred += chunk.length;
            sendProgress(transferred);
          });
          stream.pipe(ws);
          ws.on("finish", () => { sendComplete(); resolve(); });
          ws.on("error", (e) => reject(e));
          stream.on("error", (e) => { ws.destroy(); reject(e); });
        });
      });
    } else {
      // Local -> Remote (upload)
      const safePath = targetPath.replace(/'/g, "'\\''");
      await new Promise((resolve, reject) => {
        session.client.exec(`cat > '${safePath}'`, (err, stream) => {
          if (err) return reject(err);
          const rs = fs.createReadStream(sourcePath);
          let transferred = 0;
          rs.on("data", (chunk) => {
            transferred += chunk.length;
            sendProgress(transferred);
          });
          rs.pipe(stream);
          stream.on("close", (code) => {
            if (code !== 0) reject(new Error(`Transfer failed with code ${code}`));
            else { sendComplete(); resolve(); }
          });
          rs.on("error", (e) => { stream.destroy(); reject(e); });
        });
      });
    }
    return { success: true };
  } catch (err) {
    sendError(err);
    return { success: false, error: err.message };
  }
}

// ── Cleanup ──

function cleanupAllSessions() {
  console.log(`[SCP] Cleaning up ${scpSessions.size} sessions`);
  for (const [id, session] of scpSessions) {
    try { session.client.end(); } catch {}
  }
  scpSessions.clear();
}

// ── IPC Registration ──

function registerHandlers(ipcMain) {
  ipcMain.handle("netcatty:scp:open", openScp);
  ipcMain.handle("netcatty:scp:close", closeScp);
  ipcMain.handle("netcatty:scp:list", listScp);
  ipcMain.handle("netcatty:scp:homeDir", getHomeDir);
  ipcMain.handle("netcatty:scp:read", readScp);
  ipcMain.handle("netcatty:scp:write", writeScp);
  ipcMain.handle("netcatty:scp:mkdir", mkdirScp);
  ipcMain.handle("netcatty:scp:delete", deleteScp);
  ipcMain.handle("netcatty:scp:rename", renameScp);
  ipcMain.handle("netcatty:scp:chmod", chmodScp);
  ipcMain.handle("netcatty:scp:stat", statScp);
  ipcMain.handle("netcatty:scp:downloadToTemp", downloadToTemp);
  ipcMain.handle("netcatty:scp:transfer", transferWithProgress);
  console.log("[SCP] IPC handlers registered");
}

module.exports = {
  init,
  registerHandlers,
  cleanupAllSessions,
  scpSessions,
};
