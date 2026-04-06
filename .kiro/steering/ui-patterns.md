---
inclusion: manual
description: AsidePanel 设计系统、对话框、Toast、懒加载、主题系统用法
---

# UI 模式与组件指南

## AsidePanel 设计系统

VaultView 子页面共享统一的侧面板设计系统，组件在 `components/ui/aside-panel.tsx`。

### 基本用法

```tsx
import { AsidePanel, AsidePanelContent, AsidePanelFooter, AsideActionMenu, AsideActionMenuItem } from "./ui/aside-panel";

<AsidePanel
  open={isOpen}
  onClose={handleClose}
  title="面板标题"
  subtitle="可选副标题"
  showBackButton={true}       // 子面板返回导航
  onBack={handleBack}
  actions={                   // 可选操作菜单
    <AsideActionMenu>
      <AsideActionMenuItem onClick={handleDuplicate}>
        <Copy size={14} className="mr-2" /> 复制
      </AsideActionMenuItem>
      <AsideActionMenuItem variant="destructive" onClick={handleDelete}>
        <Trash2 size={14} className="mr-2" /> 删除
      </AsideActionMenuItem>
    </AsideActionMenu>
  }
>
  <AsidePanelContent>
    {/* 可滚动内容 */}
  </AsidePanelContent>
  <AsidePanelFooter>
    <Button className="w-full">保存</Button>
  </AsidePanelFooter>
</AsidePanel>
```

### 关键规则
- `title` prop 提供时自动渲染 header，不要在内部再用 `AsidePanelHeader`
- 父容器必须有 `relative` 定位
- 面板使用 `absolute` 定位 (`right-0 top-0 bottom-0`)
- 默认宽度 `w-[380px]`，可通过 `width` prop 配置
- z-index: `z-30`

### 面板导航模式
- 主面板: X 关闭按钮
- 子面板: ← 返回 + X 关闭
- 使用面板栈状态管理嵌套导航: `panelStack: PanelMode[]`

## 标签导航

- 活动标签由 `activeTabStore` 管理 (外部 store)
- 标签类型: 孤立会话 / 工作区 / vault / sftp / scp / 日志视图
- 固定标签: Vaults, SFTP, SCP (始终显示在左侧)
- 标签排序可持久化和重排
- 快速切换器: Cmd+J / Ctrl+J

## 对话框

使用 Radix `Dialog` 组件:

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>标题</DialogTitle>
    </DialogHeader>
    {/* 内容 */}
    <DialogFooter>
      <Button variant="ghost" onClick={onCancel}>取消</Button>
      <Button onClick={onConfirm}>确认</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Toast 通知

```tsx
import { toast } from './ui/toast';

toast.info('消息内容', { title: '标题', duration: 5000 });
toast.error('错误消息');
toast.warning('警告', { actionLabel: '操作', onClick: handler });
```

## 懒加载模式

大型组件使用 `React.lazy` + `Suspense`:

```tsx
const LazyComponent = React.lazy(() => import('./HeavyComponent'));

<Suspense fallback={null}>
  <LazyComponent {...props} />
</Suspense>
```

已懒加载的组件: QuickSwitcher, CreateWorkspaceDialog, ProtocolSelectDialog, LogView, SftpView, ScpView, TerminalLayer

## 多实例 Store 隔离

当同一组件需要多实例共存时（如 SFTP 和 SCP 各自渲染一个 SftpView），模块级单例 store 会互相覆盖。解决方案：

1. 将 store 改为工厂函数: `createActiveTabStore()` 返回独立实例
2. 通过 React Context Provider 注入: `<ActiveTabStoreProvider value={scpStore}>`
3. 子组件通过 `useContext` 获取当前实例，而非直接引用模块级单例
4. 默认实例保持向后兼容（SFTP 用默认单例，SCP 用工厂创建的新实例）

已隔离的 store:
- `SftpContext.activeTabStore` — 左右面板内部 tab ID（通过 `createActiveTabStore` + `ActiveTabStoreProvider`）

天然隔离的 store（按 paneId 索引）:
- `useSftpTreeSelectionStore` / `useSftpListOrderStore` — 按 paneId 键值存储，不同实例的 paneId 不同

共享但无冲突的 store:
- `sftpFocusStore` / `sftpClipboard` / `sftpDialogAction` — 瞬态交互状态，同一时间只有一个标签页可见

## 可见性优化

非活动标签使用 CSS 隐藏而非卸载，保持状态:

```tsx
const containerStyle: React.CSSProperties = isVisible
  ? {}
  : { visibility: 'hidden', pointerEvents: 'none', position: 'absolute', zIndex: -1 };
```

## 主题系统

### UI 主题
- 亮色: Snow, Pure White, Ivory, Latte, Cream
- 暗色: Midnight, Slate, Charcoal, Obsidian, Dracula
- 通过 HSL CSS 变量注入 `:root`

### 终端主题
- 20+ 内置主题 + 自定义主题编辑器
- 支持每主机覆盖
- 沉浸模式: UI chrome 色彩从活动终端主题派生

### 强调色
- 模式: `theme` (跟随 UI 主题) 或 `custom` (自定义 HSL)

## 工具栏按钮可见性

右上角工具栏按钮根据上下文条件显示/隐藏：
- AI 按钮: 从 `localStorageAdapter` 读取 `STORAGE_KEY_AI_PROVIDERS`，有配置且非 Vaults 页时显示
- 亮暗色切换: 已移除（沉浸模式下无效，统一在设置面板操作）
- 通知铃铛: 已移除（无实际通知系统）
- Cloud Sync: 始终显示
