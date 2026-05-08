---
inclusion: auto
description: 四层架构文件清单、Electron 主进程 bridge、应用生命周期
---

# 架构与分层指南

## Domain 层 (`domain/`)

纯函数和类型定义，零副作用。

| 文件 | 职责 |
|------|------|
| `models.ts` | 所有核心实体: Host, SSHKey, Identity, Snippet, Workspace, TerminalSession, PortForwardingRule, SftpConnection, TransferTask, ConnectionLog 等 |
| `host.ts` | 发行版归一化 (`normalizeDistroId`)、主机清洗 (`sanitizeHost`)、主机端口格式化 |
| `workspace.ts` | 工作区树操作: split/insert/prune/sizing、焦点导航 |
| `credentials.ts` | 凭证处理工具 |
| `groupConfig.ts` | 组配置继承逻辑 |
| `sshAuth.ts` | SSH 认证解析 (密码/密钥/证书) |
| `sshConfigSerializer.ts` | `~/.ssh/config` 解析与序列化 |
| `sync.ts` | WebDAV 云同步类型与常量（SyncPayload, WebDAVConfig, SyncedFile, 加密类型, SYNC_CONSTANTS） |
| `terminalAppearance.ts` | 终端主题解析 |
| `quickConnect.ts` | 快速连接字符串解析 |
| `vaultImport.ts` | Vault 数据导入工具 |

## Application 层 (`application/state/`)

React Hooks，拥有状态和持久化边界。

### 三大核心 Hook

1. **`useVaultState`** — 管理 hosts / keys / identities / snippets / customGroups / knownHosts / connectionLogs / managedSources，提供 CRUD 和导入导出
2. **`useSessionState`** — 管理终端会话、工作区、标签排序、广播模式、日志视图
3. **`useSettingsState`** — 管理主题、强调色、终端设置、快捷键、UI 语言、SFTP 设置

### 功能 Hook

| Hook | 职责 |
|------|------|
| `usePortForwardingState` | 端口转发规则 CRUD + 隧道启停 |
| `useAIState` | AI 提供商/模型/会话/权限管理 |
| `useSimpleSync` | WebDAV 云同步（简单推送/拉取，无自动同步） |
| `useManagedSourceSync` | SSH config 文件同步 |
| `usePortForwardingAutoStart` | 应用启动时自动启动端口转发 |
| `useUpdateCheck` | 应用更新检查 |
| `useGlobalHotkeys` | 全局键盘快捷键 |
| `useImmersiveMode` | 沉浸模式 (UI 色彩跟随终端主题) |

### SFTP 子系统 (`application/state/sftp/`)

| Hook | 职责 |
|------|------|
| `useSftpConnections` | 连接管理 (本地/远程) |
| `useSftpDirectoryListing` | 文件列表与缓存 |
| `useSftpTransfers` | 上传/下载/传输队列 |
| `useSftpTabsState` | 左右面板多标签状态 |
| `useSftpPaneActions` | 文件操作 (复制/剪切/粘贴/删除/重命名) |
| `useSftpFileWatch` | 文件监视与自动同步 |
| `useSftpExternalOperations` | 外部编辑器集成 |
| `sharedRemoteHostCache` | 跨面板共享连接缓存 |

### 外部 Store

- `activeTabStore.ts` — 活动标签 ID (非 React Context，支持跨组件订阅)，包含 `useIsScpActive` 用于 SCP 标签页
- `customThemeStore.ts` — 自定义终端主题
- `fontStore.ts` — 终端字体管理（仅显示 @fontsource 内置字体 + Local Font Access API 检测到的系统字体，`TERMINAL_FONTS` 硬编码列表仅用作元数据查找表）
- `uiFontStore.ts` — UI 字体管理

## Infrastructure 层 (`infrastructure/`)

### 配置 (`config/`)
- `storageKeys.ts` — 所有 localStorage 键常量
- `defaultData.ts` — 种子数据
- `terminalThemes.ts` — 内置终端主题 (20+)
- `uiThemes.ts` — UI 主题预设 (亮色/暗色各 5 套)
- `uiFonts.ts` / `fonts.ts` — 字体配置
- `i18n.ts` — 语言配置与 locale 解析

### 持久化 (`persistence/`)
- `localStorageAdapter.ts` — localStorage 读写抽象 (支持 JSON/String/Boolean/Number)
- `secureFieldAdapter.ts` — 敏感字段加解密

### 服务 (`services/`)
- `netcattyBridge.ts` — Electron IPC 桥接
- `portForwardingService.ts` — 端口转发隧道管理
- `EncryptionService.ts` — AES-256-GCM 加密（云同步数据加解密）
- `credentialProtection.ts` — OS 密钥链集成
- `updateService.ts` — 应用更新
- `compressUploadService.ts` — SFTP 压缩上传

### 云同步适配器 (`services/adapters/`)
- `WebDAVAdapter.ts` — WebDAV（同步文件存放在 `/Netcatty/` 子目录，兼容坚果云）— 唯一的同步适配器

### AI (`ai/`)
- `types.ts` — AI 类型定义 (ProviderConfig, ChatMessage, ToolCall, AISession 等)
- `managedAgents.ts` — 内置代理配置 (Claude/Codex/Copilot)
- `externalAgentAdapter.ts` — 外部 ACP 代理
- `cattyAgent/` — 内置 AI 代理 (executor, safety, systemPrompt)

## UI 层 (`components/`)

### 主视图
- `VaultView.tsx` — Vault 主界面 (主机/密钥/代码片段/已知主机)
- `SftpView.tsx` — SFTP 文件管理器 (也被 SCP 标签页复用，通过 `scpMode` prop 切换后端协议)
- `ScpView.tsx` — SCP 文件管理器 (薄 wrapper，渲染 `SftpView` 并传入 `scpMode`)
- `TerminalLayer.tsx` — 终端渲染层（`isVisible` 排除 vault/sftp/scp 标签页，侧边栏以 40px 活动栏常驻）
- `SettingsPage.tsx` — 设置界面
- `TopTabs.tsx` — 顶部标签栏

### 功能组件目录
- `components/ai/` — AI 聊天 UI
- `components/sftp/` — SFTP UI
- `components/terminal/` — 终端 UI (搜索/工具栏/认证对话框/主题编辑器)
- `components/port-forwarding/` — 端口转发 UI
- `components/keychain/` — 密钥管理 UI
- `components/host-details/` — 主机配置面板
- `components/settings/` — 设置标签页
- `components/vault/` — Vault 导入导出

### UI 组件库 (`components/ui/`)
基于 Radix UI 的可复用组件: button, dialog, input, select, tabs, popover, scroll-area, aside-panel, badge, spinner, toast, tooltip 等。

## Electron 主进程 (`electron/`)

### Bridge 模块 (`electron/bridges/`)
- `sshBridge.cjs` — SSH 连接与会话管理
- `sftpBridge.cjs` — SFTP 文件操作，同时支持 SCP 模式 (`useScp: true` 时通过 SSH exec 实现所有文件操作)
- `scpBridge.cjs` — 独立 SCP IPC handlers (备用，主要 SCP 功能已集成到 sftpBridge)
- `terminalBridge.cjs` — 本地 shell / Telnet / Mosh / 串口会话
- `portForwardingBridge.cjs` — SSH 端口转发隧道
- `transferBridge.cjs` — 文件传输进度管理
- `windowManager.cjs` — Electron 窗口管理 (主窗口/设置窗口/预热)
- `globalShortcutBridge.cjs` — 全局快捷键 (Quake 模式窗口切换)
- `aiBridge.cjs` — AI 代理进程管理 (ACP/Claude/Codex)
- `sessionLogStreamManager.cjs` — 实时会话日志流写入

### 应用生命周期 (`electron/main.cjs`)
- `before-quit`: 设置 `isQuitting` 标志
- `will-quit`: 同步清理 (terminal/port-forwarding/AI/SCP/globalShortcut) + 异步清理 (session log streams，带多层超时兜底)；`quitAndInstall` 时跳过异步延迟让 electron-updater 正常退出
- `window-all-closed`: 非 macOS 触发 `app.quit()`
- `windowStateCloseRequested` 在无 pending write 时自动重置，防止失败的退出尝试导致后续关闭被忽略
