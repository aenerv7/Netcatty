const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createTerminalTextRenderer,
  terminalDataToPlainText,
} = require("./terminalLogSanitizer.cjs");
const { terminalDataToHtml } = require("./sessionLogsBridge.cjs");

test("plain text rendering applies backspace edits", () => {
  assert.equal(terminalDataToPlainText("hellp\bo\n"), "hello");
});

test("plain text rendering applies carriage-return overwrites", () => {
  assert.equal(terminalDataToPlainText("progress 10%\rprogress 100%\n"), "progress 100%");
});

test("plain text rendering applies erase-line controls", () => {
  assert.equal(terminalDataToPlainText("loading...\r\x1b[Kdone\n"), "done");
});

test("erase display from carriage return preserves overwrite semantics", () => {
  assert.equal(terminalDataToPlainText("progress 10%\r\x1b[Jprogress 20%\n"), "progress 20%");
});

test("stateful renderer handles CSI sequences split across chunks", () => {
  const renderer = createTerminalTextRenderer();
  renderer.feed("red \x1b[");
  renderer.feed("31mtext\x1b[0m\n");
  assert.equal(renderer.finish(), "red text");
});

test("plain text rendering removes OSC payloads", () => {
  assert.equal(terminalDataToPlainText("before\x1b]0;secret title\x07after\n"), "beforeafter");
});

test("HTML rendering escapes content and strips terminal controls", () => {
  const html = terminalDataToHtml("a < b\x1b[31m & c\x1b[0m\r\x1b[Kdone\n", "host<1>", 0);
  assert.equal(html.includes("\x1b"), false);
  assert.equal(html.includes("[31m"), false);
  assert.equal(html.includes("done"), true);
  assert.equal(html.includes("a &lt; b"), false);
  assert.equal(html.includes("host&lt;1&gt;"), true);
});

test("display clear preserves prior log history", () => {
  assert.equal(
    terminalDataToPlainText("login banner\n$ tmux\n\x1b[H\x1b[2Jtmux pane\n"),
    "login banner\n$ tmux\n\ntmux pane",
  );
});

test("ED3 after ED2 does not add a duplicate log separator", () => {
  assert.equal(
    terminalDataToPlainText("login banner\n$ clear\n\x1b[H\x1b[2J\x1b[3Jafter clear\n"),
    "login banner\n$ clear\n\nafter clear",
  );
});

test("cursor home after display clear stays within the new log screen", () => {
  assert.equal(
    terminalDataToPlainText("old1\nold2\n\x1b[2J\x1b[Hnew\n"),
    "old1\nold2\n\nnew",
  );
});

test("erase display backward after full clear preserves prior log history", () => {
  assert.equal(
    terminalDataToPlainText("old\n\x1b[2Jnew\x1b[1Jafter\n"),
    "old\n\n   after",
  );
});

test("clear from home preserves prior log history", () => {
  assert.equal(
    terminalDataToPlainText("before zellij\n$ zellij\n\x1b[H\x1b[Jzellij pane\n"),
    "before zellij\n$ zellij\n\nzellij pane",
  );
});

test("home clear repaint updates current preserved screen instead of appending frames", () => {
  assert.equal(
    terminalDataToPlainText("before tui\n\x1b[H\x1b[Jframe one\n\x1b[H\x1b[Jframe two\n"),
    "before tui\n\nframe two",
  );
});

test("home ED2 preserves cleared screens even without ED3", () => {
  assert.equal(
    terminalDataToPlainText("before tui\n\x1b[H\x1b[2Jframe one\n\x1b[H\x1b[2Jframe two\n"),
    "before tui\n\nframe one\n\nframe two",
  );
});

test("repeated ED2 preserves cleared screens even without ED3", () => {
  assert.equal(
    terminalDataToPlainText("before tui\n\x1b[2Jframe one\r\x1b[2Jframe two\n"),
    "before tui\n\nframe one\n\nframe two",
  );
});

test("redundant ED2 keeps pending cleared screen when current screen is empty", () => {
  assert.equal(
    terminalDataToPlainText("before\n\x1b[2Jfirst\x1b[2J\x1b[2Jsecond\n"),
    "before\n\nfirst\n\n     second",
  );
});

test("home ED2 preserves each cleared shell frame without ED3", () => {
  assert.equal(
    terminalDataToPlainText("before\n\x1b[H\x1b[2Jone\n\x1b[H\x1b[2Jtwo\n"),
    "before\n\none\n\ntwo",
  );
});

test("home ED2 repaint does not accumulate every intermediate frame", () => {
  assert.equal(
    terminalDataToPlainText("before tui\n\x1b[H\x1b[2Jframe one\n\x1b[H\x1b[2Jframe two\n\x1b[H\x1b[2Jframe three\n"),
    "before tui\n\nframe two\n\nframe three",
  );
});

test("committing pending ED2 preserves cursor movement before printable output", () => {
  assert.equal(
    terminalDataToPlainText("before\n\x1b[H\x1b[2Jone\n\x1b[2J\x1b[10;5Htext\n"),
    "before\n\none\n\n\n\n\n\n\n\n\n\n\n    text",
  );
});

test("pending ED2 snapshot rendering does not mutate repaint state", () => {
  const renderer = createTerminalTextRenderer();
  renderer.feed("before tui\n\x1b[H\x1b[2Jframe one\n\x1b[H\x1b[2Jframe two\n");
  assert.equal(
    renderer.toString({ includePendingClearedScreen: true }),
    "before tui\n\nframe one\n\nframe two",
  );

  renderer.feed("\x1b[H\x1b[2Jframe three\n");
  assert.equal(renderer.finish(), "before tui\n\nframe two\n\nframe three");
});

test("later shell clear preserves intervening screen output", () => {
  assert.equal(
    terminalDataToPlainText("before\n\x1b[H\x1b[2Jfirst screen\n\x1b[H\x1b[2J\x1b[3Jsecond screen\n"),
    "before\n\nfirst screen\n\nsecond screen",
  );
});

test("standalone ED3 preserves current visible screen", () => {
  assert.equal(
    terminalDataToPlainText("before\n\x1b[H\x1b[2Jscreen\n\x1b[3Jafter\n"),
    "before\n\nscreen\nafter",
  );
});
