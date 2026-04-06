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
| 终端主题 | `infrastructure/config/terminalThemes.ts` + `customThemeStore` |
| 关键词高亮 | `domain/models.ts (KeywordHighlightRule)` → `TerminalSettings` |
| 本地终端 | `useSessionState.createLocalTerminal` (shell 发现 + node-pty) |
| 串口连接 | `useSessionState.createSerialSession` → `SerialConnectModal` |
| 会话日志 | `STORAGE_KEY_SESSION_LOGS_*` → 主进程 `sessionLogStreamManager` |

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
| 标签页按钮 | `components/TopTabs.tsx` (Vaults / SFTP / SCP 三个固定标签) |
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

本 fork 仅保留 WebDAV 和 S3，GitHub Gist / Google Drive / OneDrive 在 UI 层隐藏（代码保留）。

| 功能 | 实现位置 |
|------|----------|
| 同步编排 | `infrastructure/services/CloudSyncManager.ts` |
| WebDAV | `infrastructure/services/adapters/WebDAVAdapter.ts` + `electron/bridges/cloudSyncBridge.cjs`（同步文件路径 `/Netcatty/netcatty-vault.json`） |
| S3 | `infrastructure/services/adapters/S3Adapter.ts` + `electron/bridges/cloudSyncBridge.cjs` |
| 加密 | `infrastructure/services/EncryptionService.ts` |
| 负载合并 | `domain/syncMerge.ts` |
| 自动同步顺序 | `useAutoSync.ts` (`AUTO_SYNC_PROVIDER_ORDER: ['webdav', 's3']`) |
| UI 隐藏 | `CloudSyncSettings.tsx` (GitHub/Google/OneDrive 的 ProviderCard 已注释) |

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
| Cloud Sync | 始终显示 | `SyncStatusButton` 组件 |
| 通知铃铛 | 已移除 | — |
| 亮暗色切换 | 已移除（仅在设置面板可用） | — |
