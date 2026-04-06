<p align="center">
  <img src="public/icon.png" alt="Netcatty" width="128" height="128">
</p>

<h1 align="center">Netcatty (Fork)</h1>

<p align="center">
  <strong>🔥 AI-Powered SSH Client, SFTP/SCP Browser & Terminal Manager 🚀</strong><br/>
  Forked from <a href="https://github.com/binaricat/Netcatty"><strong>binaricat/Netcatty</strong></a>
</p>

> **This is a fork of [binaricat/Netcatty](https://github.com/binaricat/Netcatty).**
> The upstream project is the original work — please star and support the original author at [ko-fi.com/binaricat](https://ko-fi.com/binaricat).
>
> This fork focuses on:
> - **SCP file management** — for devices that don't support the SFTP subsystem (SSH exec-based directory browsing + cat pipe transfers)
> - **Quality of Life fixes** — app quit hang fix, Electron lifecycle hardening, tray panel cleanup
> - **CI/CD** — GitHub Actions release workflow for Windows + macOS

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

## What's different in this fork

### SCP File Manager
For devices that don't support the SFTP subsystem (older routers, embedded systems, hardened servers), this fork adds a dedicated SCP tab that provides the same dual-pane file browser UI as SFTP, but uses SSH exec (`ls -la`) for directory listing and `cat` pipe for file transfers.

- Independent SCP tab in the top navigation bar (alongside Vaults and SFTP)
- 1:1 identical UI to SFTP — same file list, breadcrumb, toolbar, transfer queue
- SCP mode integrated into the SFTP backend via `useScp` flag — transparent to all UI components
- Module-level store isolation (`ActiveTabStoreProvider`) so SFTP and SCP tabs don't interfere

### Quality of Life Fixes
- **App quit hang fix** — tray panel window now destroyed in `before-quit` to prevent exit deadlock
- **Window state save during quit** — synchronous save path when `isQuitting` is true, no more `event.preventDefault()` blocking
- **Async cleanup timeout** — session log stream cleanup has a 3-second hard timeout to guarantee exit

### CI/CD
- GitHub Actions release workflow for Windows (NSIS x64+arm64) and macOS (DMG x64+arm64)
- Tag-triggered and manual dispatch support

---

*Everything below is from the upstream README.*

---

[![Netcatty Main Interface](screenshots/main-window-dark.png)](screenshots/main-window-dark.png)

---

<a name="catty-agent"></a>
# 🔥 Catty Agent — Your IT Ops AI Partner

> 🚀 **Boost your IT ops daily work with AI power.** Catty Agent is the built-in AI assistant that understands your servers, executes commands, and handles complex multi-host operations — all through natural conversation.

<p align="center">
  <img src="screenshots/ai-feature.png" alt="Catty Agent Interface" width="800">
</p>

### 🔥 What can Catty Agent do?

- 🚀 **Natural language server management** — just tell it what you need, no more memorizing commands
- 🔥 **Real-time server diagnostics** — check status, inspect logs, monitor resources through conversation
- 🚀 **Multi-host orchestration** — coordinate tasks across multiple servers simultaneously
- 🔥 **Intelligent context awareness** — understands your server environment and provides tailored responses
- 🚀 **One-click complex operations** — set up clusters, deploy services, and more with simple instructions

### 🎬 AI in Action

#### 🔥 Single Host — Intelligent Server Diagnostics

Ask Catty Agent to check a server's health, and it runs the right commands, analyzes the output, and gives you a clear summary — all in seconds.


https://github.com/user-attachments/assets/eecf08f1-80bd-49db-886d-b36e93388865




#### 🚀 Multi-Host — Docker Swarm Cluster Setup

Watch Catty Agent orchestrate a Docker Swarm cluster across two servers in one conversation. It handles the init, token exchange, and node joining — you just tell it what you want.



https://github.com/user-attachments/assets/282027aa-5c9e-4bb1-b2c3-5eea9df2b203



---

# Contents <!-- omit in toc -->

- [🔥 Catty Agent — AI Partner](#catty-agent)
- [What is Netcatty](#what-is-netcatty)
- [Why Netcatty](#why-netcatty)
- [Features](#features)
- [Demos](#demos)
- [Screenshots](#screenshots)
  - [Main Window](#main-window)
  - [Vault Views](#vault-views)
  - [Split Terminals](#split-terminals)
- [Supported Distros](#supported-distros)
- [Getting Started](#getting-started)
- [Build & Package](#build--package)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [Contributors](#contributors)
- [Star History](#star-history)
- [License](#license)

---

<a name="what-is-netcatty"></a>
# What is Netcatty

**Netcatty** is a modern SSH client and terminal manager for macOS, Windows, and Linux, designed for developers, sysadmins, and DevOps engineers who need to manage multiple remote servers efficiently.

- **Netcatty is** an alternative to PuTTY, Termius, SecureCRT, and macOS Terminal.app for SSH connections
- **Netcatty is** a powerful SFTP client with dual-pane file browser
- **Netcatty is** a terminal workspace with split panes, tabs, and session management
- **Netcatty supports** SSH, local terminal, Telnet, Mosh, and Serial connections (when available)
- **Netcatty is not** a shell replacement — it connects to shells via SSH/Telnet/Mosh or local/serial sessions

---

<a name="why-netcatty"></a>
# Why Netcatty

If you regularly work with a fleet of servers, Netcatty is built for speed and flow:

- **Workspace-first** — split panes + tabs + session restore for “always-on” workflows
- **Vault organization** — grid/list/tree views with fast search and drag-friendly workflows
- **Serious SFTP** — built-in editor + drag & drop + smooth file operations

---

<a name="features"></a>
# Features

### 🗂️ Vault
- **Multiple views** — grid / list / tree
- **Fast search** — locate hosts and groups quickly

### 🖥️ Terminal Workspaces
- **Split panes** — horizontal and vertical splits for multi-tasking
- **Session management** — run multiple connections side-by-side

### 📁 SFTP + Built-in Editor
- **File workflows** — drag & drop uploads/downloads
- **Edit in place** — built-in editor for quick changes

### 🎨 Personalization
- **Custom themes** — tune the app appearance to your taste
- **Keyword highlighting** — customize highlight rules for terminal output

---

<a name="demos"></a>
# Demos

Video previews (stored in `screenshots/gifs/`), rendered inline on GitHub:

### Vault views: grid / list / tree
Switch between different Vault views to match your workflow: overview in grid, dense scanning in list, and hierarchical navigation in tree.

https://github.com/user-attachments/assets/e2742987-3131-404d-bd4b-06423e5bfd99


### Split terminals + session management
Work in multiple sessions at once with split panes. Keep related tasks side-by-side and reduce context switching.

https://github.com/user-attachments/assets/377d0c46-cc5a-4382-aa31-5acfd412ce62



### SFTP: drag & drop + built-in editor
Move files with drag & drop, then edit quickly using the built-in editor without leaving the app.

https://github.com/user-attachments/assets/c6e06af4-b0d5-461c-b0c7-9d6f655af6c7





### Drag file upload
Drop files into the app to kick off uploads without hunting through dialogs.

https://github.com/user-attachments/assets/c8e0c4ff-f020-4e18-9b09-681ec97b003f




### Custom themes
Make Netcatty yours: customize themes and UI appearance.

https://github.com/user-attachments/assets/77e2a693-4ef2-4823-8ca1-9bcbf14ed98b




### Keyword highlighting
Highlight important terminal output so errors, warnings, and key events stand out at a glance.

https://github.com/user-attachments/assets/e6516993-ad66-4594-8c28-57426082339b




---

<a name="screenshots"></a>
# Screenshots

<a name="main-window"></a>
## Main Window

The main window is designed for long-running SSH workflows: quick access to sessions, navigation, and core tools in one place.

![Main Window (Dark)](screenshots/main-window-dark.png)

![Main Window (Light)](screenshots/main-window-light.png)

<a name="vault-views"></a>
## Vault Views

Organize and navigate your hosts using the view that best fits the moment: grid for overview, list for scanning, tree for structure.

![Vault Grid View](screenshots/vault_grid_view.png)

![Vault List View](screenshots/vault_list_view.png)

![Vault Tree View (Dark)](screenshots/treeview-dark.png)

![Vault Tree View (Light)](screenshots/treeview-light.png)

<a name="split-terminals"></a>
## Split Terminals

Split panes help you monitor multiple servers/services at the same time (deploy + logs + metrics) without juggling windows.

![Split Windows](screenshots/split-window.png)

---

<a name="supported-distros"></a>
# Supported Distros

Netcatty automatically detects and displays OS icons for connected hosts:

<p align="center">
  <img src="public/distro/ubuntu.svg" width="48" alt="Ubuntu" title="Ubuntu">
  <img src="public/distro/debian.svg" width="48" alt="Debian" title="Debian">
  <img src="public/distro/centos.svg" width="48" alt="CentOS" title="CentOS">
  <img src="public/distro/fedora.svg" width="48" alt="Fedora" title="Fedora">
  <img src="public/distro/arch.svg" width="48" alt="Arch Linux" title="Arch Linux">
  <img src="public/distro/alpine.svg" width="48" alt="Alpine" title="Alpine">
  <img src="public/distro/amazon.svg" width="48" alt="Amazon Linux" title="Amazon Linux">
  <img src="public/distro/redhat.svg" width="48" alt="Red Hat" title="Red Hat">
  <img src="public/distro/rocky.svg" width="48" alt="Rocky Linux" title="Rocky Linux">
  <img src="public/distro/opensuse.svg" width="48" alt="openSUSE" title="openSUSE">
  <img src="public/distro/oracle.svg" width="48" alt="Oracle Linux" title="Oracle Linux">
  <img src="public/distro/kali.svg" width="48" alt="Kali Linux" title="Kali Linux">
  <img src="public/distro/almalinux.svg" width="48" alt="AlmaLinux" title="AlmaLinux">
</p>

<a name="getting-started"></a>
# Getting Started

### Download

Download the latest release for your platform from [GitHub Releases](https://github.com/binaricat/Netcatty/releases/latest).

| OS | Support |
| :--- | :--- |
| **macOS** | Universal (x64 / arm64) |
| **Windows** | x64 / arm64 |
| **Linux** | x64 / arm64 |

Or browse all releases at [GitHub Releases](https://github.com/binaricat/Netcatty/releases).

> **macOS Users:** Current releases are expected to be code-signed and notarized. If Gatekeeper still warns, make sure you downloaded the latest official build from GitHub Releases.

### Prerequisites
- Node.js 18+ and npm
- macOS, Windows 10+, or Linux

### Development

```bash
# Clone the repository
git clone https://github.com/binaricat/Netcatty.git
cd Netcatty

# Install dependencies
npm install

# Start development mode (Vite + Electron)
npm run dev
```

### Project Structure

```
├── App.tsx                 # Main React application
├── components/             # React components
│   ├── Terminal.tsx        # Terminal component
│   ├── SftpView.tsx        # SFTP browser
│   ├── VaultView.tsx       # Host management
│   ├── KeyManager.tsx      # SSH key management
│   └── ...
├── application/            # State management & i18n
├── domain/                 # Domain models & logic
├── infrastructure/         # Services & adapters
├── electron/               # Electron main process
│   ├── main.cjs            # Main entry
│   └── bridges/            # IPC bridges
└── public/                 # Static assets & icons
```

---

<a name="build--package"></a>
# Build & Package

```bash
# Build for production
npm run build

# Package for current platform
npm run pack

# Package for specific platforms
npm run pack:mac     # macOS (DMG + ZIP)
npm run pack:win     # Windows (NSIS installer)
npm run pack:linux   # Linux (AppImage + DEB + RPM)
```

---

<a name="tech-stack"></a>
# Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Electron 40 |
| Frontend | React 19, TypeScript |
| Build Tool | Vite 7 |
| Terminal | xterm.js 5 |
| Styling | Tailwind CSS 4 |
| SSH/SFTP | ssh2, ssh2-sftp-client |
| PTY | node-pty |
| Icons | Lucide React |

---

<a name="contributing"></a>
# Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [agents.md](agents.md) for architecture overview and coding conventions.

---

<a name="contributors"></a>
# Contributors

Thanks to all the people who contribute!

<a href="https://github.com/binaricat/Netcatty/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=binaricat/Netcatty" />
</a>

---

<a name="license"></a>
# License

This project is licensed under the **GPL-3.0 License** - see the [LICENSE](LICENSE) file for details.

---

<a name="star-history"></a>
# Star History

<a href="https://star-history.com/#binaricat/Netcatty&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=binaricat/Netcatty&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=binaricat/Netcatty&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=binaricat/Netcatty&type=Date" />
 </picture>
</a>

---

<p align="center">
  Made with ❤️ by <a href="https://ko-fi.com/binaricat">binaricat</a>
</p>
