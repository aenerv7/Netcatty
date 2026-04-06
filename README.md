<p align="center">
  <img src="public/icon.png" alt="Netcatty" width="128" height="128">
</p>

<h1 align="center">Netcatty (Fork)</h1>

<p align="center">
  <strong>SSH Client, SFTP/SCP Browser & Terminal Manager</strong><br/>
  Forked from <a href="https://github.com/binaricat/Netcatty"><strong>binaricat/Netcatty</strong></a>
</p>

> **This is a fork of [binaricat/Netcatty](https://github.com/binaricat/Netcatty).**
> The upstream project is the original work — please star and support the original author at [ko-fi.com/binaricat](https://ko-fi.com/binaricat).
>
> This fork adds SCP support, quality-of-life fixes, and streamlined builds for Windows and macOS.

<p align="center">
  <a href="https://github.com/aenerv7/Netcatty/releases/latest"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/aenerv7/Netcatty?style=for-the-badge&logo=github&label=Release"></a>
  &nbsp;
  <a href="https://github.com/binaricat/Netcatty"><img alt="Upstream" src="https://img.shields.io/badge/Upstream-binaricat%2FNetcatty-blue?style=for-the-badge&logo=github"></a>
  &nbsp;
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-GPL--3.0-green?style=for-the-badge"></a>
</p>

<p align="center">
  <a href="https://github.com/aenerv7/Netcatty/releases/latest">
    <img src="https://img.shields.io/github/v/release/aenerv7/Netcatty?style=for-the-badge&logo=github&label=Download%20Latest&color=success" alt="Download Latest Release">
  </a>
</p>

---

## Download

| OS | Architecture | Format |
| :--- | :--- | :--- |
| **Windows** | x64 / arm64 | NSIS installer (.exe) |
| **macOS** | Apple Silicon / Intel | DMG |

Download from [GitHub Releases](https://github.com/aenerv7/Netcatty/releases/latest).

> **macOS users:** This fork's releases are not code-signed. On first launch you may need to right-click → Open, or allow it in System Settings → Privacy & Security.

---

## What's different in this fork

### SCP File Manager

For devices that don't support the SFTP subsystem (older routers, embedded systems, hardened servers), this fork adds a dedicated **SCP** tab with the same dual-pane file browser UI as SFTP.

- Directory listing via SSH exec (`ls -la`)
- File transfers via `cat` pipe
- File operations (mkdir, rm, mv, chmod) via SSH exec
- Independent SCP tab in the top navigation bar alongside Vaults and SFTP
- 1:1 identical UI to SFTP — same file list, breadcrumb, toolbar, transfer queue
- Left pane defaults to Local, right pane connects to remote hosts

### Cloud Sync

- Removed GitHub Gist, Google Drive, and OneDrive sync providers
- Only **WebDAV** and **S3** are available
- WebDAV: sync file stored in `/Netcatty/` subdirectory (fixes 404 on providers like Jianguoyun that don't allow files at WebDAV root)

### App Quit Fix

The upstream version has a bug where clicking "Quit" from the system tray often fails to exit the app. This fork fixes it:

- Tray panel window destroyed before `app.quit()` to prevent exit deadlock
- Synchronous window state save during quit — no more `event.preventDefault()` blocking
- Session log stream cleanup with 3-second hard timeout to guarantee exit

### UI Tweaks

- Toolbar cleaned up: removed notification bell and theme toggle buttons
- AI assistant button only shown when providers are configured and not on Vaults page
- Cloud Sync button moved to last position in toolbar

---

## For upstream features

For the full feature list (AI Agent, split terminals, vault views, SFTP, custom themes, port forwarding, keychain, etc.), see the [upstream README](https://github.com/binaricat/Netcatty).

---

## License

GPL-3.0 — see [LICENSE](LICENSE).
