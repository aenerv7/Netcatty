/**
 * AI Bridge - Handles AI provider API calls and agent tool execution
 *
 * Proxies LLM API calls through the main process (avoiding CORS),
 * and provides tool execution capabilities for the Catty Agent.
 */

const https = require("node:https");
const http = require("node:http");
const { URL } = require("node:url");
const { spawn } = require("node:child_process");
const path = require("node:path");

let sessions = null;
let sftpClients = null;
let electronModule = null;

// Active streaming requests (for cancellation)
const activeStreams = new Map();

// External agent processes
const agentProcesses = new Map();

function init(deps) {
  sessions = deps.sessions;
  sftpClients = deps.sftpClients;
  electronModule = deps.electronModule;
}

/**
 * Make a streaming HTTP request and forward SSE events back to renderer
 */
function streamRequest(url, options, event, requestId) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";
    const lib = isHttps ? https : http;

    const req = lib.request(
      parsedUrl,
      {
        method: options.method || "POST",
        headers: options.headers || {},
        timeout: 120000, // 2 min connection timeout
      },
      (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          let errorBody = "";
          res.on("data", (chunk) => { errorBody += chunk.toString(); });
          res.on("end", () => {
            event.sender.send("netcatty:ai:stream:error", {
              requestId,
              error: `HTTP ${res.statusCode}: ${errorBody}`,
            });
            resolve();
          });
          return;
        }

        let buffer = "";

        res.on("data", (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Forward raw SSE data line to renderer
            if (trimmed.startsWith("data: ")) {
              event.sender.send("netcatty:ai:stream:data", {
                requestId,
                data: trimmed.slice(6),
              });
            }
          }
        });

        res.on("end", () => {
          // Flush any remaining buffer
          if (buffer.trim().startsWith("data: ")) {
            event.sender.send("netcatty:ai:stream:data", {
              requestId,
              data: buffer.trim().slice(6),
            });
          }
          event.sender.send("netcatty:ai:stream:end", { requestId });
          activeStreams.delete(requestId);
          resolve();
        });

        res.on("error", (err) => {
          event.sender.send("netcatty:ai:stream:error", {
            requestId,
            error: err.message,
          });
          activeStreams.delete(requestId);
          resolve();
        });
      }
    );

    req.on("error", (err) => {
      event.sender.send("netcatty:ai:stream:error", {
        requestId,
        error: err.message,
      });
      activeStreams.delete(requestId);
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      event.sender.send("netcatty:ai:stream:error", {
        requestId,
        error: "Request timeout",
      });
      activeStreams.delete(requestId);
    });

    // Store ref for cancellation
    activeStreams.set(requestId, req);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function registerHandlers(ipcMain) {
  // Start a streaming chat request (proxied through main process)
  ipcMain.handle("netcatty:ai:chat:stream", async (event, { requestId, url, headers, body }) => {
    try {
      await streamRequest(url, { method: "POST", headers, body }, event, requestId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // Cancel an active stream
  ipcMain.handle("netcatty:ai:chat:cancel", async (_event, { requestId }) => {
    const req = activeStreams.get(requestId);
    if (req) {
      req.destroy();
      activeStreams.delete(requestId);
      return true;
    }
    return false;
  });

  // Non-streaming request (for model listing, validation, etc.)
  ipcMain.handle("netcatty:ai:fetch", async (_event, { url, method, headers, body }) => {
    return new Promise((resolve) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === "https:";
      const lib = isHttps ? https : http;

      const req = lib.request(
        parsedUrl,
        { method: method || "GET", headers: headers || {}, timeout: 30000 },
        (res) => {
          let data = "";
          res.on("data", (chunk) => { data += chunk.toString(); });
          res.on("end", () => {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              data,
            });
          });
        }
      );

      req.on("error", (err) => {
        resolve({ ok: false, status: 0, data: "", error: err.message });
      });
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, status: 0, data: "", error: "Request timeout" });
      });

      if (body) req.write(body);
      req.end();
    });
  });

  // Execute a command on a terminal session (for Catty Agent)
  ipcMain.handle("netcatty:ai:exec", async (_event, { sessionId, command }) => {
    const session = sessions?.get(sessionId);
    if (!session) {
      return { ok: false, error: "Session not found" };
    }

    try {
      // Use SSH exec for remote sessions
      if (session.sshClient) {
        return new Promise((resolve) => {
          session.sshClient.exec(command, (err, stream) => {
            if (err) {
              resolve({ ok: false, error: err.message });
              return;
            }
            let stdout = "";
            let stderr = "";
            stream.on("data", (data) => { stdout += data.toString(); });
            stream.stderr.on("data", (data) => { stderr += data.toString(); });
            stream.on("close", (code) => {
              resolve({ ok: code === 0, stdout, stderr, exitCode: code });
            });
          });
        });
      }

      // For local sessions, we can't easily exec - return info about session type
      return { ok: false, error: "Command execution only supported for SSH sessions" };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // Write to terminal session (send input like a user typing)
  ipcMain.handle("netcatty:ai:terminal:write", async (_event, { sessionId, data }) => {
    const session = sessions?.get(sessionId);
    if (!session) {
      return { ok: false, error: "Session not found" };
    }
    try {
      if (session.stream) {
        session.stream.write(data);
        return { ok: true };
      }
      if (session.pty) {
        session.pty.write(data);
        return { ok: true };
      }
      return { ok: false, error: "No writable stream for session" };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // Discover external agents in system PATH
  ipcMain.handle("netcatty:ai:agents:discover", async () => {
    const { execSync } = require("node:child_process");
    const agents = [];
    const knownAgents = [
      { command: "claude", name: "Claude Agent", icon: "anthropic" },
      { command: "codex", name: "Codex CLI", icon: "openai" },
      { command: "gemini", name: "Gemini CLI", icon: "google" },
      { command: "aider", name: "Aider", icon: "aider" },
    ];

    for (const agent of knownAgents) {
      try {
        const whichCmd = process.platform === "win32" ? "where" : "which";
        const result = execSync(`${whichCmd} ${agent.command}`, {
          encoding: "utf8",
          timeout: 5000,
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        if (result) {
          agents.push({
            ...agent,
            path: result.split("\n")[0].trim(),
            available: true,
          });
        }
      } catch {
        agents.push({ ...agent, path: "", available: false });
      }
    }

    return agents;
  });

  // Spawn an external agent process (ACP stub)
  ipcMain.handle("netcatty:ai:agent:spawn", async (event, { agentId, command, args, env }) => {
    if (agentProcesses.has(agentId)) {
      return { ok: false, error: "Agent already running" };
    }

    try {
      const proc = spawn(command, args || [], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...env },
      });

      let isAlive = true;

      proc.stdout.on("data", (data) => {
        event.sender.send("netcatty:ai:agent:stdout", {
          agentId,
          data: data.toString(),
        });
      });

      proc.stderr.on("data", (data) => {
        event.sender.send("netcatty:ai:agent:stderr", {
          agentId,
          data: data.toString(),
        });
      });

      proc.on("exit", (code) => {
        isAlive = false;
        agentProcesses.delete(agentId);
        event.sender.send("netcatty:ai:agent:exit", { agentId, code });
      });

      proc.on("error", (err) => {
        isAlive = false;
        agentProcesses.delete(agentId);
        event.sender.send("netcatty:ai:agent:error", {
          agentId,
          error: err.message,
        });
      });

      agentProcesses.set(agentId, proc);

      return { ok: true, pid: proc.pid };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // Send data to agent's stdin
  ipcMain.handle("netcatty:ai:agent:write", async (_event, { agentId, data }) => {
    const proc = agentProcesses.get(agentId);
    if (!proc) return { ok: false, error: "Agent not found" };
    try {
      proc.stdin.write(data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // Kill an agent process
  ipcMain.handle("netcatty:ai:agent:kill", async (_event, { agentId }) => {
    const proc = agentProcesses.get(agentId);
    if (!proc) return { ok: false, error: "Agent not found" };
    try {
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (agentProcesses.has(agentId)) {
          try { proc.kill("SIGKILL"); } catch {}
        }
      }, 5000);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });
}

// Cleanup all agent processes on shutdown
function cleanup() {
  for (const [id, proc] of agentProcesses) {
    try {
      proc.kill("SIGTERM");
    } catch {}
  }
  agentProcesses.clear();

  for (const [id, req] of activeStreams) {
    try {
      req.destroy();
    } catch {}
  }
  activeStreams.clear();
}

module.exports = { init, registerHandlers, cleanup };
