---
inclusion: auto
description: 分层规则、命名约定、状态管理、退出生命周期、构建打包
---

# 编码规范与开发指南

## 分层规则

1. **Domain 层** — 只写纯函数和类型，禁止副作用、禁止 import React/localStorage/window
2. **Application 层** — Hook 拥有状态，通过 `localStorageAdapter` 持久化，通过 infrastructure 适配器做 I/O
3. **Infrastructure 层** — 封装外部依赖 (网络/存储/IPC)，暴露类型化函数
4. **UI 层** — 只消费 hook 输出和 handler，不直接调用 localStorage 或 domain 逻辑做持久化

## 命名约定

| 类别 | 规则 | 示例 |
|------|------|------|
| Hook | `use` 前缀 | `useVaultState`, `useSftpTransfers` |
| 组件 | PascalCase | `VaultView`, `HostDetailsPanel` |
| 常量 | UPPER_SNAKE_CASE | `STORAGE_KEY_HOSTS`, `DEFAULT_THEME` |
| 类型/接口 | PascalCase | `Host`, `TerminalSession`, `ProviderConfig` |
| 存储键 | `netcatty_` 前缀 + `_v1` 后缀 | `netcatty_hosts_v1` |

## 存储键管理

- 所有键定义在 `infrastructure/config/storageKeys.ts`
- 使用 `localStorageAdapter` 的类型化方法 (read/write/readString/writeString/readBoolean/writeBoolean/readNumber/writeNumber)
- 变更存储键或 schema 时必须提供迁移或向后兼容处理
- 禁止在组件中直接调用 `localStorage`

## 状态管理模式

- 使用 React hooks + 外部 store + localStorage 持久化
- 跨组件共享状态用外部 store (如 `activeTabStore`)，不用 React Context
- 状态更新创建新对象/数组 (不可变更新)
- 单例资源使用模块级引用计数 (如 `reconnectCancelListenerRefs`)
- 当同一组件需要多实例共存时 (如 SFTP/SCP 两个 SftpView)，模块级 store 需要通过 `createXxxStore()` 工厂函数 + React Context Provider 实现实例隔离，避免状态互相覆盖
- **跨实例本地文件同步**: SCP 和 SFTP 面板各自有独立的目录缓存。当一个面板修改本地文件（删除/创建/重命名/移动）后，通过 `window.dispatchEvent(new CustomEvent("netcatty:local-fs-changed", { detail: { dirPath } }))` 通知其他实例刷新同一目录。监听端在 `useSftpState` 中

## 组件设计

- 组件保持"哑"组件风格，props 列表过大时在 hook 中派生更小的 view model
- 使用 `Suspense` + `React.lazy` 做懒加载 (SFTP/Terminal/Settings)
- 侧面板统一使用 `AsidePanel` 设计系统 (`components/ui/aside-panel.tsx`)
- 对话框使用 Radix `Dialog` 组件

## 样式

- Tailwind CSS 4 utility-first
- UI 主题通过 CSS 变量 (HSL token) 注入 `:root`
- 终端主题独立于 UI 主题，支持每主机覆盖
- 沉浸模式: UI chrome 色彩从活动终端主题派生

## 国际化

- 使用 `useI18n()` hook 获取 `t()` 函数
- 键格式: `section.subsection.key`，如 `common.save`, `settings.tab.appearance`
- 插值: `t('key', { name: 'value' })`
- 新增语言: 在 `application/i18n/locales/` 添加字典，在 `messages.ts` 注册
- **所有新增 UI 文本必须使用 `t()` 翻译**，禁止硬编码英文字符串。新增 i18n 键时必须同时在 `en.ts` 和 `zh-CN.ts` 中添加对应翻译

## 临时文件

- 必须通过 `tempDirBridge.getTempFilePath(fileName)` 写入 Netcatty 专用临时目录
- 禁止直接写入 `os.tmpdir()`

## 安全

- 敏感字段 (密码/API Key) 通过 `secureFieldAdapter` 加密后存储
- OS 密钥链集成 (macOS Keychain / Windows Credential Manager / Linux Secret Service)
- AI 命令有黑名单和超时机制

## Electron 退出生命周期

退出流程: `app.quit()` → `before-quit` → 关闭所有窗口 → `will-quit` → 进程退出

关键注意事项:
- `before-quit` 中只设置 `isQuitting` 标志，不做 cleanup
- `will-quit` 中同步清理 (terminal/port-forwarding/AI/SCP/globalShortcut) 必须在异步清理之前完成
- 异步清理 (session log streams) 使用 `event.preventDefault()` + `app.exit(0)` 模式，带多层超时兜底（每个 stream 1s + 每个 stream Promise.race 1.5s + 外层 3s 硬超时）
- **`quitAndInstall` 时必须跳过异步延迟**：`will-quit` 检测 `isInstallingUpdate()` 标志，直接 return 让 electron-updater 的退出钩子正常执行，否则 `app.exit(0)` 会绕过更新安装
- `will-quit` 有 `willQuitHandled` 重入保护，防止清理期间收到 SIGTERM 再次触发
- 主窗口 close handler 在 `isQuitting` 为 true 时必须同步放行，禁止 `event.preventDefault()`
- `windowStateCloseRequested` 在无 `pendingWindowStateWrite` 时自动重置，防止失败的退出尝试导致后续关闭被忽略
- Settings 窗口在 `!isQuitting` 时 hide 而非 close (复用)，`isQuitting` 时正常关闭

## 构建与打包

```bash
npm run dev          # Vite + Electron 并行开发
npm run build        # Vite 构建
npm run pack:win     # Windows NSIS 安装包
npm run pack:mac     # macOS DMG + ZIP
npm run lint         # ESLint 检查
npm run lint:fix     # ESLint 自动修复
```

本 fork 仅构建 Windows 和 macOS，Linux 构建已从 CI 移除。
GitHub Actions workflow: `.github/workflows/release.yml`（tag push 或手动触发）。

## 路径别名

tsconfig.json 配置了 `@/*` → `./*` 路径别名，可在 import 中使用。

## 扩展指南

1. **新 domain 逻辑** → `domain/` 下添加纯函数/类型
2. **新状态行为** → `application/state/` 下添加 hook，I/O 走适配器
3. **新外部集成** → `infrastructure/services/` 或 `persistence/` 下添加适配器
4. **新 UI** → `components/` 下消费 hook 输出，不绕过状态 hook 做持久化或 domain 逻辑
