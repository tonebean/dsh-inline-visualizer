# diagram.md — 图表 / 示意图模块

> 适用：流程图、结构图、关系图、概念图、示意图。**须与 `_core.md` 同时加载。**

---

## 1. SVG 设置规则

- `viewBox` 固定为 `"0 0 680 H"`，**680 不可改**（所有坐标以此推算）。
- 根 `<svg>` 加 `width="100%"`。
- **H 的计算**：`H = 最底部元素的 y + 其高度 + 20`。**不得估**。
- **安全区**：`x ∈ [40, 640]`，`y ∈ [40, H-40]`。背景保持透明。
- 每次调用只画一个 SVG。
- 禁止旋转文字。
- 连接线与箭头**必须** `fill="none"`（写在 `style` 里）。
- 颜色/描边一律写进 `style`：`style="fill: var(--viz-blue-100)"`；写 `fill="var(--viz-blue-100)"` 无效。

## 2. 箭头 marker 模板（每个 SVG 的 `<defs>` 必含）

```svg
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5"
    markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M2 1L8 5L2 9" style="fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round"/>
  </marker>
</defs>
```

> 用 `stroke: currentColor`，让箭头颜色跟随引用它的连线（给连线设 `style="color: var(--viz-text-tertiary)"`）。若宿主不支持 `context-stroke`，这是唯一可靠写法。

## 3. 节点规格

- 同内容类型的节点高度统一：**单行 44px，双行 56px**。
- 盒内留白 24px；文字与边距 12px。
- 每个盒内 `<text>` 需 `dominant-baseline="central"`。
- **盒宽公式**：`rect_width = max(标题字数 × 7, 副标题字数 × 6) + 24`（字号 14/13 时）。

```svg
<g>
  <rect x="100" y="20" width="200" height="56" rx="12"
        style="fill: var(--viz-blue-100); stroke: var(--viz-blue-500); stroke-width: 0.5"/>
  <text x="200" y="38" text-anchor="middle" dominant-baseline="central"
        style="font-size: 14px; font-weight: 500; fill: var(--viz-blue-700)">节点标题</text>
  <text x="200" y="56" text-anchor="middle" dominant-baseline="central"
        style="font-size: 13px; fill: var(--viz-blue-500)">一行副标题</text>
</g>
```

## 4. 布局

- 盒间距 **≥ 60px**；容器内边距 **≥ 20px**。
- 优先**单向**流动，单图 **≤ 4–5 个节点**。
- 同级横向最多 **4 个盒**（各约 140px 宽）。
- **循环不画成环**：改用 HTML 步进器（stepper），仅当「全图一进一出」时才用带回折箭头的线性 SVG。

## 5. 三类子型

| 子型 | 用于 | 要点 |
|---|---|---|
| **流程图** | 时序、因果、决策 | 单向为主，盒高统一 |
| **结构图** | 物理/逻辑包含关系 | 最外层大圆角容器（rx 20–24），内层中圆角（rx 8–12），≤ 3 层嵌套 |
| **示意图** | 建立直觉、空间隐喻 | 抽象主体虚构空间隐喻；**颜色编码强度而非类别** |

> 数据库 / ER 图用 mermaid `erDiagram`，**不要用 SVG 硬画**。

## 6. 尺寸校准参考

| 文本 | 字数 | 字重 | 字号 | 渲染宽度 |
|---|---|---|---|---|
| 标题 | 12 | 500 | 14px | ≈88px |
| 副标题 | 16 | 400 | 13px | ≈104px |
| 正文 | 24 | 400 | 13px | ≈156px |
| 说明 | 20 | 400 | 12px | ≈120px |
