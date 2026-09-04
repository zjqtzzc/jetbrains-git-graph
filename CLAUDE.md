# Claude Code 项目指南

## 项目结构

```
src/                    扩展主机 (TypeScript + Node.js)
  ├── extension.ts        入口文件，命令注册 & MessageRouter 处理器
  ├── git/                Git CLI 封装 (gitService, graphLayout, types)
  ├── messages/           通信协议 (protocol, messageRouter)
  └── views/              Webview 管理器 (mergeEditorManager, conflictsManager, diffEditorManager, html)
webview/                Webview 前端 (React 19 + Vite)
  └── src/
      ├── panel/          Git Log 面板 (Graph, CommitList, BranchTree, DetailPanel)
      ├── conflicts/      冲突列表页 + 三方合并编辑器
      ├── shared/         共享模块 (bridge, store, hooks, components, theme)
      └── main.tsx        路由入口 (模式: panel | merge | conflicts)
```

## 代码规范

### 格式化与 Lint

- 格式化/Lint 工具：`biome check`（配置见 biome.json）
- 发布前必须通过 `pnpm run compile`（check-types + lint + esbuild）

### 技术栈

- **扩展主机**：TypeScript, Node.js, child_process (execFile), esbuild
- **Webview**：React 19, Zustand, allotment, @tanstack/react-virtual, shiki, diff, node-diff3
- **通信方式**：postMessage 请求-响应 + 事件广播 (MessageRouter)
- **图形渲染**：SVG + DOM（非 Canvas）
- **包管理器**：pnpm（monorepo，pnpm-workspace.yaml）

### 关键设计决策

- 直接调用 Git CLI（不使用 simple-git），自定义 `\x00` 分隔符解析
- 自研图形布局算法（贪心车道分配 + LaneSnapshot）
- 三方合并使用 node-diff3，二方 diff 使用 diff 库
- 所有 Webview 共用单一 MessageRouter 架构
- Bridge 协议需在 `webview/src/shared/bridge/types.ts` 与 `src/messages/protocol.ts` 之间保持同步

### 版本锁定

- 不要主动升级 React 或 Vite 版本

## 构建命令

```bash
pnpm run compile          # 扩展：check-types + lint + esbuild
pnpm run build:web        # Webview：tsc + vite build
pnpm run build            # 以上两者
pnpm run watch            # 开发模式（esbuild + tsc + vite 并行 watch）
pnpm run package          # 生产构建（用于 vsce publish）
```
