# interactive.md — 交互组件模块

> 适用：可点击、可切换、带状态的可交互 HTML 组件（步进器、切换器、迷你计算器等）。**须与 `_core.md` 同时加载。**

---

## 1. 运行环境约束（重要）

- 组件运行在**沙箱 iframe**（`sandbox="allow-scripts"`）中，**无 `allow-same-origin`**。
- 因此组件**不能**访问宿主 DOM、cookie、localStorage、sessionStorage。
- **网络请求被 CSP 拦截**，只有白名单 CDN（cdnjs / jsdelivr / unpkg / esm.sh）的脚本与样式可加载。
- **高度上报由宿主自动完成**：宿主已注入 `ResizeObserver` + `postMessage` 桥。**不要**自己写高度上报逻辑，也不要尝试与宿主通信。
- 令牌：宿主的 `--viz-*` 已注入到本 iframe 的 `:root`，直接用 `var(--viz-*)` 即可。

## 2. 状态管理

- 状态**完全自包含**，不依赖外部变量，也不做持久化（刷新即重置是预期行为）。
- 用最小机制实现：`<details>` / `<input type=checkbox>` + CSS，或少量原生 JS。
- 组件卸载后不得残留定时器；如用 `setInterval`，须可停止（宿主会在卡片移除时丢弃整个 iframe，但仍不要留忙循环）。

## 3. 流式友好

- **优先内联 `style`**，避免依赖 `<style>` 块尚未解析完成时的样式缺失。
- `<script>` 放**最后**，确保 DOM 已就绪。
- 初始化逻辑用 `DOMContentLoaded` 或直接置于末尾。

## 4. 交互反馈

- 所有可交互元素必须有 **hover** 与 **focus-visible** 反馈。
- 键盘可达：使用语义标签（`<button>`、`<input>`、`<details>`），不要用 `div` 冒充按钮。
- 过渡动画限 `transform` / `opacity`，时长 < 200ms，并包在 `@media (prefers-reduced-motion: no-preference)` 中。

## 5. 无障碍

- 以视觉隐藏 `<h2 class="sr-only">` 开头，一句话说明组件用途。
- 交互控件需有可读标签（`aria-label` 或可见 `<label>`）。
- 状态变化用 `aria-live` 播报（如适用）。
