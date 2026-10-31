# chart.md — 数据图表模块

> 适用：柱状图、折线图、饼图、散点图等数据可视化。**须与 `_core.md` 同时加载。**

---

## 1. 技术选型

- **一律手写原生 SVG**（`<rect>` / `<path>` / `<polyline>` / `<circle>` + `<text>`）。
- **不要引入 Chart.js / D3 / ECharts**：SVG 分支是 data-URI 图片，脚本不执行、也不发网络请求，引了也不会跑。
- 画布宽度固定 680（`viewBox="0 0 680 H"`），高度按数据行数算好写死，不要指望自动量高。
- 需要交互（tooltip、图例开关）时不走 SVG，改用 `interactive` 的 HTML 分支，由你自己的 `<script>` 手写。

## 2. 配色规则

- 数据系列颜色**从调色板取**（蓝 / 青 / 绿 / 琥珀 / 珊瑚 / 紫轮转），用 `var(--viz-{hue}-{level})`。
- **语义色优先**：上升/正向用红或绿需**跟随业务语境**（例如中国股市：涨红跌绿），不要默认西方配色。
- 单图**系列数 ≤ 6**，超出则改用表格。
- **禁止渐变填充**，一律纯色或半透明纯色。

## 3. 坐标轴与标签

- 轴标签字号 **≥ 11px**，颜色用 `var(--viz-text-secondary)`。
- 网格线用 `var(--viz-border-subtle)`，**0.5px**。
- 数据标签（数值）仅在**点少**（≤ 12）时显示，避免拥挤。
- 单位放轴标题或顶部副标题，不要每个点都重复。

## 4. 主题跟随

- 坐标轴、刻度、网格、标题一律用**语义令牌**（`--viz-text-*` / `--viz-border-*`），它们随主题自动解析，不需要写两份。
- 数据系列用的**色阶是绝对色卡**：若同一张图要在深浅两套主题下都保持可读，按 `_core.md` §5 用 `[data-viz-theme="dark"]` 分支各写一份（浅色用 50/500 档，深色用 300/900 档）。
- 深色模式下禁止使用浅色描边系列。

## 5. 可读性

- 标题写在同一 `<h2>` 或容器顶部，**不要**用图内大标题重复正文。
- 数据点密集时降低采样或改用面积图，不要叠加多个高密度折线。
- 饼图**扇区 ≤ 6**，否则改用条形图。

## 6. 手绘骨架（柱状图）

```html
<svg viewBox="0 0 680 260" width="100%" role="img">
  <title>季度营收</title><desc>四个季度的营收柱状图，Q3 最高。</desc>
  <line x1="60" y1="210" x2="640" y2="210" style="stroke: var(--viz-border-default); stroke-width: 1"/>
  <rect x="100" y="120" width="70" height="90" rx="3" style="fill: var(--viz-blue-500)"/>
  <text x="135" y="228" text-anchor="middle" font-size="11" style="fill: var(--viz-text-secondary)">Q1</text>
  <text x="135" y="110" text-anchor="middle" font-size="11" style="fill: var(--viz-text-primary)">120</text>
</svg>
```
