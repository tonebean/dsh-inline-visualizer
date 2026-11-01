# Changelog

## 2.0.1 — 2026-10-31

### 修复

- HTML 可渲染校验正则只匹配单字母标签，导致只含 `<div>`、`<button>`、`<h2>` 等标签的片段被误判为“没有可渲染的元素”。改为按完整标签名匹配，并补充回归测试。

### 文档与测试

- docs: 修正 README 中主题行、profile 路径、包体大小与测试数量等过时描述。
- docs: 新增 `docs/test-cases/` —— 5 个设计模块、两条渲染路径、安全净化与参数校验共 30 个用例，含 24 张截图和 205 项冒烟测试报告。

## 2.0.0 — 首个公开发行版

面向 **DSH 0.2.1-rc.5** 重做，目标是可安装、可上架、可维护。

### 兼容性

- 重新核对宿主挂点：`tool.call.toolview` keyed slot、`defineTool` 参数 DSL、`window.__ModuleLoader__.load()`、`ctx.theme`、`ctx.locale`、`dsh.client.immediately`。
- `engines.dsh` / `peerDependencies` 声明为 `>=0.2.1-rc.5 <0.3.0`。

### 变更

- 去掉 `private`，补齐 `files` / `exports` / `main` 之外的分发字段，可 `npm publish`。
- 新增 `locale/en.json`、`locale/zh.json` 与 `icon.svg`；卡片内所有可见文案改走 `ctx.locale`，不再硬编码。
- 主题来源改为文档化入口 `ctx.theme.getTheme().colorScheme` + `theme/change`，删除对 `data-ds-dark-theme`、body 背景色等宿主内部实现的探测；主题切换时卡片会重建而非停在旧配色。
- 语义令牌改映射到 `--dsw-alias-*` 真实变量；取不到时回退内置浅/深值，不会变黑图。
- `apply(ctx, config)` 支持 `maxCodeChars`（1000–1,000,000）。
- 删除未经验证的 Chart.js/CDN 指引，图表模块改为手写原生 SVG。
- 自测从 145 项扩到 196 项（Part C 开启时 204 项）：新增真实 `defineTool` schema 编译、打包与发布要求、命名一致性检查。

### 包名

- 由 `dsh-visualizer` 更名为 **`dsh-inline-visualizer`**（原名在 npm 已被占用）。
