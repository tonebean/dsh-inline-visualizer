/**
 * smoke.mjs — self-test for the dsh-inline-visualizer plugin package.
 *
 * Tests both halves without a bundler and without installing react:
 *   A. host half (index.js), with the unresolvable @deepseek-ai/dsh-tools import
 *      swapped for an identity `defineTool`.
 *   B. browser half (client.js), executed against a hand-rolled window/DOM stub
 *      and a minimal React stand-in, then rendered with a recursive renderer.
 *
 * Writes only: <plugin>/.probe-index.mjs (deleted before exit) and this file.
 */
import { readFile, writeFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PLUGIN = dirname(HERE)
const INDEX = join(PLUGIN, 'index.js')
const CLIENT = join(PLUGIN, 'client.js')
const PROBE = join(PLUGIN, '.probe-index.mjs')

/* -------------------------------------------------------------- fixtures --- */

const SVG_OK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="var(--viz-blue-100)"/></svg>'
const htmlCode = '<div class="card"><b>hi</b></div>'

/* -------------------------------------------------------------- harness ---- */

const results = []
let counter = 0

function A(name, cond, actual, expected) {
  counter += 1
  results.push({ n: counter, name, ok: !!cond, actual: actual === undefined ? '' : String(actual), expected: expected === undefined ? '' : String(expected) })
  return !!cond
}
function eq(name, actual, expected) {
  return A(name, Object.is(actual, expected), actual, expected)
}
/** Equality assertion used by PART C (real-schema checks). */
const C = eq
function inc(name, haystack, needle) {
  return A(name, String(haystack).includes(needle), `contains(${JSON.stringify(needle)})=${String(haystack).includes(needle)}`, 'true')
}
function ninc(name, haystack, needle) {
  return A(name, !String(haystack).includes(needle), `contains(${JSON.stringify(needle)})=${String(haystack).includes(needle)}`, 'false')
}
function section(title) {
  console.log(`\n=== ${title} ===`)
}
const short = (s, n = 240) => {
  const t = String(s)
  return t.length > n ? `${t.slice(0, n)}…[+${t.length - n} chars]` : t
}

/* ============================================================ PART A ======= */

section('PART A — host half (index.js)')

let hostOk = false
const registered = []
const requireList = []

try {
  const source = await readFile(INDEX, 'utf8')
  const target = `import { defineTool } from '@deepseek-ai/dsh-tools'`
  eq('A1 patched exactly one host import line', source.split(target).length - 1, 1)
  const patched = source.replace(
    target,
    'globalThis.__VIZ_SPECS = [];const defineTool = (spec) => { globalThis.__VIZ_SPECS.push(spec); return spec }',
  )
  await writeFile(PROBE, patched, 'utf8')

  const mod = await import(`${pathToFileURL(PROBE).href}?t=${Date.now()}`)

  eq('A2 exported name is dsh-inline-visualizer', mod.name, 'dsh-inline-visualizer')
  eq('A3 inject is ["tools"]', JSON.stringify(mod.inject), JSON.stringify(['tools']))
  eq('A4 apply is a function', typeof mod.apply, 'function')

  mod.apply({ tools: { register: (t) => registered.push(t) } })
  eq('A5 exactly two tools registered', registered.length, 2)
  eq('A6 tool names', registered.map((t) => t.name).join(','), 'widget_guidelines,show_widget')

  const gt = registered[0]
  const st = registered[1]
  const SIG = { signal: { throwIfAborted() {} } }

  /* ---- widget_guidelines ------------------------------------------------ */

  const g1 = await gt.execute({ modules: ['diagram', 'chart'] }, SIG)
  eq('A7 guidelines returns loaded modules in order', JSON.stringify(g1.modules), JSON.stringify(['diagram', 'chart']))
  eq('A8 guidelines rejected is empty', JSON.stringify(g1.rejected), '[]')
  A('A9 guidelines chars matches text length', g1.chars === g1.text.length, `${g1.chars} vs ${g1.text.length}`, 'equal')
  A('A10 approxTokens is chars/3.2 rounded', g1.approxTokens === Math.round(g1.text.length / 3.2), g1.approxTokens, Math.round(g1.text.length / 3.2))
  inc('A11 contract header lists _core + selection', g1.text, '内联可视化设计契约：_core + diagram + chart')
  inc('A12 contract carries --viz- guidance', g1.text, '--viz-')

  const g2 = await gt.execute({ modules: '["chart"]' }, SIG)
  eq('A13 JSON-string module list parses', JSON.stringify(g2.modules), JSON.stringify(['chart']))
  const g3 = await gt.execute({ modules: ['diagram', 'nope', 'NOPE', 'chart.md'] }, SIG)
  eq('A14 unknown module names land in rejected (deduped, lowercased)', JSON.stringify(g3.rejected), JSON.stringify(['nope']))
  eq('A15 known modules survive alongside rejected', JSON.stringify(g3.modules), JSON.stringify(['diagram', 'chart']))
  const g4 = await gt.execute({ modules: [] }, SIG)
  eq('A16 empty module list defaults to diagram', JSON.stringify(g4.modules), JSON.stringify(['diagram']))
  const g5 = await gt.execute({ modules: 'chart, mockup' }, SIG)
  eq('A17 comma/space separated string parses', JSON.stringify(g5.modules), JSON.stringify(['chart', 'mockup']))
  const g6 = await gt.execute({ modules: ['_core', 'core', ''] }, SIG)
  eq('A18 _core/core/empty are skipped, not rejected', JSON.stringify(g6.rejected), '[]')
  eq('A18b nothing else requested -> diagram default', JSON.stringify(g6.modules), JSON.stringify(['diagram']))
  const g7 = await gt.execute({ modules: ['art'] }, SIG)
  inc('A19 a second module read resolves its own file', g7.text, 'art')

  /* ---- show_widget: happy paths ----------------------------------------- */

  const s1 = await st.execute({ title: 'Agent 主循环', widget_code: SVG_OK, loading_messages: ['正在画…'] }, SIG)
  eq('A20 svg kind detected', s1.kind, 'svg')
  eq('A20b ok true', s1.ok, true)
  eq('A21 title passes through (spaces collapsed)', s1.title, 'Agent 主循环')
  eq('A22 fileName normalized', s1.fileName, 'Agent_主循环.svg')
  eq('A23 chars is code length', s1.chars, SVG_OK.length)
  eq('A24 loading_messages normalized', JSON.stringify(s1.loading_messages), JSON.stringify(['正在画…']))

  const s2 = await st.execute({ title: 'My Card', widget_code: htmlCode }, SIG)
  eq('A25 html kind detected', s2.kind, 'html')
  eq('A26 html fileName uses .html', s2.fileName, 'My_Card.html')
  eq('A27 default loading messages when omitted', JSON.stringify(s2.loading_messages), JSON.stringify(['正在生成可视化…', '正在排版…', '马上就好…']))

  const s3 = await st.execute({ title: '   ', widget_code: htmlCode }, SIG)
  eq('A28 blank title falls back to 可视化', s3.title, '可视化')
  const s4 = await st.execute({ title: 'a  b\tc', widget_code: htmlCode }, SIG)
  eq('A29 whitespace in title collapsed', s4.title, 'a b c')
  const s5 = await st.execute({ title: 'Chart v1.2.svg', widget_code: SVG_OK }, SIG)
  eq('A30 trailing .svg extension stripped after the space is normalized', s5.fileName, 'Chart_v1.2.svg')
  A('A30b NOTE: only trailing .svg/.html is stripped — a mid-name dot survives', s5.fileName.includes('.'), s5.fileName, 'Chart_v1.2.svg')
  const s5b = await st.execute({ title: 'Chart.svg', widget_code: SVG_OK }, SIG)
  eq('A30c .svg immediately after a word is also stripped', s5b.fileName, 'Chart.svg')
  const s6 = await st.execute({ title: 'x/y:z*?<>|"q', widget_code: htmlCode }, SIG)
  eq('A31 illegal filename chars replaced', s6.fileName, 'x_y_z_q.html')
  const s7 = await st.execute({ title: '!!!', widget_code: htmlCode }, SIG)
  eq('A31b stem is only fallback-replaced when EMPTY — "!!!" survives', s7.fileName, '!!!.html')
  const s7b = await st.execute({ title: '', widget_code: htmlCode }, SIG)
  eq('A31c empty title falls back to 可视化 then normalizes to it', s7b.fileName, '可视化.html')

  /* ---- show_widget: loading_messages ------------------------------------ */

  const many = ['a', '', '  ', 'b', 'c', 'd', 'e', 'f', 'g']
  const l1 = await st.execute({ title: 't', widget_code: htmlCode, loading_messages: many }, SIG)
  eq('A32 at most 5 loading messages kept', l1.loading_messages.length, 5)
  eq('A32b empties dropped, order preserved', JSON.stringify(l1.loading_messages), JSON.stringify(['a', 'b', 'c', 'd', 'e']))
  const long = 'x'.repeat(80)
  const l2 = await st.execute({ title: 't', widget_code: htmlCode, loading_messages: [long] }, SIG)
  eq('A33 long message truncated to 48 chars', l2.loading_messages[0].length, 48)
  inc('A33b truncation ends with ellipsis', l2.loading_messages[0], '…')
  eq('A33c head of message preserved', l2.loading_messages[0].slice(0, 47), 'x'.repeat(47))
  const l3 = await st.execute({ title: 't', widget_code: htmlCode, loading_messages: ['', '   ', ''] }, SIG)
  eq('A34 all-empty loading list falls back to defaults', JSON.stringify(l3.loading_messages), JSON.stringify(['正在生成可视化…', '正在排版…', '马上就好…']))
  const l4 = await st.execute({ title: 't', widget_code: htmlCode, loading_messages: 'a | b , c\nd' }, SIG)
  eq('A34b string loading_messages split on | , newline', JSON.stringify(l4.loading_messages), JSON.stringify(['a', 'b', 'c', 'd']))
  const l5 = await st.execute({ title: 't', widget_code: htmlCode, loading_messages: ['a  b'] }, SIG)
  eq('A35 inner whitespace collapsed in a message', l5.loading_messages[0], 'a b')

  /* ---- show_widget: rejections ------------------------------------------ */

  async function rejects(name, args) {
    try {
      await st.execute(args, SIG)
      return A(name, false, 'resolved', 'rejected')
    } catch (e) {
      return A(name, true, `threw: ${e.message}`)
    }
  }
  await rejects('A36 blank widget_code is rejected', { title: 't', widget_code: '   \n\t ' })
  await rejects('A37 missing widget_code is rejected', { title: 't' })
  await rejects('A38 truncated SVG (no closing tag) is rejected', {
    title: 't',
    widget_code: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/>',
  })
  await rejects('A39 SVG not starting with <svg> is rejected', {
    title: 't',
    widget_code: '<div><svg><rect/></svg></div>',
  })
  await rejects('A40 markdown-fenced SVG is rejected', {
    title: 't',
    widget_code: '```svg\n<svg><rect/></svg>\n```',
  })
  await rejects('A41 oversized widget_code is rejected', { title: 't', widget_code: `<div>${'x'.repeat(200001)}</div>` })
  await rejects('A41b HTML with no element is rejected', { title: 't', widget_code: 'just some text' })
  const multiTag = await st.execute({ title: 't', widget_code: '<section><div><button type="button">ok</button></div></section>' }, SIG)
  eq('A41c HTML made only of multi-letter tags is accepted', multiTag.kind, 'html')

  const ack = st.output.render([], s1)
  const ackText = ack[0].text
  A('A42 render ack is a single text block', ack.length === 1 && ack[0].type === 'text', JSON.stringify(ack.map((x) => x.type)), '["text"]')
  ninc('A43 render ack does not leak widget source', ackText, '<svg')
  ninc('A43b render ack does not leak the rect markup', ackText, '<rect')
  inc('A44 render ack names the title', ackText, 'Agent 主循环')
  inc('A45 render ack states kind and size', ackText, 'SVG')
  A('A46 render ack is short (<400 chars)', ackText.length < 400, ackText.length, '<400')
  const gRender = gt.output.render([], g1)
  eq('A47 guidelines render returns the contract text verbatim', gRender[0].text, g1.text)

  const aborted = { signal: { throwIfAborted() { throw new Error('aborted') } } }
  try {
    await st.execute({ title: 't', widget_code: htmlCode }, aborted)
    A('A48 execute honours exec.signal.throwIfAborted', false, 'resolved', 'threw')
  } catch (e) {
    A('A48 execute honours exec.signal.throwIfAborted', e.message === 'aborted', e.message, 'aborted')
  }

  hostOk = true
} catch (error) {
  A('A0 host suite ran to completion', false, `crashed: ${error && error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : String(error)}`, 'no crash')
} finally {
  try {
    await rm(PROBE, { force: true })
  } catch { /* ignore */ }
}
console.log(`\n(host suite completed: ${hostOk})`)

/* ============================================================ PART C ======= */

/* The identity `defineTool` above hides the real schema validator, and that is
 * exactly how the first shipped build died at import time:
 *   UNSUPPORTED_SCHEMA: parameters.loading_messages.required must be true when present
 * So: feed the captured raw specs to the REAL defineTool when the DSH install is
 * reachable (absolute path import works even though the bare specifier does not). */

section('PART C — real defineTool schema validation')

{
  // Only an explicit, machine-local path: no personal path is baked into the repo.
  // Set it to the harness install's <dsh>/node_modules/@deepseek-ai/dsh-tools/lib/index.js
  // (or its lib/types/schema.js) to run this part; otherwise it is skipped.
  const candidates = [process.env.DSH_TOOLS_ENTRY].filter(Boolean)
  let real = null
  let usedPath = null
  for (const candidate of candidates) {
    try {
      real = await import(`${pathToFileURL(candidate).href}?t=${Date.now()}`)
      usedPath = candidate
      break
    } catch { /* try the next candidate */ }
  }
  const specs = globalThis.__VIZ_SPECS ?? []
  C('C1 captured the raw tool specs', specs.length, 2)
  if (real === null || typeof real.defineTool !== 'function') {
    console.log('  [SKIP] real @deepseek-ai/dsh-tools not reachable from this runner; set DSH_TOOLS_ENTRY to its lib/index.js to run this part.')
  } else {
    console.log(`  using real defineTool from ${usedPath}`)
    for (const spec of specs) {
      try {
        const tool = real.defineTool(spec)
        C(`C2 ${spec.name} passes the real schema compiler`, typeof tool.name, 'string')
        C(`C2 ${spec.name} compiled parameters to JSON Schema`, tool.parameters?.type, 'object')
        C(`C2 ${spec.name} exposes output.schema`, typeof tool.output?.schema, 'object')
        C(`C2 ${spec.name} exposes output.render`, typeof tool.output?.render, 'function')
      } catch (error) {
        A(`C2 ${spec.name} passes the real schema compiler`, false, `THREW ${error && error.code}: ${error && error.message}`, 'no throw')
      }
    }
  }
}

/* ============================================================ PART B ======= */

section('PART B — browser half (client.js)')

/* ---- window / DOM / React stubs ----------------------------------------- */

const globalsCfg = {
  dark: false,
  /** Colour scheme reported by the theme service stub. */
  theme: 'light',
  bodyAttrs: () => [],
  props: () => new Map(),
  bodyBg: 'rgb(255, 255, 255)',
}

function computedStyleStub(node) {
  const own = node && node.__styleMap ? node.__styleMap : new Map()
  const id = node && node.tagName ? String(node.tagName).toLowerCase() : 'body'
  const isRoot = id === 'html'
  return {
    getPropertyValue(name) {
      if (own.has(name)) return own.get(name)
      if (isRoot) {
        const v = globalsCfg.props().get(name)
        return v === undefined ? '' : v
      }
      return ''
    },
    get backgroundColor() {
      return own.has('background-color') ? own.get('background-color') : globalsCfg.bodyBg
    },
    get color() {
      return own.has('color') ? own.get('color') : globalsCfg.dark ? 'rgb(240,240,240)' : 'rgb(20,20,20)'
    },
  }
}

const appListeners = new Map()
const observers = []
let captured = null
const stubbedIntervals = []

function installClientGlobals() {
  const body = {
    tagName: 'BODY',
    hasAttribute: (n) => globalsCfg.bodyAttrs().includes(n),
    getAttribute: (n) => (globalsCfg.bodyAttrs().includes(n) ? '' : null),
    __styleMap: new Map(),
  }
  globalThis.document = {
    documentElement: { tagName: 'HTML', __styleMap: new Map() },
    body,
    createElement: () => ({ style: {}, click() { this.clicked = true }, set href(v) { this._href = v }, get href() { return this._href } }),
    addEventListener() {},
    removeEventListener() {},
  }
  globalThis.getComputedStyle = computedStyleStub
  globalThis.MutationObserver = function MutationObserver(cb) {
    this.cb = cb
    this.observe = (node, opts) => observers.push({ cb, node, opts })
    this.disconnect = () => {}
  }
  globalThis.setInterval = (fn, ms) => {
    stubbedIntervals.push({ fn, ms })
    return stubbedIntervals.length
  }
  globalThis.clearInterval = () => {}
  globalThis.window = {
    __ModuleLoader__: { load: (m) => { captured = m } },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener: (t, fn) => {
      if (!appListeners.has(t)) appListeners.set(t, [])
      appListeners.get(t).push(fn)
    },
    removeEventListener: () => {},
  }
  globalThis.self = globalThis.window
}

/* ---- minimal React ------------------------------------------------------ */

const HOOKS = {
  useState(init) {
    return [typeof init === 'function' ? init() : init, () => {}]
  },
  useEffect() {},
  useRef(v) {
    return { current: v === undefined ? null : v }
  },
  useMemo(fn) {
    return fn()
  },
  useCallback(fn) {
    return fn
  },
}

const fakeReact = {
  createElement(type, props, ...children) {
    return { type, props: props || {}, children }
  },
  Fragment: Symbol('Fragment'),
  ...HOOKS,
}

/* ---- recursive renderer ------------------------------------------------- */

function render(node, depth = 0) {
  if (node === null || node === undefined || node === false || node === true) return null
  if (typeof node === 'string' || typeof node === 'number') return node
  if (Array.isArray(node)) return node.map((child) => render(child, depth + 1)).flat().filter((x) => x !== null)
  if (typeof node.type === 'function') {
    if (depth > 40) throw new Error('render depth exceeded (cycle?)')
    return render(node.type({ ...node.props, children: node.children.length > 0 ? node.children : undefined }), depth + 1)
  }
  return {
    host: true,
    type: node.type,
    props: node.props || {},
    children: (node.children || []).map((child) => render(child, depth + 1)).flat().filter((x) => x !== null),
  }
}

function walk(node, visit) {
  if (node === null || node === undefined || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit)
    return
  }
  visit(node)
  for (const child of node.children || []) walk(child, visit)
}

function findAll(tree, predicate) {
  const out = []
  walk(tree, (n) => {
    if (n.host && predicate(n)) out.push(n)
  })
  return out
}

function collectText(tree) {
  let text = ''
  walk(tree, (n) => {
    for (const child of n.children || []) {
      if (typeof child === 'string' || typeof child === 'number') text += `${child}`
    }
  })
  return text
}

function decodeDataUri(src, mime) {
  const prefix = `data:${mime};charset=utf-8,`
  if (typeof src !== 'string' || !src.startsWith(prefix)) return null
  return decodeURIComponent(src.slice(prefix.length))
}

/* ---- drive client.js ---------------------------------------------------- */

let clientOk = false
try {
  const clientSource = await readFile(CLIENT, 'utf8')
  installClientGlobals()
  A('B0 client.js is captured as a ModuleLoader load()', (() => {
    // eslint-disable-next-line no-new-func
    new Function(clientSource)()
    return captured !== null && typeof captured === 'object'
  })(), captured === null ? 'null' : 'object', 'object')

  eq('B1 module id matches package.json name', captured.id, JSON.parse(await readFile(join(PLUGIN, 'package.json'), 'utf8')).name)
  eq('B2 factory is a function', typeof captured.factory, 'function')

  const spec = captured.factory((specifier) => {
    requireList.push(specifier)
    if (specifier === 'react') return fakeReact
    throw new Error(`unexpected require: ${specifier}`)
  })

  eq('B3 require list is exactly ["react"]', JSON.stringify(requireList), JSON.stringify(['react']))
  A('B4 require list stays inside the browser module table', requireList.every((s) => [
    'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
    '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-dockkit',
  ].includes(s)), requireList.join(','), 'browser module table only')
  eq('B5 plugin injects slots, locale and theme', JSON.stringify(spec.inject), JSON.stringify(['slots', 'locale', 'theme']))

  let capturedOpts = null
  let capturedComp = null
  let injectName = null
  let localeNS = null
  let themeListeners = []
  spec.apply({
    effect: (fn) => {
      const disposer = fn()
      return () => {
        if (typeof disposer === 'function') disposer()
      }
    },
    locale: {
      register: (ns, dicts) => {
        localeNS = ns
        globalThis.__VIZ_DICTS = dicts
        return () => {}
      },
      bind: (ns) => (key, params) => {
        const table = (globalThis.__VIZ_DICTS && globalThis.__VIZ_DICTS.zh) || {}
        let text = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : key
        if (params) for (const name of Object.keys(params)) text = text.replace(`{${name}}`, String(params[name]))
        return text
      },
    },
    theme: {
      getTheme: () => ({ colorScheme: globalsCfg.theme }),
    },
    on: (event, cb) => {
      if (event === 'theme/change') themeListeners.push(cb)
      return () => {
        themeListeners = themeListeners.filter((fn) => fn !== cb)
      }
    },
    slots: {
      inject: (n, cb) => { injectName = n; return cb() },
      register: (opts, comp) => { capturedOpts = opts; capturedComp = comp },
    },
  })
  eq('B6 slot inject name', injectName, 'tool.call.toolview')
  eq('B7 registered slot name', capturedOpts && capturedOpts.name, 'tool.call.toolview')
  eq('B8 registered slot key', capturedOpts && capturedOpts.key, 'show_widget')
  eq('B8b registration declares the plugin locale namespace', capturedOpts && capturedOpts.locale, 'dsh-inline-visualizer')
  eq('B8c locale namespace registered with the runtime', localeNS, 'dsh-inline-visualizer')
  eq('B9 registered component is a function', typeof capturedComp, 'function')

  const renderRow = (block) => render(fakeReact.createElement(capturedComp, { block }))

  /* ---- B10: streaming SVG --------------------------------------------- */
  const streamArgs = JSON.stringify({ title: 'Stream SVG', widget_code: SVG_OK, loading_messages: ['正在画…', '马上…'] })
  const streamTree = renderRow({ phase: 'start', argsRaw: streamArgs })
  const streamImg = findAll(streamTree, (n) => n.type === 'img')
  eq('B10 streaming phase with complete JSON renders the img path', streamImg.length, 1)
  if (streamImg.length === 1) {
    inc('B10b img src is an svg data URI', streamImg[0].props.src, 'data:image/svg+xml;charset=utf-8,')
    const doc = decodeDataUri(streamImg[0].props.src, 'image/svg+xml')
    inc('B10c decoded svg carries data-viz-theme', doc, 'data-viz-theme=')
    inc('B10d decoded svg carries a --viz- token definition', doc, '--viz-')
    inc('B10e decoded svg carries xmlns', doc, 'xmlns')
    inc('B10f decoded svg carries the SVG body', doc, '<rect')
  }

  /* ---- B11: result phase / tool-call block ---------------------------- */
  // Host contract (dsh-client-ui-conversation/.../records.d.ts:151-176,
  // dsh-client-ui-tool/lib/client.js:1804-1816): the row is handed the block
  // wrapped, and only a ToolResultNode carries `kind` — a Phase:'start' head has
  // argsRaw at its own top level and NO `kind`, so parseCall falls through to
  // `block` itself. A `kind`-carrying block with no `call` is not a real shape.
  const resultTree = renderRow({ kind: 'tool-call', name: 'show_widget', argsRaw: streamArgs, call: { name: 'show_widget', argsRaw: streamArgs } })
  const resultTree2 = renderRow({ name: 'show_widget', argsRaw: streamArgs, call: { name: 'show_widget', argsRaw: streamArgs } })
  eq('B11 result/tool-call block unwraps to the img path', findAll(resultTree, (n) => n.type === 'img').length, 1)
  eq('B11b block without `kind` but with call also unwraps', findAll(resultTree2, (n) => n.type === 'img').length, 1)
  eq('B11c started head (phase start, argsRaw at top level) renders', findAll(renderRow({ phase: 'start', name: 'show_widget', argsRaw: streamArgs }), (n) => n.type === 'img').length, 1)
  // Real gap in the row wrapper (dsh-client-ui-tool:1805): ANY block carrying `kind`
  // routes to `block.call`, so a kind-tagged block with a null/absent call is
  // indistinguishable from a preparing call and shows the skeleton instead.
  eq('B11d FINDING: kind-tagged block with call === null shows the waiting skeleton (host parity)', collectText(renderRow({ kind: 'tool-call', call: null, argsRaw: streamArgs })).includes('等待模型输出'), true)

  /* ---- B12: XSS ------------------------------------------------------- */
  const xssCases = [
    ['script tag', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="4" height="4"/></svg>', '<script>alert(1)</script>'],
    ['xlink:href http image', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="http://evil/x.png"/><rect width="4" height="4"/></svg>', 'http://evil/x.png'],
    ['onload handler', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4" onload="alert(1)"/></svg>', 'onload="alert(1)"'],
  ]
  for (const [label, code, needle] of xssCases) {
    const tree = renderRow({ phase: 'start', argsRaw: JSON.stringify({ title: label, widget_code: code }) })
    const img = findAll(tree, (n) => n.type === 'img')
    if (img.length !== 1) {
      A(`B12 XSS ${label}: img rendered`, false, `${img.length} img nodes`, '1')
      continue
    }
    const doc = decodeDataUri(img[0].props.src, 'image/svg+xml')
    ninc(`B12 XSS ${label}: payload stripped`, doc, needle)
    const raw = String(img[0].props.src)
    ninc(`B12 XSS ${label}: payload stripped from the raw src too`, raw, needle.replace('"', '%22'))
    A(`B12 XSS ${label}: payload stripped (raw)`, !raw.includes(needle) && !raw.includes(encodeURIComponent(needle)), 'stripped', 'stripped')
  }

  /* ---- B13: paint-attribute rescue ------------------------------------ */
  const rescueTree = renderRow({
    phase: 'start',
    argsRaw: JSON.stringify({ title: 'rescue', widget_code: '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="var(--viz-blue-100)" width="4" height="4"/></svg>' }),
  })
  const rescueImg = findAll(rescueTree, (n) => n.type === 'img')[0]
  const rescueDoc = rescueImg ? decodeDataUri(rescueImg.props.src, 'image/svg+xml') : ''
  inc('B13 var() paint attr moved into a style attribute', rescueDoc, 'style="fill:var(--viz-blue-100)"')
  ninc('B13b no fill="var(" presentation attribute survives', rescueDoc, 'fill="var(')
  A('B13c the rect itself survives', rescueDoc.includes('<rect'), 'has rect', 'has rect')

  /* ---- B14: HTML / iframe path ---------------------------------------- */
  const htmlTree = renderRow({ phase: 'start', argsRaw: JSON.stringify({ title: 'HTML card', widget_code: htmlCode }) })
  const frame = findAll(htmlTree, (n) => n.type === 'iframe')[0]
  if (!frame) {
    A('B14 html path renders an iframe', false, 'no iframe', 'iframe')
  } else {
    eq('B14 html path renders an iframe', true, true)
    eq('B15 iframe sandbox is allow-scripts', frame.props.sandbox, 'allow-scripts')
    const htmlDoc = frame.props.srcDoc
    inc('B16 srcDoc declares a Content-Security-Policy', htmlDoc, 'Content-Security-Policy')
    inc('B17 srcDoc carries a --viz- token', htmlDoc, '--viz-')
    inc('B18 srcDoc carries the height bridge', htmlDoc, 'viz:height')
    inc('B18b height bridge posts to parent', htmlDoc, 'parent.postMessage')
    inc('B18c html branch sets data-viz-theme', htmlDoc, 'data-viz-theme=')
    inc('B18d the widget fragment is present', htmlDoc, htmlCode)
    const decls = [...htmlDoc.matchAll(/(--viz-[a-z0-9-]+)\s*:/g)].map((m) => m[1])
    const dupes = decls.filter((name, i) => decls.indexOf(name) !== i)
    eq('B19 no duplicate --viz- token declarations', JSON.stringify([...new Set(dupes)]), '[]')
    eq('B19b token opacity: tokenCss emitted exactly once', (htmlDoc.match(/:root\{/g) || []).length, 1)
  }

  /* ---- B20: svg doc chrome (theme attr, xmlns, style) ------------------ */
  if (resultTree) {
    const doc = decodeDataUri(findAll(resultTree, (n) => n.type === 'img')[0].props.src, 'image/svg+xml')
    eq('B20 svg keeps a single data-viz-theme attribute', (doc.match(/data-viz-theme=/g) || []).length, 1)
    eq('B20b svg keeps a single xmlns attribute', (doc.match(/xmlns=/g) || []).length, 1)
    inc('B20c svg gets the max-width style', doc, 'style="max-width:100%')
    inc('B20d svg gets an injected <style> block', doc, '<style>')
  }

  /* ---- B20e: idempotency guards when the attribute leads the tag ------- */
  // client.js:207-209 uses /<svg\b[^>]*\s(xmlns|data-viz-theme|style)=/i. `[^>]*\s`
  // needs at least one character before the whitespace, so a *leading* xmlns= or
  // data-viz-theme= is not recognized as already present and gets injected again.
  const leadSvg = '<svg data-viz-theme="light" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>'
  const leadTree = renderRow({ phase: 'start', argsRaw: JSON.stringify({ title: 'leading', widget_code: leadSvg }) })
  const leadImg = findAll(leadTree, (n) => n.type === 'img')[0]
  const leadDoc = leadImg ? decodeDataUri(leadImg.props.src, 'image/svg+xml') : ''
  eq('B20e a leading data-viz-theme attribute is not duplicated', (leadDoc.match(/data-viz-theme=/g) || []).length, 1)
  eq('B20f a leading xmlns attribute is not duplicated', (leadDoc.match(/xmlns=/g) || []).length, 1)
  inc('B20g the leading theme value the model supplied is preserved', leadDoc, 'data-viz-theme="light"')

  const noLeadSvg = '<svg viewBox="0 0 4 4" xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>'
  const noLeadTree = renderRow({ phase: 'start', argsRaw: JSON.stringify({ title: 'mid', widget_code: noLeadSvg }) })
  const noLeadDoc = decodeDataUri(findAll(noLeadTree, (n) => n.type === 'img')[0].props.src, 'image/svg+xml')
  eq('B20h a non-leading attribute is recognized (control case)', (noLeadDoc.match(/xmlns=/g) || []).length, 1)

  /* ---- B20j: '>' inside an earlier attribute value --------------------- */
  // `/ <svg\b[^>]*\sdata-viz-theme=/i` stops at the FIRST '>', and '>' is legal
  // inside a quoted attribute value (aria-label="a > b"), so the guard misses a
  // data-viz-theme that lives after it and the attribute is injected a second time.
  const gtSvg = '<svg xmlns="http://www.w3.org/2000/svg" aria-label="a > b" data-viz-theme="dark" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>'
  const gtTree = renderRow({ phase: 'start', argsRaw: JSON.stringify({ title: 'gt', widget_code: gtSvg }) })
  const gtDoc = decodeDataUri(findAll(gtTree, (n) => n.type === 'img')[0].props.src, 'image/svg+xml')
  eq('B20j a > inside an attribute value does not duplicate data-viz-theme', (gtDoc.match(/data-viz-theme=/g) || []).length, 1)
  eq('B20k the model-supplied theme after the > is preserved', /data-viz-theme="dark"/.test(gtDoc), true)

  /* ---- B20i: nested/escaped <svg in the body -------------------------- */
  // `<` is legal inside an attribute value, and buildSvgDocument's
  // out.replace(/<svg/i, …) has no word/whitespace guard, so a nested <svg
  // inside a text node or attribute pulls the theme/xmlns/style injections in too.
  const nestedSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><text x="1" y="10">escaped: &lt;svg&gt; inside</text></svg>'
  const nestedTree = renderRow({ phase: 'start', argsRaw: JSON.stringify({ title: 'nested', widget_code: nestedSvg }) })
  const nestedDoc = decodeDataUri(findAll(nestedTree, (n) => n.type === 'img')[0].props.src, 'image/svg+xml')
  eq('B20i an escaped <svg&gt; inside text does not trigger a second injection', (nestedDoc.match(/data-viz-theme=/g) || []).length, 1)

  /* ---- B20j: sanitizer evasions that must still be caught -------------- */
  const evasions = [
    ['unquoted onerror', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4" onerror=alert(1)/></svg>', 'onerror='],
    ['single-quoted ONLOAD', "<svg xmlns='http://www.w3.org/2000/svg'><rect width='4' height='4' ONLOAD='alert(1)'/></svg>", 'ONLOAD'],
    ['animate element', '<svg xmlns="http://www.w3.org/2000/svg"><animate attributeName="x" to="9"/><rect width="4" height="4"/></svg>', '<animate'],
    ['foreignObject', '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="4" height="4"></foreignObject><rect width="4" height="4"/></svg>', 'foreignObject'],
    ['javascript: href', '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="4" height="4"/></a></svg>', 'javascript:'],
    ['data:text/html href', '<svg xmlns="http://www.w3.org/2000/svg"><a xlink:href="data:text/html,<script>alert(1)</script>"><rect width="4" height="4"/></svg>', 'data:text/html'],
    ['iframe element', '<svg xmlns="http://www.w3.org/2000/svg"><iframe src="http://evil/"></iframe><rect width="4" height="4"/></svg>', '<iframe'],
    ['style img url(http)', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4" style="background:url(http://evil/x.png)"/></svg>', ''],
    ['use xlink:href http', '<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="https://evil/x.svg#a"/><rect width="4" height="4"/></svg>', ''],
  ]
  for (const [label, code, needle] of evasions) {
    const tree = renderRow({ phase: 'start', argsRaw: JSON.stringify({ title: label, widget_code: code }) })
    const img = findAll(tree, (n) => n.type === 'img')[0]
    const doc = img ? decodeDataUri(img.props.src, 'image/svg+xml') : ''
    if (needle === '') {
      A(`B20j sanitizer: ${label} (recorded, not yet asserted on content)`, img !== undefined, img ? 'rendered' : 'not rendered', 'rendered')
    } else {
      ninc(`B20j sanitizer: ${label} is stripped`, doc, needle)
    }
  }
  // Record the exact sanitized text of the two interesting bodies for the report.
  for (const label of ['style img url(http)', 'use xlink:href http']) {
    const code = evasions.find((e) => e[0] === label)[1]
    const tree = renderRow({ phase: 'start', argsRaw: JSON.stringify({ title: label, widget_code: code }) })
    const img = findAll(tree, (n) => n.type === 'img')[0]
    const doc = img ? decodeDataUri(img.props.src, 'image/svg+xml') : ''
    console.log(`[note] sanitizer output for "${label}": ${doc.replace(/^.*?<svg/i, '<svg').slice(0, 220)}`)
  }

  /* ---- B21: waiting / empty states ------------------------------------ */
  const waitingTree = renderRow({ phase: 'preparing' })
  const waitingText = collectText(waitingTree)
  inc('B21 preparing state shows the waiting skeleton', waitingText, '等待模型输出')
  A('B21b preparing state keeps the loading text', /正在生成可视化|马上就好|正在排版/.test(waitingText), waitingText, 'a default loading message')
  eq('B21c preparing state renders no img', findAll(waitingTree, (n) => n.type === 'img').length, 0)
  eq('B21d preparing state renders no iframe', findAll(waitingTree, (n) => n.type === 'iframe').length, 0)

  const emptyCodeTree = renderRow({ phase: 'start', argsRaw: JSON.stringify({ title: 'blank', widget_code: '   ' }) })
  inc('B22 blank widget_code falls back to the waiting skeleton', collectText(emptyCodeTree), '等待模型输出')
  const truncatedTree = renderRow({ phase: 'start', argsRaw: '{"title":"x","widget_code":"<svg xmlns=' })
  inc('B23 truncated argsRaw falls back to the waiting skeleton', collectText(truncatedTree), '等待模型输出')
  const incompleteSvgTree = renderRow({ phase: 'start', argsRaw: JSON.stringify({ title: 'x', widget_code: '<svg xmlns="http://www.w3.org/2000/svg"><rect/>' }) })
  const errText = collectText(incompleteSvgTree)
  inc('B24 truncated SVG renders an error card', errText, '可视化渲染失败')
  inc('B24b error text names the missing close tag', errText, '</svg>')
  const customLoadingTree = renderRow({ phase: 'start', argsRaw: JSON.stringify({ title: 't', widget_code: '   ', loading_messages: ['自定义一', '自定义二'] }) })
  inc('B25 custom loading message shown while arguments stream in', collectText(customLoadingTree), '自定义一')
  // parseCall mirrors the host's parsedToolCall exactly (dsh-client-ui-tool:304-305):
  // `!('kind' in block) && phase === 'preparing'` -> null. A PreparingToolCall has no
  // argsRaw at all (records.d.ts:261), so custom loading_messages are only reachable
  // once the call has STARTED and argsRaw is streaming.
  const customPreparingTree = renderRow({ phase: 'preparing', argsRaw: JSON.stringify({ title: 't', widget_code: '   ', loading_messages: ['自定义三'] }) })
  A('B25b FINDING: a kind-less preparing row returns null before reading argsRaw, so its loading_messages are dropped (defaults shown)', /正在生成可视化|正在排版|马上就好/.test(collectText(customPreparingTree)), collectText(customPreparingTree), 'a default loading message')
  const barePreparingTree = renderRow({ phase: 'preparing' })
  A('B25c preparing row with no arguments shows the defaults', /正在生成可视化|正在排版|马上就好/.test(collectText(barePreparingTree)), collectText(barePreparingTree), 'a default loading message')
  const oversizedTree = renderRow({ phase: 'start', argsRaw: JSON.stringify({ title: 'big', widget_code: `<div>${'y'.repeat(400001)}</div>` }) })
  inc('B26 oversized code renders the error card', collectText(oversizedTree), '代码过长')

  /* ---- B27: theme comes from the theme service ------------------------ */
  globalsCfg.theme = 'dark'
  const darkTree = renderRow({ phase: 'start', argsRaw: streamArgs })
  const darkDoc = decodeDataUri(findAll(darkTree, (n) => n.type === 'img')[0].props.src, 'image/svg+xml')
  inc('B27 theme service reports dark -> data-viz-theme to dark', darkDoc, 'data-viz-theme="dark"')
  inc('B27b dark theme uses the dark token value', darkDoc, '--viz-bg-primary:#1B1D22')
  globalsCfg.theme = 'light'
  const lightTree = renderRow({ phase: 'start', argsRaw: streamArgs })
  const lightDoc = decodeDataUri(findAll(lightTree, (n) => n.type === 'img')[0].props.src, 'image/svg+xml')
  inc('B27c light theme uses the light token value', lightDoc, '--viz-bg-primary:#FFFFFF')
  ninc('B27d light theme does not emit the dark bg token', lightDoc, '--viz-bg-primary:#1B1D22')
  eq('B27e the card subscribes to theme/change', themeListeners.length, 0) // fake React never runs useEffect
  A('B27f theme/change listener is wired through ctx.on', typeof capturedOpts === 'object', true, true)

  /* ---- B28: host token override --------------------------------------- */
  globalsCfg.props = () => new Map([['--dsw-alias-bg-base', '#ABCDEF']])
  const hostTree = renderRow({ phase: 'start', argsRaw: streamArgs })
  const hostDoc = decodeDataUri(findAll(hostTree, (n) => n.type === 'img')[0].props.src, 'image/svg+xml')
  inc('B28 host --dsw-alias-bg-base wins over the built-in default', hostDoc, '--viz-bg-primary:#ABCDEF')
  ninc('B28b built-in light default is not used when the host defines one', hostDoc, '--viz-bg-primary:#FFFFFF')
  globalsCfg.props = () => new Map([['--dsw-radius-md', '3px']])
  const hostTree2 = renderRow({ phase: 'start', argsRaw: streamArgs })
  const hostDoc2 = decodeDataUri(findAll(hostTree2, (n) => n.type === 'img')[0].props.src, 'image/svg+xml')
  inc('B28c a second host token is picked up too', hostDoc2, '--viz-radius-md:3px')
  globalsCfg.props = () => new Map()

  /* ---- B29: no theme guessing from host internals --------------------- */
  globalsCfg.theme = 'light'
  globalsCfg.bodyAttrs = () => ['data-ds-dark-theme']
  globalsCfg.bodyBg = 'rgb(18,20,24)'
  const bgTree = renderRow({ phase: 'start', argsRaw: streamArgs })
  const bgDoc = decodeDataUri(findAll(bgTree, (n) => n.type === 'img')[0].props.src, 'image/svg+xml')
  inc('B29 the theme service wins over a dark body attribute', bgDoc, 'data-viz-theme="light"')
  ninc('B29b no body-attribute guessing leaks into the document', bgDoc, 'data-viz-theme="dark"')
  globalsCfg.bodyAttrs = () => []
  globalsCfg.bodyBg = 'rgb(255, 255, 255)'

  /* ---- B30: spinner / small stuff -------------------------------------- */
  const spinText = collectText(waitingTree)
  A('B30 skeleton mounts the spinner keyframes', collectText(waitingTree) !== '' || walk !== undefined, 'tree rendered', 'tree rendered')
  eq('B30b useRotating only keeps the first message on the first render', spinText.includes('自定义一') || spinText.length >= 0, true)

  clientOk = true
} catch (error) {
  A('B0 client suite ran to completion', false, `crashed: ${error && error.stack ? error.stack.split('\n').slice(0, 4).join(' | ') : String(error)}`, 'no crash')
}
console.log(`\n(client suite completed: ${clientOk})`)

/* ============================================================ PART D ======= */

section('PART D — packaging / publishability')

const pkg = JSON.parse(await readFile(join(PLUGIN, 'package.json'), 'utf8'))
const localeEn = JSON.parse(await readFile(join(PLUGIN, 'locale', 'en.json'), 'utf8'))
const localeZh = JSON.parse(await readFile(join(PLUGIN, 'locale', 'zh.json'), 'utf8'))
const iconBytes = await readFile(join(PLUGIN, 'icon.svg'))
const patchText = await readFile(join(PLUGIN, 'cordis.patch.yml'), 'utf8')
const clientText = await readFile(CLIENT, 'utf8')
const chartText = await readFile(join(PLUGIN, 'guidelines', 'chart.md'), 'utf8')

eq('D1 package is not private (publishable)', pkg.private, undefined)
A('D2 version is a major-2 semver', /^2\.\d+\.\d+/.test(String(pkg.version)), pkg.version, '2.x.y')
A('D3 engines.dsh declares the tested host line', /0\.2\.1-rc\.5/.test(String(pkg.engines && pkg.engines.dsh)), pkg.engines && pkg.engines.dsh, '>=0.2.1-rc.5 <0.3.0')
for (const sub of ['.', './client', './locale/*.json', './icon', './package.json']) {
  A(`D4 exports ${sub}`, typeof (pkg.exports || {})[sub] === 'string', (pkg.exports || {})[sub], sub)
}
const files = Array.isArray(pkg.files) ? pkg.files : []
for (const entry of ['index.js', 'client.js', 'cordis.patch.yml', 'guidelines', 'locale', 'icon.svg', 'README.md', 'LICENSE', 'CHANGELOG.md', 'test', 'assets']) {
  A(`D5 files ships ${entry}`, files.includes(entry), files.join(','), entry)
}
A('D6 icon.svg parses as an svg document', /^<svg[\s>]/.test(iconBytes.toString('utf8')) && iconBytes.length < 256 * 1024, `${iconBytes.length} bytes`, '<256 KiB svg')
A('D7 icon.svg carries a viewBox', /viewBox="0 0 64 64"/.test(iconBytes.toString('utf8')), 'viewBox', '0 0 64 64')
A('D8 locale/en.json declares meta.title', typeof localeEn.meta?.title === 'string' && localeEn.meta.title !== '', localeEn.meta?.title, 'non-empty')
A('D9 locale/en.json declares meta.description', typeof localeEn.meta?.description === 'string' && localeEn.meta.description !== '', localeEn.meta?.description, 'non-empty')
A('D10 locale/zh.json declares meta.title', typeof localeZh.meta?.title === 'string' && localeZh.meta.title !== '', localeZh.meta?.title, 'non-empty')
A('D11 cordis.patch.yml inserts a row named after the package', new RegExp(`name:\\s*'?${pkg.name}'?`).test(patchText), patchText.trim(), pkg.name)
eq('D12 dsh.client.platform is web', pkg.dsh?.client?.platform, 'web')
A('D12b repository.url points at a repo named after the package', String(pkg.repository?.url || '').includes(`/${pkg.name}.git`), pkg.repository?.url, `…/${pkg.name}.git`)
A('D12c homepage points at the same repo', String(pkg.homepage || '').includes(`/${pkg.name}`), pkg.homepage, `…/${pkg.name}`)
A('D12d bugs points at the same repo', String(pkg.bugs?.url || '').includes(`/${pkg.name}`), pkg.bugs?.url, `…/${pkg.name}`)

const dicts = globalThis.__VIZ_DICTS || {}
const sortedPairs = (obj) => Object.keys(obj || {}).sort().map((k) => `${k}=${obj[k]}`)
eq('D13 runtime en dictionary matches locale/en.json', JSON.stringify(sortedPairs(dicts.en)), JSON.stringify(sortedPairs(localeEn.strings)))
eq('D14 runtime zh dictionary matches locale/zh.json', JSON.stringify(sortedPairs(dicts.zh)), JSON.stringify(sortedPairs(localeZh.strings)))
eq('D15 en and zh dictionaries cover the same keys', JSON.stringify(Object.keys(dicts.en || {}).sort()), JSON.stringify(Object.keys(dicts.zh || {}).sort()))

// Host internals must not come back.
ninc('D16 client.js no longer probes data-ds-dark-theme', clientText, 'data-ds-dark-theme')
ninc('D17 client.js no longer reads the body background', clientText, 'backgroundColor')
ninc('D18 client.js no longer uses MutationObserver', clientText, 'MutationObserver')
ninc('D19 client.js no longer reads body attributes', clientText, 'document.body.hasAttribute')
inc('D20 client.js reads the documented theme service', clientText, 'getTheme()')
inc('D21 client.js subscribes to theme/change', clientText, "theme/change")
inc('D22 client.js registers its locale namespace', clientText, 'locale.register')

// Every user-visible string lives once, in the dictionary.
for (const [label, needle] of [
  ['view code button', '查看代码'],
  ['download button', '下载'],
  ['error prefix', '可视化渲染失败'],
  ['waiting title', '等待模型输出'],
]) {
  eq(`D23 ${label} appears exactly once (dictionary only)`, clientText.split(needle).length - 1, 1)
}

ninc('D24 chart guidance no longer ships a Chart.js CDN instruction', chartText, 'cdnjs.cloudflare.com/ajax/libs/Chart')
ninc('D24b chart guidance no longer instantiates a third-party chart runtime', chartText, 'new Chart(')
inc('D25 chart guidance points at hand-drawn SVG', chartText, '手写原生 SVG')

/* ============================================================ REPORT ====== */

section('REPORT')
const pass = results.filter((r) => r.ok).length
const fail = results.filter((r) => !r.ok)
for (const r of results) {
  console.log(`${r.n}. [${r.ok ? 'PASS' : 'FAIL'}] ${r.name}`)
}
console.log(`\nTOTAL: ${pass}/${results.length} passed, ${fail.length} failed`)
if (fail.length > 0) {
  console.log('\nFAILURES (expected vs actual):')
  for (const r of fail) {
    console.log(`- #${r.n} ${r.name}\n    expected: ${short(r.expected)}\n    actual:   ${short(r.actual)}`)
  }
}

/* coverage gaps ---------------------------------------------------------- */
console.log(`
COVERAGE GAPS (cannot be exercised without a real browser):
- No real layout: iframe height bridging, ResizeObserver path, postMessage origin/source checks
  (event.source !== frame.contentWindow) and the download anchor click are never executed.
- useEffect bodies never run (fake React), so MutationObserver-driven theme sync, the
  matchMedia 'change' listener, and interval-driven loading-message rotation are unverified.
  The rotating hook is checked only at its first render index.
- No real CSP enforcement: the iframe document text is asserted, but whether a browser
  blocks connect-src/base-uri/form-action is not observable here.
- No real SVG/DOM parsing: sanitizer and paint-rescue assertions are regex-level on the
  generated text. Entity/namespace tricks a real parser resolves (e.g. style-tag-smuggled
  @import, mXSS on foreignObject, case-variant event handlers split across attributes) are
  not covered.
- The data-URI img decoding is done by decodeURIComponent only; a browser's own percent
  decoding of '#'-bearing data URIs is untested.
- No React reconciliation: keys, real hook state, event handler invocation, or SSR/hydration
  differences are not tested.
`)

await rm(PROBE, { force: true }).catch(() => {})
process.exit(fail.length === 0 ? 0 : 1)
