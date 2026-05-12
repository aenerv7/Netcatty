const { createClient, AuthType } = require("webdav");
const https = require("https");

const SYNC_FILE_NAME = "netcatty-vault.json";
const SYNC_DIR_NAME = "Netcatty";

const normalizeEndpoint = (endpoint) => {
  const trimmed = String(endpoint || "").trim();
  if (!trimmed) return trimmed;
  let url = trimmed;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  // Remove trailing slash to avoid double-slash when joining paths
  return url.replace(/\/+$/, "");
};

const ensureLeadingSlash = (value) => (value.startsWith("/") ? value : `/${value}`);

const buildError = (message, details) => {
  const err = new Error(message);
  err.cause = details;
  return err;
};

// Per RFC 7617, Basic Auth credentials must be UTF-8 encoded before base64.
// The upstream `webdav` package routes through `base-64`, which encodes as
// Latin1 — silently corrupting non-ASCII characters (e.g. `ö`, `ä`) and
// causing 401s against servers that follow the spec, like Hetzner Storage
// Box (#891). We build the header ourselves to avoid that path.
const buildBasicAuthHeader = (username, password) =>
  "Basic " +
  Buffer.from(`${username || ""}:${password || ""}`, "utf8").toString("base64");

const buildWebdavClient = (config) => {
  if (!config) throw new Error("Missing WebDAV config");
  const endpoint = normalizeEndpoint(config.endpoint);
  const extraOpts = {};
  if (config.allowInsecure) {
    extraOpts.httpsAgent = new https.Agent({ rejectUnauthorized: false });
  }
  if (config.authType === "token") {
    return createClient(endpoint, {
      authType: AuthType.Token,
      token: {
        access_token: config.token || "",
        token_type: "Bearer",
      },
      ...extraOpts,
    });
  }
  if (config.authType === "digest") {
    return createClient(endpoint, {
      authType: AuthType.Digest,
      username: config.username || "",
      password: config.password || "",
      ...extraOpts,
    });
  }
  return createClient(endpoint, {
    authType: AuthType.None,
    headers: {
      Authorization: buildBasicAuthHeader(config.username, config.password),
    },
    ...extraOpts,
  });
};

const getWebdavPath = () => ensureLeadingSlash(`${SYNC_DIR_NAME}/${SYNC_FILE_NAME}`);
const getWebdavDir = () => ensureLeadingSlash(SYNC_DIR_NAME);

/**
 * Ensure the sync directory exists on the WebDAV server.
 * Silently succeeds if the directory already exists.
 */
const ensureWebdavDir = async (client) => {
  const dir = getWebdavDir();
  try {
    const exists = await client.exists(dir);
    if (!exists) {
      await client.createDirectory(dir);
    }
  } catch (err) {
    // 405 Method Not Allowed = directory already exists on some servers
    if (err?.status === 405 || err?.response?.status === 405) return;
    throw err;
  }
};

const wrapWebdavError = (operation, error, config) => {
  const message = error instanceof Error ? error.message : String(error);
  const details = {
    operation,
    endpoint: normalizeEndpoint(config?.endpoint),
    authType: config?.authType,
    status: error?.status || error?.response?.status,
    statusText: error?.statusText || error?.response?.statusText,
    url: error?.url || error?.response?.url,
    method: error?.method,
    code: error?.code,
  };
  return buildError(`WebDAV ${operation} failed: ${message}`, details);
};

const handleWebdavInitialize = async (config) => {
  try {
    const client = buildWebdavClient(config);
    // Ensure the sync directory exists (e.g. /Netcatty/)
    // This is required for providers like Jianguoyun that don't allow
    // files at the WebDAV root.
    await ensureWebdavDir(client);
    const path = getWebdavPath();
    await client.exists(path);
    return { resourceId: path };
  } catch (error) {
    throw wrapWebdavError("initialize", error, config);
  }
};

const handleWebdavUpload = async (config, syncedFile) => {
  try {
    const client = buildWebdavClient(config);
    await ensureWebdavDir(client);
    const path = getWebdavPath();
    await client.putFileContents(path, JSON.stringify(syncedFile), { overwrite: true });
    return { resourceId: path };
  } catch (error) {
    throw wrapWebdavError("upload", error, config);
  }
};

const handleWebdavDownload = async (config) => {
  try {
    const client = buildWebdavClient(config);
    const path = getWebdavPath();
    const exists = await client.exists(path);
    if (!exists) return { syncedFile: null };
    const data = await client.getFileContents(path, { format: "text" });
    if (!data) return { syncedFile: null };
    return { syncedFile: JSON.parse(String(data)) };
  } catch (error) {
    throw wrapWebdavError("download", error, config);
  }
};

const handleWebdavDelete = async (config) => {
  try {
    const client = buildWebdavClient(config);
    const path = getWebdavPath();
    const exists = await client.exists(path);
    if (!exists) return { ok: true };
    await client.deleteFile(path);
    return { ok: true };
  } catch (error) {
    throw wrapWebdavError("delete", error, config);
  }
};

const registerHandlers = (ipcMain) => {
  ipcMain.handle("netcatty:cloudSync:webdav:initialize", async (_event, payload) => {
    return handleWebdavInitialize(payload?.config);
  });
  ipcMain.handle("netcatty:cloudSync:webdav:upload", async (_event, payload) => {
    return handleWebdavUpload(payload?.config, payload?.syncedFile);
  });
  ipcMain.handle("netcatty:cloudSync:webdav:download", async (_event, payload) => {
    return handleWebdavDownload(payload?.config);
  });
  ipcMain.handle("netcatty:cloudSync:webdav:delete", async (_event, payload) => {
    return handleWebdavDelete(payload?.config);
  });
};

module.exports = {
  registerHandlers,
  // Exposed for tests
  handleWebdavInitialize,
  buildBasicAuthHeader,
};
