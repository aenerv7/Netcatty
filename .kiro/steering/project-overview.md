---
inclusion: auto
description: 项目定位、技术栈、三层架构、关键入口、持久化、Fork 差异
---

# Netcatty 项目概览

## 项目定位
Netcatty 是一个基于 Electron + React + TypeScript 的现代 SSH 管理器和终端应用，支持 macOS / Windows 两端（本 fork 精简了 Linux 构建）。核心功能包括：主机管理、终端会话、SFTP 文件管理、SCP 文件管理、密钥链、端口转发、AI 辅助、云同步（仅 WebDAV 和 S3）。

## 技术栈
- 前端: React 19 + TypeScript 5.9 + Tailwind CSS 4
- 桌面: Electron 40
- 构建: Vite 7 + electron-builder
- UI 组件: Radix UI (无样式基础组件)
- 终端: xterm.js 6 (WebGL 渲染)
- SSH/SFTP: ssh2 + node-pty
- AI: Vercel AI SDK 6 (OpenAI / Anthropic / Google)
- 编辑器: Monaco Editor

## 三层架构

```
domain/          纯逻辑层 — 模型定义、纯函数，无副作用
application/     应用状态层 — React Hooks，管理状态与持久化边界
infrastructure/  基础设施层 — 外部 I/O、配置、服务适配器
components/      UI 层 — 展示组件，仅消费 hooks 输出
```

调用方向: UI → application hooks → domain helpers → infrastructure adapters

## 关键入口
- `App.tsx` — 根组件，组装所有 hooks 并传递给子组件
- `AppWithProviders()` — 最外层，包裹 I18nProvider + ToastProvider
- `useSettingsState` → `useVaultState` → `useSessionState` 是三大核心状态 hook

## 持久化
- 所有 localStorage 操作通过 `infrastructure/persistence/localStorageAdapter.ts`
- 存储键集中在 `infrastructure/config/storageKeys.ts`，带 `_v1` 版本后缀
- 敏感字段（密码、API Key）通过 `secureFieldAdapter.ts` 加解密

## 国际化
- 自定义 React Context 方案 (`application/i18n/I18nProvider.tsx`)
- 支持 `en` / `zh-CN`，消息字典在 `application/i18n/locales/`
- 使用 `t('key', { var })` 插值

## 本 Fork 与上游的差异

本项目 fork 自 [binaricat/Netcatty](https://github.com/binaricat/Netcatty)，主要改动：
- 新增 SCP 文件管理（复用 SFTP UI，后端走 SSH exec）
- 云同步仅保留 WebDAV 和 S3（UI 层隐藏了 GitHub Gist / Google Drive / OneDrive）
- WebDAV 同步文件存放在 `/Netcatty/` 子目录（兼容坚果云等不允许根目录操作的服务）
- 彻底移除系统托盘（tray icon、tray panel、close-to-tray）及所有相关 IPC / UI / i18n / 存储键
- 彻底移除客户端终端自动补全系统（fig autocomplete、ghost text、popup menu），Tab 键完全由远端 shell 处理
- 修复 macOS 自动更新点击重启无反应：`will-quit` 的 `event.preventDefault()` + `app.exit(0)` 会绕过 electron-updater 的退出生命周期钩子，现在 `quitAndInstall` 时跳过异步清理延迟
- 修复 macOS 退出偶尔卡死：session log stream 的 `writeStream.end()` 回调可能不触发，增加了多层超时防护和 `will-quit` 重入保护
- 修复连接进度条抖动：模拟定时器与跳板链回调竞争导致进度回滚，改为单调递增 + 降低定时器增速
- 修复 SCP 与 SFTP 面板本地文件不同步：通过 `netcatty:local-fs-changed` 自定义事件跨实例通知刷新
- 右上角工具栏精简：移除了通知铃铛和亮暗色切换按钮，AI 按钮仅在有配置时显示
- Vault 页面移除了"新建本地 Terminal"按钮（`onCreateLocalTerminal`），仅保留 Serial 按钮
- 构建仅保留 Windows (NSIS) 和 macOS (DMG)，移除 Linux
- 所有 repo URL 指向 `aenerv7/Netcatty`（更新检查、electron-builder publish、设置页链接等）

## 上游同步规则

从上游 `binaricat/Netcatty` 同步代码时，必须遵守以下规则：

1. **Tag 版本号必须与上游一致**：本项目不自行递增版本号。所有 `v*` tag 必须与上游 `binaricat/Netcatty` 的 tag 保持一致。只有在同步上游新版本后，才使用上游对应的版本号打 tag 触发构建。禁止创建上游不存在的版本号 tag。
2. **同步版本号 tag**：每次同步上游后，将上游最新的 `v*` tag 同步到 origin，但 tag 必须指向本项目 merge 后的 commit（即我们自己的 main HEAD），而不是上游的原始 commit。直接推送上游 tag 会导致 CI 使用上游的 workflow 文件构建，从而失败。
3. **只保留本项目的 Workflow**：`.github/workflows/` 下只使用本项目自己的 workflow 文件。如果上游同步引入了新的或修改过的 workflow 文件，必须丢弃上游的改动，保留本项目版本。
4. **不加入代码签名**：本项目没有签名证书。workflow 中必须保留 "Disable code signing and notarization" 步骤，并设置 `CSC_IDENTITY_AUTO_DISCOVERY: "false"`。如果上游引入了签名/公证相关配置，不要合入。
5. **构建触发方式**：只通过打 `v*` tag 的方式触发构建，不使用 `workflow_dispatch`。
6. **package-lock.json 合并**：不要直接 `git checkout upstream/main -- package-lock.json`。本 fork 的 `package.json` 比上游多了 `@types/react` 和 `@types/react-dom` 等 devDependencies，直接替换 lock 文件会导致 `npm ci` 因不匹配而失败。正确做法是让 git merge 自动处理，如有冲突则运行 `npm install --package-lock-only` 重新生成。
7. **已移除功能的冲突处理**：上游对系统托盘（tray）和客户端自动补全（autocomplete）的修改必须丢弃（`git checkout --ours`），因为本 fork 已彻底移除这些功能。合并时注意检查 `globalShortcutBridge.cjs`、`windowManager.cjs`、`Terminal.tsx` 中的相关冲突。
8. **合并后必须检查 TS 类型**：运行 `npx tsc --noEmit` 确认无运行时会崩溃的类型错误（如引用未声明的变量）。Vite 构建不做类型检查，TS 错误不会阻止打包但会导致运行时白屏。

## Electron IPC
- 渲染进程通过 `window.netcatty` 桥接主进程
- 封装在 `infrastructure/services/netcattyBridge.ts`
- 主进程代码在 `electron/` 目录（CJS 格式）
