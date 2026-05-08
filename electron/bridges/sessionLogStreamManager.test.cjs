const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  appendData,
  startStream,
  stopStream,
} = require("./sessionLogStreamManager.cjs");

const TEMP_ROOT = path.join(__dirname, ".tmp-session-log-stream-tests");

test("txt stream live snapshots include pending ED2 cleared screens", async () => {
  const directory = path.join(TEMP_ROOT, `stream-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const sessionId = `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    startStream(sessionId, {
      hostLabel: "host",
      hostname: "host.example",
      directory,
      format: "txt",
      startTime: Date.UTC(2026, 0, 2, 3, 4, 5),
    });
    appendData(sessionId, "before tui\n\x1b[H\x1b[2Jframe one\n\x1b[H\x1b[2Jframe two\n");

    const filePath = await waitForFileContent(directory, "before tui\n\nframe one\n\nframe two");
    assert.equal(fs.readFileSync(filePath, "utf8"), "before tui\n\nframe one\n\nframe two");
  } finally {
    await stopStream(sessionId);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("txt stream finalization commits pending ED2 cleared screens", async () => {
  const directory = path.join(TEMP_ROOT, `stream-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const sessionId = `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    startStream(sessionId, {
      hostLabel: "host",
      hostname: "host.example",
      directory,
      format: "txt",
      startTime: Date.UTC(2026, 0, 2, 3, 4, 5),
    });
    appendData(sessionId, "before tui\n\x1b[H\x1b[2Jframe one\n\x1b[H\x1b[2Jframe two\n");

    const filePath = await stopStream(sessionId);

    assert.equal(fs.readFileSync(filePath, "utf8"), "before tui\n\nframe one\n\nframe two");
  } finally {
    await stopStream(sessionId);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

async function waitForFileContent(directory, expectedContent) {
  const deadline = Date.now() + 3000;
  let lastContent = "";

  while (Date.now() < deadline) {
    const filePath = findFirstTxtFile(directory);
    if (filePath && fs.existsSync(filePath)) {
      lastContent = fs.readFileSync(filePath, "utf8");
      if (lastContent === expectedContent) return filePath;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  assert.fail(`Timed out waiting for live snapshot content. Last content: ${JSON.stringify(lastContent)}`);
}

function findFirstTxtFile(directory) {
  if (!fs.existsSync(directory)) return null;
  for (const hostDirName of fs.readdirSync(directory)) {
    const hostDir = path.join(directory, hostDirName);
    if (!fs.statSync(hostDir).isDirectory()) continue;
    const fileName = fs.readdirSync(hostDir).find((name) => name.endsWith(".txt"));
    if (fileName) return path.join(hostDir, fileName);
  }
  return null;
}
