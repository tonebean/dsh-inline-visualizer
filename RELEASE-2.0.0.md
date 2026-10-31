# dsh-inline-visualizer 2.0.0

首个公开发行版。面向 **DeepSeek Harness 0.2.1-rc.5** 重做，目标可安装、可上架、可维护。

## 安装

```sh
dsh plugin --profile web add github:tonebean/dsh-inline-visualizer
```

或从本地目录：`dsh plugin --profile web add /path/to/dsh-inline-visualizer`

## 这次做了什么

**两个工具**：`widget_guidelines`（按需加载设计契约，首行带当前主题）与 `show_widget`（就地渲染卡片，只回一句 ack）。图走旁路进 UI，**不进模型上下文**。

**渲染**：SVG 走 `data:` URI 的 `<img>`（矢量、不执行脚本）；HTML 走 `sandbox="allow-scripts"` 的不透明源 iframe + `default-src 'none'` CSP。

**主题**：只用文档化入口 `ctx.theme.getTheme().colorScheme` + `theme/change`，语义令牌映射到 `--dsw-alias-*`；不再探测 `data-ds-dark-theme`、body 背景色等宿主内部实现。

**文案**：全部走插件自己的 `ctx.locale` 命名空间，中英双语；`locale/*.json` 同时提供 `meta.title` / `meta.description`，`icon.svg` 自绘。

**分发**：去掉 `private`，补齐 `files` / `exports` / `engines.dsh` / `repository`，`npm pack` 21 个文件 50.9 kB。

**自测**：`npm test` → **204 项断言**，含用真实 `dsh-tools` 编译工具 schema（`DSH_TOOLS_ENTRY` 指向宿主里的 `lib/types/schema.js` 时启用）。

## 破坏性变更

包名由 `dsh-visualizer` 改为 **`dsh-inline-visualizer`**（原名在 npm 已被占用）。工具名、参数、卡片行为不变。

## 已知限制

- 不做流式逐字渲染、不做光栅化、不解析 Mermaid、不内置图表库。
- 净化是正则级；HTML 分支只剩 CSP 一道防线。
- 无真实浏览器 E2E（测试用假 React + 假 DOM）。

完整变更见 `CHANGELOG.md`。
