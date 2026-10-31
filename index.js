/**
 * dsh-inline-visualizer — host half.
 *
 * Two model-facing tools:
 *   widget_guidelines(modules)                        load the design contract
 *   show_widget(title, widget_code, loading_messages) render an inline card
 *
 * The card itself lives in the client half (`client.js`), which owns the
 * `tool.call.toolview` keyed slot row named `show_widget`. Because the client
 * renders from the tool *arguments*, the tool result stays a one-line ack:
 * widget code never re-enters the conversation, which is the whole point.
 *
 * Conventions followed (see the plugin-development skill, §3):
 *   C1 — args are schema-validated before `execute` runs.
 *   C4 — `execute` returns one canonical JSON value; `render` is a pure text projection.
 *   C6 — `exec.signal.throwIfAborted()` before any fs work.
 *   C10 — the canonical value carries no UI/transport vocabulary beyond the widget payload.
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-inline-visualizer'
export const inject = ['tools']

const HERE = dirname(fileURLToPath(import.meta.url))
const GUIDELINES_DIR = join(HERE, 'guidelines')

const MODULE_FILES = {
  diagram: 'diagram.md',
  chart: 'chart.md',
  mockup: 'mockup.md',
  interactive: 'interactive.md',
  art: 'art.md',
}
const MODULE_IDS = Object.keys(MODULE_FILES)
const CORE_FILE = '_core.md'

const MAX_CODE_CHARS = 200000
const MAX_CODE_CHARS_CEILING = 1000000
/** Effective per-call cap; a profile patch can lower or raise it through `config.maxCodeChars`. */
let maxCodeChars = MAX_CODE_CHARS
const MAX_LOADING_MESSAGES = 5
const MAX_LOADING_CHARS = 48
const DEFAULT_LOADING = ['正在生成可视化…', '正在排版…', '马上就好…']

const MODULE_HINTS = {
  diagram: '流程/架构/关系图（节点与箭头）',
  chart: '数据图表（柱/线/饼/散点，轴与图例）',
  mockup: '界面草图（页面布局、组件排布）',
  interactive: '可交互 HTML 组件（沙箱 iframe，脚本可运行、不可联网、读不到宿主）',
  art: '装饰性插图/示意图形',
}

const MODULE_HELP = MODULE_IDS.map((id) => `- ${id}: ${MODULE_HINTS[id]}`).join('\n')

const TRIGGER_TEXT = `把「图」直接画进对话里的能力。适用场景：用户要看图、要流程/架构/关系图、要数据图表、要界面草图、要一个能动一下的小组件，或者文字描述不如一张图清楚时。

工作顺序（重要）：
1. 先调 widget_guidelines 拿到设计契约（复杂度预算、配色令牌、排版和硬约束），modules 按需选择；_core 会自动附带。
2. 再调 show_widget 把代码交出去。卡片会当场就地渲染在本次工具调用的位置。
3. 只画一张、只画必要的东西：颜色一律用 var(--viz-*) 令牌（渲染端会自动适配浅色/深色），不要硬编码 hex、不要写 <script>（SVG 分支会被剥离；要交互请走 interactive/HTML）。

不要在回复正文里粘贴 widget 代码或 SVG 源码——代码只经过 show_widget，正文里说明这张图展示了什么即可。`

/* ------------------------------------------------------------------ fs ---- */

const cache = new Map()

async function readGuideline(fileName) {
  const hit = cache.get(fileName)
  if (hit !== undefined) return hit
  const text = await readFile(join(GUIDELINES_DIR, fileName), 'utf8')
  cache.set(fileName, text)
  return text
}

/* ------------------------------------------------------------- helpers ---- */

/** Accept array | JSON-array string | comma/whitespace separated string. */
function parseModules(input) {
  let raw = []
  if (Array.isArray(input)) raw = input
  else if (typeof input === 'string') {
    const text = input.trim()
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text)
        raw = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        raw = text.replace(/[[\]"']/g, ' ').split(/[,\s]+/)
      }
    } else raw = text.split(/[,\s]+/)
  } else if (input !== undefined && input !== null) raw = [String(input)]

  const ids = []
  const rejected = []
  for (const entry of raw) {
    const id = String(entry).trim().toLowerCase().replace(/\.md$/, '')
    if (id === '' || id === '_core' || id === 'core') continue
    if (!MODULE_IDS.includes(id)) {
      if (!rejected.includes(id)) rejected.push(id)
      continue
    }
    if (!ids.includes(id)) ids.push(id)
  }
  return { ids, rejected }
}

function normalizeLoadingMessages(input) {
  const raw = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/[|,\n]/) : []
  const out = []
  for (const entry of raw) {
    const text = String(entry).trim().replace(/\s+/g, ' ')
    if (text === '') continue
    out.push(text.length > MAX_LOADING_CHARS ? `${text.slice(0, MAX_LOADING_CHARS - 1)}…` : text)
    if (out.length === MAX_LOADING_MESSAGES) break
  }
  return out.length > 0 ? out : DEFAULT_LOADING
}

/** Title -> safe download file name (spaces and hyphens become underscores). */
function normalizeFileName(title, kind) {
  const base = String(title)
    .trim()
    .replace(/\.(svg|html?|htm)$/i, '')
    .replace(/[\\/:*?"<>|\s-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
  const stem = base === '' ? 'widget' : base
  return `${stem}.${kind === 'svg' ? 'svg' : 'html'}`
}

/* --------------------------------------------------------------- tools ---- */

const guidelinesTool = defineTool({
  name: 'widget_guidelines',
  description: `载入对话内联可视化的设计契约（必读，画之前调一次）。返回 _core 契约正文加上所选模块的设计规范。\n可选模块：\n${MODULE_HELP}\n调用后严格按其中的复杂度预算、配色令牌（--viz-*）、排版与硬约束写代码，然后把代码交给 show_widget。`,
  parameters: {
    modules: {
      type: 'array',
      required: true,
      description: `要载入的模块 id，可多选：${MODULE_IDS.join(' | ')}。_core 契约会自动附带，不需要列出。`,
      items: { type: 'string', enum: [...MODULE_IDS] },
    },
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        modules: { type: 'array', required: true, items: { type: 'string' }, description: 'Actually loaded module ids, in order.' },
        rejected: { type: 'array', required: true, items: { type: 'string' }, description: 'Requested ids that are not a known module.' },
        chars: { type: 'number', required: true, description: 'Character count of the returned contract.' },
        approxTokens: { type: 'number', required: true, description: 'Rough token estimate for the returned contract.' },
        text: { type: 'string', required: true, description: 'The full design contract text (the value the model must follow).' },
      },
    },
    render: (_args, value) => [{ type: 'text', text: value.text }],
  },
  execute: async (args, exec) => {
    exec.signal.throwIfAborted()
    const { ids, rejected } = parseModules(args.modules)
    const selected = ids.length > 0 ? ids : ['diagram']
    const parts = await Promise.all([readGuideline(CORE_FILE), ...selected.map((id) => readGuideline(MODULE_FILES[id]))])
    const text = parts.join('\n\n---\n\n')
    const header = `<!-- 内联可视化设计契约：${['_core', ...selected].join(' + ')} -->`
    const body = `${header}\n\n${text}`
    return {
      modules: selected,
      rejected,
      chars: body.length,
      approxTokens: Math.round(body.length / 3.2),
      text: body,
    }
  },
})

const showWidgetTool = defineTool({
  name: 'show_widget',
  description: `${TRIGGER_TEXT}\n\n参数：title 是卡片标题（也用作下载文件名与卡片标识）；widget_code 是完整的 <svg …>…</svg> 或一段 HTML 片段；loading_messages 是代码流式传输期间卡片上轮播的短句（可选，最多 5 条）。\n返回一句话回执，代码不会回到对话上下文里。`,
  parameters: {
    title: {
      type: 'string',
      required: true,
      description: '卡片标题，例如「Agent 主循环」。同时用作下载文件名（空格与连字符会转成下划线）。不要写成句子。',
    },
    widget_code: {
      type: 'string',
      required: true,
      description: '完整可渲染的代码：以 <svg 开头并以 </svg> 结尾（矢量图），或一段 HTML 片段（可交互卡片，在沙箱 iframe 里运行）。颜色只用 var(--viz-*)。',
    },
    loading_messages: {
      type: 'array',
      description: '代码还在流式生成时卡片上轮播的短提示，例如 ["正在画流程图…","正在排版…"]，最多 5 条、每条不超过 48 字。',
      items: { type: 'string' },
    },
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ok: { type: 'boolean', required: true, description: 'Whether the widget was accepted for rendering.' },
        kind: { type: 'string', required: true, enum: ['svg', 'html'], description: 'Detected widget kind.' },
        title: { type: 'string', required: true, description: 'Card title as rendered.' },
        fileName: { type: 'string', required: true, description: 'Normalized download file name.' },
        chars: { type: 'number', required: true, description: 'Character count of widget_code.' },
        loading_messages: { type: 'array', required: true, items: { type: 'string' }, description: 'Loading messages used while streaming.' },
      },
    },
    render: (_args, value) => [
      {
        type: 'text',
        text: `已把「${value.title}」渲染成对话内联卡片（${value.kind.toUpperCase()}，${value.chars} 字符），就显示在本次工具调用的位置。不要复述代码或 SVG 源码；用一两句话说明这张图展示了什么、该看哪里。`,
      },
    ],
  },
  execute: async (args, exec) => {
    exec.signal.throwIfAborted()
    const title = String(args.title ?? '').trim().replace(/\s+/g, ' ') || '可视化'
    const code = String(args.widget_code ?? '')
    if (code.trim() === '') throw new Error('widget_code 不能为空：请提供完整的 <svg …>…</svg> 或 HTML 片段。')
    if (code.length > maxCodeChars) throw new Error(`widget_code 过长：${code.length} 字符，上限 ${maxCodeChars}。请拆成多张图分别调用。`)

    const kind = /<svg[\s>]/i.test(code) ? 'svg' : 'html'
    if (kind === 'svg') {
      if (!/<\/\s*svg\s*>/i.test(code)) throw new Error('SVG 代码不完整：没有找到 </svg>，请重新提交完整代码。')
      if (!/^\s*(?:<!--[\s\S]*?-->\s*)?<svg[\s>]/i.test(code)) {
        throw new Error('SVG 代码必须以 <svg 开头（可以在前面留注释，但不要包 <div>、<html> 或 markdown 代码块围栏）。')
      }
    }
    if (kind === 'html' && !/<[a-z][a-z0-9-]*[\s>\/]/i.test(code)) throw new Error('widget_code 里没有可渲染的元素。')

    return {
      ok: true,
      kind,
      title,
      fileName: normalizeFileName(title, kind),
      chars: code.length,
      loading_messages: normalizeLoadingMessages(args.loading_messages),
    }
  },
})

/**
 * Host half entry point.
 * @param ctx - plugin context (provides `tools`).
 * @param config - optional row config from `cordis.patch.yml`.
 */
export function apply(ctx, config) {
  const requested = config && Number(config.maxCodeChars)
  if (Number.isFinite(requested) && requested >= 1000) {
    maxCodeChars = Math.min(MAX_CODE_CHARS_CEILING, Math.floor(requested))
  }
  ctx.tools.register(guidelinesTool)
  ctx.tools.register(showWidgetTool)
}
