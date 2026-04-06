---
inclusion: auto
---

# Netcatty 项目概览

## 项目定位
Netcatty 是一个基于 Electron + React + TypeScript 的现代 SSH 管理器和终端应用，支持 macOS / Windows / Linux 三端。核心功能包括：主机管理、终端会话、SFTP 文件管理、SCP 文件管理、密钥链、端口转发、AI 辅助、云同步。

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

## Electron IPC
- 渲染进程通过 `window.netcatty` 桥接主进程
- 封装在 `infrastructure/services/netcattyBridge.ts`
- 主进程代码在 `electron/` 目录（CJS 格式）
