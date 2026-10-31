# _core.md — 通用设计规范（所有模块共用）

> 本文件是 `widget_guidelines` 的**必载部分**。任何模块被请求时，都先附上本文件，再附模块文件。
>
> **令牌命名空间：`--viz-*`。** 只允许引用本文件 §1/§2 定义的令牌，不要假设宿主存在别的变量名（宿主的真实变量名由渲染器的映射层解析，见 `guidelines/HOST-TOKENS.md`）。

---

## 0. 设计原则

- **无缝**：用户不应看出宿主 UI 与图之间的分界。
- **扁平**：不使用渐变、噪点、投影、模糊、光晕。只用纯色平面。
- **克制**：图内只放必要信息，解释留给正文。
- **职责分离**：**说明文字写在回复正文里，不写进图里**；工具产物只含视觉元素本身。

---

## 1. 设计令牌契约

宿主需向卡片提供下列 `--viz-*` 变量。**这些令牌已经按宿主当前主题解析完毕**，随主题自动变化——直接使用，不要为它们各写一份浅色/深色版本。

| 类别 | 令牌 | 说明 |
|---|---|---|
| 表面 | `--viz-bg-primary` / `--viz-bg-secondary` / `--viz-bg-tertiary` | 最亮面 / 表面 / 页面底 |
| 文字 | `--viz-text-primary` / `--viz-text-secondary` / `--viz-text-tertiary` | 主 / 弱化 / 提示 |
| 边框 | `--viz-border-subtle` / `--viz-border-default` / `--viz-border-strong` | 约 0.15α / 0.3α / 0.4α |
| 语义 | `--viz-info` / `--viz-success` / `--viz-warning` / `--viz-danger` | 对应蓝 / 绿 / 琥珀 / 红 |
| 字体 | `--viz-font-sans` / `--viz-font-serif` / `--viz-font-mono` | 字族 |
| 圆角 | `--viz-radius-sm` 8px / `--viz-radius-md` 12px / `--viz-radius-lg` 16px | 小件 / 卡片 / 容器 |

### 1.1 颜色必须写在 CSS 属性里，不能写在表现属性里

```svg
<!-- ✗ 无效：表现属性不解析 var()，会回退成黑色 -->
<rect fill="var(--viz-blue-100)" stroke="var(--viz-blue-500)"/>

<!-- ✓ 有效：走 style（CSS 属性） -->
<rect style="fill: var(--viz-blue-100); stroke: var(--viz-blue-500); stroke-width: 0.5"/>
```

同理，字体、圆角、描边宽度也一律走 `style="..."` 或 `<style>` 块。

---

## 2. 调色板

8 个色系 × 6 级，**同时以令牌形式提供**：`--viz-{hue}-{level}`，hue ∈ `neutral` / `blue` / `teal` / `green` / `amber` / `coral` / `red` / `purple`。

```html
<div style="background: var(--viz-blue-50); border: 0.5px solid var(--viz-blue-500)">…</div>
```

**级别语义固定**：

| 级别 | 用途 |
|---|---|
| 50 | 最浅填充（容器底） |
| 100 | 浅填充（卡片、节点） |
| 300 | 中间调（深色模式描边） |
| 500 | 强调 / 描边 |
| 700 | 浅底上的标题文字 |
| 900 | 深底上的文字 / 深色模式填充 |

**hex 参考值**（下表仅用于：① 宿主未提供调色板令牌时的降级；② 校验视觉效果。**日常生成请用上面的令牌**）：

| 色系 | 50 | 100 | 300 | 500 | 700 | 900 |
|---|---|---|---|---|---|---|
| 中性 | #F7F7F6 | #EDEDEB | #C6C6C2 | #8B8B86 | #4A4A47 | #232322 |
| 蓝 | #EEF5FD | #CFE3F9 | #8FB8E8 | #3B7DD8 | #1E4E96 | #12305C |
| 青 | #E9F6F2 | #C2E7DC | #7FC9B4 | #1F9E7E | #106552 | #0A3D33 |
| 绿 | #EFF6E8 | #D2E6BE | #9BC46F | #5E9427 | #3A6016 | #233C0D |
| 琥珀 | #FDF3E2 | #F7DEB0 | #EFB35B | #C1811B | #7E530F | #4C3309 |
| 珊瑚 | #FCEEE9 | #F6CDBE | #EE9C7C | #D45E33 | #8A3C20 | #542514 |
| 红 | #FBECEC | #F4C4C4 | #E88E8E | #D04545 | #872B2B | #521A1A |
| 紫 | #F1EEFC | #D6CDF5 | #A99BE4 | #7259CE | #4A3985 | #2D2351 |

**选色速查**：

- 第一优先：用 §1 的**语义令牌**（`--viz-bg-*` / `--viz-text-*` / `--viz-border-*` / `--viz-info` 等）——自动跟随主题。
- 需要具体色相时：浅色模式用 50 填充 + 500 描边 + 700 标题；深色模式用 900 填充 + 300 描边 + 100 标题，并**按主题属性分支**（写法见 §5）。

**复杂度预算**：单图 ≤ 2 个色系（语义色不计入）。

---

## 3. 排版

- 尺寸阶：**h1 16 / h2 14 / h3 13 / body 13 / caption 12**。**下限 11px，不得更小。**
- 字重**仅两档**：400（常规）与 500（强调）。禁止 600/700。
- 正文行高 1.6。
- 字族用 `var(--viz-font-sans)` / `var(--viz-font-mono)`，不要写死字体名。
- **句式**：一律句首大写，不使用全大写，不使用 Title Case。

---

## 4. 间距与描边

- 间距阶：4 / 8 / 12 / 16 / 24 / 32。
- 圆角：容器 `--viz-radius-lg`，卡片 `--viz-radius-md`，小件 `--viz-radius-sm`。
- 描边：容器与边框 **0.5px**；连接线与箭头 **1.5px**。

---

## 5. 主题

宿主当前主题通过**两条互相对应的通道**暴露：

- **模型侧**：`widget_guidelines` 返回值的首行给出 `当前主题: light` 或 `当前主题: dark`。
- **渲染侧**：卡片元素与 iframe 内的 `<html>` 都带 `data-viz-theme="light|dark"`。

规则：

- **首选**：只用 §1 的语义令牌 → 自动跟随主题，**不需要任何分支**。
- **兜底**：需要指定某个色相级别（如 `--viz-blue-100`）时，按属性分支，**两份都写**（浅色一份 + `[data-viz-theme="dark"]` 一份）。语义令牌会在切换主题时由渲染端重建刷新，但**你写死的具体色阶不会自己翻转**；两份都写则由属性自动切换，代价只有几行 CSS（当前主题见返回值首行，用它决定哪一份是「主」配色）：

  ```html
  <style>
    .flow-01-card { background: var(--viz-blue-50); }
    [data-viz-theme="dark"] .flow-01-card { background: var(--viz-blue-900); }
  </style>
  ```

  内联 SVG 中，`[data-viz-theme=…]` 由卡片容器携带，因此上面这种「祖先选择器 + 类名」的写法可用；类名请带图名前缀（如 `.flow-01-card`）避免与同页其他图冲突。

- 浅色模式下**禁止**大面积深色背景；深色模式反之。

---

## 6. 技术约束（硬性）

- **禁止** `<!-- 注释 -->` 与 `/* 注释 */`（浪费 token 且打断流式输出）。
- **禁止** 渐变、投影、模糊、光晕、霓虹。唯一例外见 `art.md`（最多一个 `<linearGradient>`）。
- **禁止** emoji —— 用几何图形或 SVG 路径表达。
- **禁止** `position: fixed`。
- 片段**不得**包含 `<!DOCTYPE>` / `<html>` / `<head>` / `<body>`。
- SVG 的 `viewBox` **固定宽度 680**（`viewBox="0 0 680 H"`），根元素加 `width="100%"`，并带 `role="img"`。
- **HTML 片段的运行环境**：`sandbox="allow-scripts"` 的**不透明源** iframe。
  - 不能访问宿主 DOM / cookie / localStorage；沙箱**不提供** `allow-same-origin`。
  - 网络被宿主的 CSP 限制在白名单 CDN（cdnjs / jsdelivr / unpkg / esm.sh），其余请求一律被拦截。
  - **高度上报由宿主注入的桥自动完成**，不要自己写 `postMessage` 高度逻辑，也不要尝试与宿主通信。
- **流式友好**：先输出 `<style>`（保持简短）→ 内容 → `<script>`（放最后）；表单控件优先**内联** `style`，以保证流式中途即正确。
- **不要依赖外部库**：SVG 分支是 data-URI 图片，**不执行脚本、不发网络请求**；HTML 分支虽放行白名单 CDN，但该路径**未经验证**，默认一律用原生 SVG / 原生 HTML 手写，不引 Chart.js、D3 等第三方运行时。

---

## 7. 可访问性

- **HTML 组件**：以视觉隐藏的 `<h2 class="sr-only">` 开头，一句话概括用途。
- **SVG**：`role="img"`，且 `<title>` 与 `<desc>` 作为前两个子元素。
