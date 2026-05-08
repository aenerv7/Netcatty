const test = require("node:test");
const assert = require("node:assert/strict");

const { createTelnetAutoLogin } = require("./telnetAutoLogin.cjs");

test("telnet auto-login sends saved username and password for split prompts", () => {
  const writes = [];
  const autoLogin = createTelnetAutoLogin({
    username: "admin",
    password: "secret",
    write: (data) => writes.push(data),
  });

  autoLogin.handleText("\x1b[32mUser");
  autoLogin.handleText("name:\x1b[0m ");
  autoLogin.handleText("\r\nPass");
  autoLogin.handleText("word: ");

  assert.deepEqual(writes, ["admin\r", "secret\r"]);
});

test("telnet auto-login completes only after a command prompt appears", () => {
  const writes = [];
  let completeCount = 0;
  const autoLogin = createTelnetAutoLogin({
    username: "admin",
    password: "secret",
    write: (data) => writes.push(data),
    onComplete: () => { completeCount += 1; },
  });

  autoLogin.handleText("Username: ");
  autoLogin.handleText("\r\nPassword: ");

  assert.deepEqual(writes, ["admin\r", "secret\r"]);
  assert.equal(completeCount, 0);

  autoLogin.handleText("\r\nWelcome\r\nrouter# ");
  autoLogin.handleText("\r\nrouter# ");

  assert.equal(completeCount, 1);
});

test("telnet auto-login does not complete username-only login until the prompt appears", () => {
  const writes = [];
  let completed = false;
  const autoLogin = createTelnetAutoLogin({
    username: "admin",
    write: (data) => writes.push(data),
    onComplete: () => { completed = true; },
  });

  autoLogin.handleText("Username: ");

  assert.deepEqual(writes, ["admin\r"]);
  assert.equal(completed, false);

  autoLogin.handleText("\r\nrouter> ");

  assert.equal(completed, true);
});

test("telnet auto-login completes when a password-ready host only asks for username", () => {
  const writes = [];
  let completed = false;
  const autoLogin = createTelnetAutoLogin({
    username: "admin",
    password: "secret",
    write: (data) => writes.push(data),
    onComplete: () => { completed = true; },
  });

  autoLogin.handleText("Username: ");
  autoLogin.handleText("\r\nrouter# ");

  assert.deepEqual(writes, ["admin\r"]);
  assert.equal(completed, true);
});

test("telnet auto-login sends username before password when prompts arrive together", () => {
  const writes = [];
  const autoLogin = createTelnetAutoLogin({
    username: "admin",
    password: "secret",
    write: (data) => writes.push(data),
  });

  autoLogin.handleText("Username: \r\nPassword: ");

  assert.deepEqual(writes, ["admin\r", "secret\r"]);
});

test("telnet auto-login supports password-only prompts", () => {
  const writes = [];
  const autoLogin = createTelnetAutoLogin({
    password: "line-password",
    write: (data) => writes.push(data),
  });

  autoLogin.handleText("Password: ");

  assert.deepEqual(writes, ["line-password\r"]);
});

test("telnet auto-login sends a blank username before a saved password", () => {
  const writes = [];
  const autoLogin = createTelnetAutoLogin({
    username: "",
    password: "line-password",
    write: (data) => writes.push(data),
  });

  autoLogin.handleText("Username: ");
  autoLogin.handleText("\r\nPassword: ");

  assert.deepEqual(writes, ["\r", "line-password\r"]);
});

test("telnet auto-login sends an intentionally blank password", () => {
  const writes = [];
  const autoLogin = createTelnetAutoLogin({
    username: "admin",
    password: "",
    write: (data) => writes.push(data),
  });

  autoLogin.handleText("Username: ");
  autoLogin.handleText("\r\nPassword: ");

  assert.deepEqual(writes, ["admin\r", "\r"]);
});

test("telnet auto-login wakes devices that ask for return before login", () => {
  const writes = [];
  const autoLogin = createTelnetAutoLogin({
    username: "admin",
    password: "secret",
    write: (data) => writes.push(data),
  });

  autoLogin.handleText("Press RETURN to get started.");
  autoLogin.handleText("\r\nrouter login: ");
  autoLogin.handleText("\r\nPassword: ");

  assert.deepEqual(writes, ["\r", "admin\r", "secret\r"]);
});

test("telnet auto-login wakes devices that ask for bracketed enter", () => {
  const writes = [];
  const autoLogin = createTelnetAutoLogin({
    username: "admin",
    password: "secret",
    write: (data) => writes.push(data),
  });

  autoLogin.handleText("Press <ENTER> to continue");
  autoLogin.handleText("\r\nUsername: ");
  autoLogin.handleText("\r\nPassword: ");

  assert.deepEqual(writes, ["\r", "admin\r", "secret\r"]);
});

test("telnet auto-login wakes devices that ask for square-bracketed enter", () => {
  const writes = [];
  const autoLogin = createTelnetAutoLogin({
    username: "admin",
    password: "secret",
    write: (data) => writes.push(data),
  });

  autoLogin.handleText("Press [Enter] to continue");
  autoLogin.handleText("\r\nUsername: ");
  autoLogin.handleText("\r\nPassword: ");

  assert.deepEqual(writes, ["\r", "admin\r", "secret\r"]);
});

test("telnet auto-login handles prompts concatenated after wake banners", () => {
  const writes = [];
  const autoLogin = createTelnetAutoLogin({
    username: "admin",
    password: "secret",
    write: (data) => writes.push(data),
  });

  autoLogin.handleText("Press RETURN to get started.");
  autoLogin.handleText("Username: ");
  autoLogin.handleText("\r\nPassword: ");

  assert.deepEqual(writes, ["\r", "admin\r", "secret\r"]);
});

test("telnet auto-login handles wake banners concatenated with preceding text", () => {
  const writes = [];
  const autoLogin = createTelnetAutoLogin({
    username: "admin",
    password: "secret",
    write: (data) => writes.push(data),
  });

  autoLogin.handleText("Netcatty local Telnet test servicePress RETURN to get started.");
  autoLogin.handleText("Username: ");
  autoLogin.handleText("\r\nPassword: ");

  assert.deepEqual(writes, ["\r", "admin\r", "secret\r"]);
});

test("telnet auto-login stops when the user starts typing manually", () => {
  const writes = [];
  let cancelCount = 0;
  const autoLogin = createTelnetAutoLogin({
    username: "admin",
    password: "secret",
    write: (data) => writes.push(data),
    onUserInput: () => { cancelCount += 1; },
  });

  autoLogin.handleUserInput();
  autoLogin.handleUserInput();
  autoLogin.handleText("Username: ");
  autoLogin.handleText("Password: ");

  assert.deepEqual(writes, []);
  assert.equal(cancelCount, 1);
});

test("telnet auto-login avoids common non-prompt login text", () => {
  const writes = [];
  const autoLogin = createTelnetAutoLogin({
    username: "admin",
    password: "secret",
    write: (data) => writes.push(data),
  });

  autoLogin.handleText("Last login:");

  assert.deepEqual(writes, []);
});
