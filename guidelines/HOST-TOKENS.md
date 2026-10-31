# HOST-TOKENS.md — 宿主令牌映射（v2）

`--viz-*` 是模型侧**唯一**的生成期命名空间；渲染端负责把它落到宿主真实的值上。

两点必须先说明，否则整张图会发黑或停在旧配色：

1. **渲染面是隔离的**。SVG 走 `data:` URI 的 `<img>`，HTML 走 `sandbox="allow-scripts"` 的 iframe。
   两者都**拿不到**宿主页面的 CSS 变量，所以令牌值必须在渲染前**取出来写成字面值**，写进产出的文档里。
2. **主题只来自两个文档化的入口**：`ctx.theme.getTheme().colorScheme`（浅/深）与 `ctx.theme` 的
   `theme/change` 事件。**不读** `body[data-ds-dark-theme]`、不读 `getComputedStyle(body).backgroundColor`、
   不读任何宿主内部属性——这些是实现细节，升级即失效。

---

## 1. 取值的顺序

对每个语义令牌，按顺序尝试：

1. 宿主变量 `getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-…')`（浏览器会把它解析成实际色值）；
2. 规范内置的浅色/深色兜底值。

因此宿主换了主题 → `theme/change` 触发重渲染 → 重新取值 → 卡片跟着变。

---

## 2. DSH 映射表（`dsh-client-ui-theme` 0.2.1-rc.5 核实的变量名）

| `--viz-*` | DSH 变量 | 备注 |
|---|---|---|
| `--viz-bg-primary` | `--dsw-alias-bg-base` | 卡片主体/页面底 |
| `--viz-bg-secondary` | `--dsw-alias-bg-layer-1` → `-layer-2` | 卡片头表面 |
| `--viz-bg-tertiary` | `--dsw-alias-bg-layer-3` | 代码块底 |
| `--viz-text-primary` | `--dsw-alias-label-primary` | 主文字 |
| `--viz-text-secondary` | `--dsw-alias-label-secondary` | 弱化文字 |
| `--viz-text-tertiary` | `--dsw-alias-label-tertiary` / `-caption` | 提示文字 |
| `--viz-border-subtle` | `--dsw-alias-border-l1` | 分隔线 |
| `--viz-border-default` | `--dsw-alias-border-l2` | 常规描边 |
| `--viz-border-strong` | `--dsw-alias-border-l3` / `-l4` | 强调描边 |
| `--viz-info` | `--dsw-alias-state-business-primary` | 语义蓝 |
| `--viz-success` | `--dsw-alias-state-success-primary` | 语义绿 |
| `--viz-warning` | `--dsw-alias-state-warn-primary` | 语义琥珀 |
| `--viz-danger` | `--dsw-alias-state-error-primary` | 语义红 |
| `--viz-radius-sm/md/lg` | `--dsw-radius-sm/md/lg` | 圆角 |
| `--viz-font-mono` | `--ds-font-family-code` | 等宽字族 |
| `--viz-font-sans` | 内置字体栈 | 宿主未提供字体令牌 |

**不走宿主、纯内置**：`--viz-font-serif` 与全部 `--viz-{hue}-{level}` 色阶（8 色系 × 6 级）。
色阶是**绝对色卡**，不随主题翻转——模型要用具体级别时须按 `_core.md` §5 写深浅两份。

---

## 3. 加一个新宿主时的检查清单

1. 确认宿主是否暴露 `theme` 服务（`provide("theme")`）。没有就退回 `prefers-color-scheme`，此时只支持浅/深两档、不跟应用内主题。
2. 在宿主页面控制台核对变量名确实存在：
   ```js
   getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-bg-base')
   ```
3. 对不上的**留空**（走内置兜底），不要瞎猜名字——猜错得到透明或黑色。
4. 改完跑 `npm test`，`B27`/`B28`/`B29` 会验证主题来源与令牌接管。
