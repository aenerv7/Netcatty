---
inclusion: manual
description: 每个功能模块的实现位置索引表
---

# 功能模块地图

## 终端管理

| 功能 | 实现位置 |
|------|----------|
| 多会话终端 | `useSessionState` → `components/Terminal.tsx` → `components/TerminalLayer.tsx` |
| 工作区分割视图 | `domain/workspace.ts` → `useSessionState` (split/focus/prune) |
| 广播模式 | `useSessionState.toggleBroadcast` → `TerminalLayer` |
| 终端主题 | `infrastructure/config/terminalThemes.ts` + `customThemeStore`（设置页面 Terminal 标签页和主机详情面板可配置，终端侧边栏主题面板已移除） |
| 关键词高亮 | `domain/models.ts (KeywordHighlightRule)` → `TerminalSettings` |
| 本地终端 | `useSessionState.createLocalTerminal` (shell 发现 + node-pty) |
| 串口连接 | `useSessionState.createSerialSession` → `SerialConnectModal` |
| 会话日志 | `STORAGE_KEY_SESSION_LOGS_*` → 主进程 `sessionLogStreamManager` |
| 终端字体 | 默认 JetBrains Mono（@fontsource 内置），`fontStore.ts` 仅显示可用字体（内置 + 系统检测） |
| 终端侧边栏 | `TerminalLayer.tsx` 侧边栏仅两个标签：Scripts（Zap）和 AI Chat（MessageSquare），Theme/SFTP 面板已移除。侧边栏以 40px 宽的垂直活动栏形式常驻显示，点击标签展开面板 |
| 终端工具栏 | `TerminalToolbar.tsx` 溢出菜单（⋮）仅包含编码切换，SFTP/Scripts/Theme 菜单项已移除。主按钮区显示关键词高亮、输入栏、搜索、关闭 |

## 主机管理

| 功能 | 实现位置 |
|------|----------|
| 主机 CRUD | `useVaultState` → `VaultView` → `HostDetailsPanel` |
| 层级分组 | `Host.group` (路径格式 "A/B/C") → `HostTreeView` |
| 组配置继承 | `domain/groupConfig.ts` → `GroupDetailsPanel` |
| 快速连接 | `domain/quickConnect.ts` → `QuickConnectWizard` |
| 快速切换器 | `QuickSwitcher` (Cmd+J / Ctrl+J) |
| 发行版检测 | `domain/host.ts (normalizeDistroId)` → `DistroAvatar` |
| 跳板机链 | `Host.hostChain` → `components/host-details/ChainPanel.tsx` |
| 代理配置 | `Host.proxyConfig` → `components/host-details/ProxyPanel.tsx` |
| 托管源同步 | `useManagedSourceSync` (SSH config 文件) |

## SFTP 文件管理

| 功能 | 实现位置 |
|------|----------|
| 双面板浏览器 | `SftpView` → `useSftpTabsState` (左/右面板) |
| 文件操作 | `useSftpPaneActions` (复制/剪切/粘贴/删除/重命名) |
| 传输队列 | `useSftpTransfers` (并发管理/进度跟踪) |
| 压缩上传 | `infrastructure/services/compressUploadService.ts` |
| 文件监视 | `useSftpFileWatch` (自动同步) |
| 外部编辑器 | `useSftpExternalOperations` |
| 书签 | `Host.sftpBookmarks` + `STORAGE_KEY_SFTP_*_BOOKMARKS` |
| 编码支持 | `SftpPane.filenameEncoding` (UTF-8/GB18030/auto) |

## SCP 文件管理

SCP 复用 SFTP 的完整 UI，通过 `scpMode` prop 切换后端协议。适用于不支持 SFTP 子系统的设备。

| 功能 | 实现位置 |
|------|----------|
| SCP 模式适配器 | `electron/bridges/sftpBridge.cjs` (`createScpSftpChannel` / `createScpClientAdapter` — 模拟 SFTP channel API，底层走 SSH exec) |
| SCP 模式连接 | `sftpBridge.openSftp({ useScp: true })` → `openScpConnection()` (建立 SSH 连接，不打开 SFTP 子系统) |
| 独立 SCP bridge | `electron/bridges/scpBridge.cjs` (备用独立 IPC handlers) |
| SCP IPC 通道 | `electron/preload.cjs` (openScp/listScp/closeScp 等备用通道) |
| 活动标签 | `application/state/activeTabStore.ts` (`useIsScpActive`) |
| UI 复用 | `components/ScpView.tsx` → `SftpView` (传入 `scpMode` prop) |
| Store 隔离 | `SftpContext.tsx` (`createActiveTabStore` 工厂 + `ActiveTabStoreProvider` Context) |
| 标签页按钮 | `components/TopTabs.tsx` (Vaults / SFTP / SCP 三个固定标签，SCP 标签样式与 SFTP 一致) |
| 设置共享 | 设置页面 "SFTP & SCP" 标签页的所有设置（双击行为、自动同步、隐藏文件、压缩上传等）同时作用于 SFTP 和 SCP |
| useScp 传递链 | `SftpView` → `useSftpState(options.useScp)` → `useSftpConnections(useScp)` → `openSftp({ useScp })` |

## 密钥链

| 功能 | 实现位置 |
|------|----------|
| 密钥生成 | `components/keychain/GenerateStandardPanel.tsx` |
| 密钥导入 | `components/keychain/ImportKeyPanel.tsx` |
| 身份管理 | `Identity` 模型 → `components/keychain/IdentityPanel.tsx` |
| 安全存储 | `infrastructure/persistence/secureFieldAdapter.ts` |

## 端口转发

| 功能 | 实现位置 |
|------|----------|
| 规则 CRUD | `usePortForwardingState` → `PortForwardingNew` |
| 隧道管理 | `infrastructure/services/portForwardingService.ts` |
| 自动启动 | `usePortForwardingAutoStart` |
| 向导 | `components/port-forwarding/WizardContent.tsx` |

## AI 集成

| 功能 | 实现位置 |
|------|----------|
| 提供商管理 | `useAIState` → `components/settings/tabs/ai/` |
| 聊天界面 | `components/ai/ChatInput.tsx` + `ChatMessageList.tsx` |
| 流式响应 | `components/ai/hooks/useAIChatStreaming.ts` |
| 代理系统 | `infrastructure/ai/managedAgents.ts` + `externalAgentAdapter.ts` |
| 工具调用 | `infrastructure/ai/cattyAgent/executor.ts` |
| 权限控制 | `AIPermissionMode` + `HostAIPermission` |
| 对话导出 | `infrastructure/ai/conversationExport.ts` |

## 云同步

本 fork 彻底重写了云同步系统，移除了上游的多云同步架构（CloudSyncManager 状态机、三方合并、冲突检测、自动同步、设置页面同步标签页），替换为仅 WebDAV 的简单推送/拉取模式。

同步入口仅在右上角工具栏的云按钮（`SyncStatusButton`），不再有设置页面的同步配置。

| 功能 | 实现位置 |
|------|----------|
| 同步 Hook | `application/state/useSimpleSync.ts`（管理 WebDAV 配置、加密密码、push/pull 操作） |
| 同步 UI | `components/SyncStatusButton.tsx`（工具栏按钮 + Popover，未配置时显示 WebDAV 配置表单，已配置时显示推送/拉取按钮） |
| WebDAV 适配器 | `infrastructure/services/adapters/WebDAVAdapter.ts`（同步文件路径 `/Netcatty/netcatty-vault.json`） |
| 加密 | `infrastructure/services/EncryptionService.ts`（AES-256-GCM + PBKDF2） |
| 负载构建 | `application/syncPayload.ts`（`buildSyncPayload` 收集本地数据，`applySyncPayload` 应用远端数据） |
| 类型定义 | `domain/sync.ts`（SyncPayload, WebDAVConfig, SyncedFile 等） |

### 同步流程

- **首次配置**：用户在工具栏云按钮的 Popover 中填写 WebDAV 地址、认证信息和加密密码。连接后自动判断远端是否有数据：有则拉取覆盖本地，无则推送本地数据到远端。
- **推送（Push）**：用本地数据覆盖远端。调用 `buildSyncPayload` 收集所有 vault 数据和设置，通过 `EncryptionService.encryptPayload` 加密后上传到 WebDAV。
- **拉取（Pull）**：用远端数据覆盖本地。从 WebDAV 下载加密文件，通过 `EncryptionService.decryptPayload` 解密，然后调用 `applySyncPayload` 应用到本地状态。
- **无自动同步**：所有同步操作都由用户手动触发。
- **无合并**：推送和拉取都是完全覆盖，不做三方合并。

### 已删除的同步文件

以下文件已从项目中删除，上游同步时对这些文件的修改必须丢弃：
- `application/state/useAutoSync.ts` — 自动同步 hook
- `application/state/useCloudSync.ts` — 多云同步 React hook
- `domain/syncMerge.ts` — 三方合并逻辑
- `domain/syncGuards.ts` — shrink guard 防护
- `infrastructure/services/syncSignature.js` — 同步文件签名
- `infrastructure/services/syncAnchorDecision.js` — 远端变更检测
- `components/CloudSyncSettings.tsx` — 旧版同步设置 UI（2300+ 行）
- `components/settings/tabs/SettingsSyncTab.tsx` — 设置页面同步标签页
- `components/sync/SyncBlockedBanner.tsx` — 同步阻塞横幅

## 设置

| 功能 | 实现位置 |
|------|----------|
| 主题系统 | `useSettingsState` → `infrastructure/config/uiThemes.ts` |
| 终端外观 | `TerminalSettings` → `domain/terminalAppearance.ts` |
| 快捷键 | `KeyBinding` 模型 → `useGlobalHotkeys` |
| 沉浸模式 | `useImmersiveMode` |
| 自定义 CSS | `STORAGE_KEY_CUSTOM_CSS` |
| 应用更新 | `useUpdateCheck` → `infrastructure/services/updateService.ts` |

## UI 组件库 (`components/ui/`)

aside-panel, badge, button, card, collapsible, combobox, context-menu, dialog, dropdown, hover-card, input, input-group, label, popover, scroll-area, select, sort-dropdown, spinner, switch, tabs, tag-filter-dropdown, textarea, toast, tooltip

## 右上角工具栏 (`TopTabs.tsx`)

| 按钮 | 可见条件 | 实现 |
|------|----------|------|
| AI Assistant (Sparkles) | 非 Vaults 页 且 `STORAGE_KEY_AI_PROVIDERS` 中有配置 | `window.dispatchEvent('netcatty:toggle-ai-panel')` |
| Cloud Sync | 始终显示 | `SyncStatusButton` 组件（`useSimpleSync` hook，WebDAV 推送/拉取） |
| 侧边栏切换 | 已移除（侧边栏现在常驻显示为垂直活动栏） | — |
| 通知铃铛 | 已移除 | — |
| 亮暗色切换 | 已移除（仅在设置面板可用） | — |
