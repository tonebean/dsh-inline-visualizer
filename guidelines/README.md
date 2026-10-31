# guidelines/ — 规范正文（`widget_guidelines` 的返回值）

这是 `widget_guidelines` 工具**实际返回给模型的内容**。按模块拆分，**按需加载**——这是整套设计省 token 的关键，不要把所有内容常驻系统提示。

---

## 1. 文件结构

| 文件 | 何时加载 |
|---|---|
| `_core.md` | **始终**（任何模块都要先附） |
| `diagram.md` | 请求含 `diagram` 时 |
| `chart.md` | 请求含 `chart` 时 |
| `mockup.md` | 请求含 `mockup` 时 |
| `interactive.md` | 请求含 `interactive` 时 |
| `art.md` | 请求含 `art` 时 |
| `index.js` | **不是规范内容**，是装配器（`widget_guidelines` 的 handler 实现），部署时按需引入 |
| `HOST-TOKENS.md` | **不是规范内容**，是给部署者的宿主令牌映射表与核对清单（模型看不到） |

---

## 2. 装配规则

**装配规则**：返回 = `_core.md` + 各请求模块，用 `'\n\n---\n\n'` 拼接，**并按顺序**（`diagram` → `chart` → `mockup` → `interactive` → `art`）。

**v1.1 已给出实现**，直接用 `index.js`：

```js
import { widgetGuidelines, parseModules, normalizeTitle } from './guidelines/index.js';

widgetGuidelines({ modules: 'diagram, chart', theme: 'dark' });
// → "当前主题: dark\n\n" + _core.md + diagram.md + chart.md
```

导出的 API：

| 名字 | 作用 |
|---|---|
| `widgetGuidelines({ modules, theme })` | 装配规范文本；首行为 `当前主题: light\|dark` |
| `parseModules(input)` | 容错解析：`array` / JSON 字符串数组 / 逗号 / 空格 / 顿号 / 数组内含分隔符；自动去掉 `_core`、去重、剔除未知模块 |
| `normalizeTitle(title)` | 标题 → 安全文件名（空格与连字符转 `_`，去非法字符，截 80；空标题回退 `widget`） |
| `loadModule(name)` / `MODULES` / `SOFT_LIMIT_CHARS` | 单模块读取（带缓存）、合法模块名、软上限（18000 字符） |
| `GUIDELINES_DIR` / `CORE_MODULE` | 目录与核心模块名常量 |

命令行自检（不需要任何依赖，Node ≥ 18）：

```bash
node guidelines/index.js --theme=dark diagram chart
```

**约束**：

- `_core.md` **每次都要带**，它是所有模块共用的令牌与红线。
- 同一模块在一次会话中重复请求可缓存——`index.js` 的 `loadModule()` 已缓存。
- 返回内容应简洁——它是**指令**，不是文档；单次返回建议 < 4K token（实测：`_core + diagram + chart` ≈ 7.9K 字符；全部 5 模块 ≈ 11.8K 字符 ≈ 3.4K token，仍在建议内）。超过软上限时 `index.js` 会追加一行提示而**不静默截断**。

---

## 3. 加载时序

```
Agent 判断要不要可视化
        │
        ▼
widget_guidelines(["diagram"])  ──▶ "当前主题: light" + _core.md + diagram.md  ──▶ 进入上下文
        │
        ▼
模型据规范生成裸 SVG/HTML 片段（颜色一律写在 style 里，用 --viz-* 令牌）
        │
        ▼
show_widget(title, widget_code, loading_messages)  ──▶ 旁路渲染
```

**注意**：
- 模型可能一次请求多个模块（例如既要图又要表），此时按顺序全附。
- 首行的 `当前主题: light|dark` 是**主题信号通道之一**（另一条是渲染侧的 `data-viz-theme`）。片段作者据此决定 `[data-viz-theme="dark"]` 兜底分支要不要写。

---

## 4. 修改指南

- **改配色** → 只改 `_core.md` §2 的调色板表，各模块引用色系名，不重复定义。
- **改字号/间距** → 只改 `_core.md` §3 §4。
- **加新模块** → 新建 `<name>.md`，并加进 `index.js` 的 `MODULES` 与本文档 §1 表格。
- **适配宿主** → **不要改规范里的令牌名**。令牌是 `--viz-*` 中立命名空间，映射工作由渲染器负责：照 `HOST-TOKENS.md` 给 `renderer.js` 加一条 `registerHostPreset({...})` 即可。

---

## 5. 与原实现的差异

本套是**通用重写版**：

- **v1.0 的令牌漂移已修**：原来规范写 `--bg-primary` 一系、渲染器注入 `--color-background-primary` 一系，只有字体名对得上——结果是颜色全部回退成黑色。v1.1 两边统一为中立命名空间 `--viz-*`，**并由渲染器负责与宿主令牌对接**。
- **颜色写法只有一种**：写在 `style="fill: var(--viz-blue-500)"` 里。`fill="var(--viz-blue-500)"` 这类**表现属性不解析 `var()`**，写了必失效——原实现那句「颜色类未实现，须内联 fill」，说的其实就是这件事。
- 移除了原实现中「颜色类未实现」这类**环境特定约束**：现在颜色用内联 `style` + 令牌，既不失效也不影响换肤。
- 调色板为**自研 8 色系 × 6 级**，非照搬；如要还原原视觉效果，替换 `_core.md` §2 的表即可（令牌名不必改）。
- 各模块的红线（禁注释、禁渐变、viewBox 680 等）已保留，它们是这套能力能稳定出图的关键。
