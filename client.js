/**
 * dsh-inline-visualizer — client half (browser artifact).
 *
 * Owns the keyed `tool.call.toolview` row named `show_widget`: DSH hands the
 * Tool row for that wire name to this component, which renders the widget the
 * arguments carry — inside the conversation, in place of the generic tool row.
 *
 * Two rendering paths:
 *   SVG  -> sanitized, tokens materialized, served as a data-URI <img> (no script, no DOM access)
 *   HTML -> sandbox="allow-scripts" iframe (opaque origin), CSP-pinned, height bridged
 *
 * Theme handling (v2): the active colour scheme comes from the documented
 * Client theme service (`ctx.theme.getTheme().colorScheme`) and every semantic
 * token resolves through the documented `--dsw-alias-*` custom properties.
 * No document attribute, body background colour or other host internal is read.
 * A `theme/change` subscription re-materialises the widget, so a live theme
 * switch re-colours cards that are already on screen.
 *
 * Copy: every user-visible string comes from this plugin's own locale
 * namespace, registered through `ctx.locale` and bound to the slot seat (`t`).
 */
window.__ModuleLoader__.load({
  id: 'dsh-inline-visualizer',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    const MAX_DOC_CHARS = 400000
    const CDN = ['https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://unpkg.com', 'https://esm.sh']
    const LEVELS = [50, 100, 300, 500, 700, 900]

    /** Palette ramps, 50 -> 900. Absolute artwork colours: never theme-flipped by the host. */
    const RAMPS = {
      neutral: ['#F7F7F6', '#EDEDEB', '#C6C6C2', '#8B8B86', '#4A4A47', '#232322'],
      blue: ['#EEF5FD', '#CFE3F9', '#8FB8E8', '#3B7DD8', '#1E4E96', '#12305C'],
      teal: ['#E9F6F2', '#C2E7DC', '#7FC9B4', '#1F9E7E', '#106552', '#0A3D33'],
      green: ['#EFF6E8', '#D2E6BE', '#9BC46F', '#5E9427', '#3A6016', '#233C0D'],
      amber: ['#FDF3E2', '#F7DEB0', '#EFB35B', '#C1811B', '#7E530F', '#4C3309'],
      coral: ['#FCEEE9', '#F6CDBE', '#EE9C7C', '#D45E33', '#8A3C20', '#542514'],
      red: ['#FBECEC', '#F4C4C4', '#E88E8E', '#D04545', '#872B2B', '#521A1A'],
      purple: ['#F1EEFC', '#D6CDF5', '#A99BE4', '#7259CE', '#4A3985', '#2D2351'],
    }
    const HUE = (name, level) => RAMPS[name][LEVELS.indexOf(level)]

    /* ------------------------------------------------------------ copy ---- */

    const NS = 'dsh-inline-visualizer'

    /** Runtime dictionaries; `locale/en.json` and `locale/zh.json` carry the same strings. */
    const DICTS = {
      zh: {
        'card.generating': '生成中',
        'card.waiting': '等待模型输出…',
        'card.showCode': '查看代码',
        'card.hideCode': '收起代码',
        'card.download': '下载',
        'card.fallbackTitle': '可视化',
        'error.prefix': '可视化渲染失败：{message}',
        'error.tooLong': '代码过长（{chars} 字符）',
        'error.svgIncomplete': 'SVG 代码不完整（缺少 </svg>）',
        'error.noContent': '没有可渲染的内容',
        'loading.1': '正在生成可视化…',
        'loading.2': '正在排版…',
        'loading.3': '马上就好…',
      },
      en: {
        'card.generating': 'Rendering',
        'card.waiting': 'Waiting for the model…',
        'card.showCode': 'Show code',
        'card.hideCode': 'Hide code',
        'card.download': 'Download',
        'card.fallbackTitle': 'Visual',
        'error.prefix': 'Could not render the visual: {message}',
        'error.tooLong': 'Code is too long ({chars} characters)',
        'error.svgIncomplete': 'Incomplete SVG: </svg> is missing',
        'error.noContent': 'Nothing to render',
        'loading.1': 'Drawing the diagram…',
        'loading.2': 'Laying it out…',
        'loading.3': 'Almost there…',
      },
    }

    /** Fallback translator: zh copy, `{name}` placeholders, unknown key -> key. */
    function fallbackT(key, params) {
      const table = DICTS.zh
      let text = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : key
      if (params) for (const name of Object.keys(params)) text = text.replace(`{${name}}`, String(params[name]))
      return text
    }

    function defaultLoading(t) {
      return ['loading.1', 'loading.2', 'loading.3'].map((key) => t(key)).filter((text) => text !== '')
    }

    /* ----------------------------------------------------------- tokens ---- */

    /**
     * Semantic tokens: documented `--dsw-alias-*` properties first, built-in
     * light/dark values as the fallback when a host token is absent.
     */
    const SEMANTIC = {
      'bg-primary': { light: '#FFFFFF', dark: '#1B1D22', host: ['--dsw-alias-bg-base'] },
      'bg-secondary': { light: '#F7F7F6', dark: '#23262C', host: ['--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2'] },
      'bg-tertiary': { light: '#EDEDEB', dark: '#2B2F36', host: ['--dsw-alias-bg-layer-3'] },
      'text-primary': { light: '#232322', dark: '#F2F4F7', host: ['--dsw-alias-label-primary'] },
      'text-secondary': { light: '#4A4A47', dark: '#C2C7D0', host: ['--dsw-alias-label-secondary'] },
      'text-tertiary': { light: '#8B8B86', dark: '#9AA0AB', host: ['--dsw-alias-label-tertiary', '--dsw-alias-label-caption'] },
      'border-subtle': { light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.10)', host: ['--dsw-alias-border-l1'] },
      'border-default': { light: 'rgba(0,0,0,0.14)', dark: 'rgba(255,255,255,0.15)', host: ['--dsw-alias-border-l2'] },
      'border-strong': { light: 'rgba(0,0,0,0.22)', dark: 'rgba(255,255,255,0.24)', host: ['--dsw-alias-border-l3', '--dsw-alias-border-l4'] },
      info: { light: HUE('blue', 500), dark: HUE('blue', 300), host: ['--dsw-alias-state-business-primary'] },
      success: { light: HUE('green', 500), dark: HUE('green', 300), host: ['--dsw-alias-state-success-primary'] },
      warning: { light: HUE('amber', 500), dark: HUE('amber', 300), host: ['--dsw-alias-state-warn-primary'] },
      danger: { light: HUE('red', 500), dark: HUE('red', 300), host: ['--dsw-alias-state-error-primary'] },
      'font-sans': {
        value: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
        host: [],
      },
      'font-serif': { value: 'ui-serif, Georgia, Cambria, "Songti SC", "SimSun", serif', host: [] },
      'font-mono': {
        value: 'ui-monospace, SFMono-Regular, "Cascadia Mono", Consolas, "Liberation Mono", monospace',
        host: ['--ds-font-family-code'],
      },
      'radius-sm': { value: '8px', host: ['--dsw-radius-sm'] },
      'radius-md': { value: '12px', host: ['--dsw-radius-md'] },
      'radius-lg': { value: '16px', host: ['--dsw-radius-lg'] },
    }

    /** Read a documented host custom property. Never reads attributes or layout. */
    function hostValue(names) {
      if (!names || names.length === 0) return null
      try {
        const root = getComputedStyle(document.documentElement)
        const body = getComputedStyle(document.body)
        for (const name of names) {
          const raw = (root.getPropertyValue(name) || body.getPropertyValue(name) || '').trim()
          if (raw !== '') return raw
        }
      } catch {
        /* detached document or denied computed style: fall through to built-ins */
      }
      return null
    }

    function tokenValue(name, theme) {
      const spec = SEMANTIC[name]
      if (spec === undefined) {
        // --viz-{hue}-{level}
        const parts = /^([a-z]+)-(\d+)$/.exec(name)
        if (parts !== undefined && RAMPS[parts[1]] !== undefined && LEVELS.includes(Number(parts[2]))) {
          return RAMPS[parts[1]][LEVELS.indexOf(Number(parts[2]))]
        }
        return null
      }
      const hosted = hostValue(spec.host)
      if (hosted !== null) return hosted
      if (spec.value !== undefined) return spec.value
      return theme === 'dark' ? spec.dark : spec.light
    }

    /** The whole --viz-* contract as a CSS rule block for one theme. */
    function tokenCss(theme) {
      const rows = []
      for (const name of Object.keys(SEMANTIC)) {
        const value = tokenValue(name, theme)
        if (value !== null) rows.push(`--viz-${name}:${value}`)
      }
      for (const hue of Object.keys(RAMPS)) {
        for (const level of LEVELS) rows.push(`--viz-${hue}-${level}:${RAMPS[hue][LEVELS.indexOf(level)]}`)
      }
      return `:root{${rows.join(';')}}`
    }

    /* ------------------------------------------------------------ theme ---- */

    /** Active plugin context; set once by `apply`, used by hooks below. */
    let CTX = null

    /** Read the colour scheme from the documented theme service. */
    function readTheme() {
      try {
        const service = CTX && CTX.theme
        if (service && typeof service.getTheme === 'function') {
          const snapshot = service.getTheme()
          if (snapshot && snapshot.colorScheme === 'dark') return 'dark'
          if (snapshot && snapshot.colorScheme === 'light') return 'light'
        }
      } catch {
        /* service unavailable: fall through */
      }
      try {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      } catch {
        return 'light'
      }
    }

    /** Colour scheme, re-read on every `theme/change`. */
    function useTheme() {
      const [theme, setTheme] = useState(readTheme)
      useEffect(() => {
        const service = CTX && CTX.theme
        if (!service || typeof CTX.on !== 'function') return undefined
        return CTX.on('theme/change', () => setTheme((prev) => {
          const next = readTheme()
          return prev === next ? prev : next
        }))
      }, [])
      return theme
    }

    /* --------------------------------------------------------- sanitize ---- */

    const FORBIDDEN = /<\s*(script|foreignObject|iframe|object|embed|animate|animateTransform|animateMotion|set|audio|video|link|meta|base|image\s[^>]*xlink:href\s*=\s*["']https?:)[\s\S]*?(?:\/\s*>|<\s*\/\s*[a-zA-Z]+\s*>)/gi

    function sanitizeSvg(source) {
      let out = source
      // Comments are noise; event handlers and URL-typed attributes are the attack surface.
      out = out.replace(/<!--[\s\S]*?-->/g, '')
      out = out.replace(FORBIDDEN, '')
      out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
      out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
      out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
      out = out.replace(/\s(href|xlink:href|src)\s*=\s*(["'])\s*(?:javascript:|data:text\/html)[\s\S]*?\2/gi, '')
      out = out.replace(/<\s*script\b[\s\S]*?<\s*\/\s*script\s*>/gi, '')
      return out
    }

    /**
     * Rescue `fill="var(--viz-x)"`: presentation attributes never resolve var().
     * A painted attribute carrying a var() reference is moved into the same
     * element's style attribute, where CSS does resolve it.
     */
    const PAINT_ATTRS = /^(?:fill|stroke|stop-color|flood-color|lighting-color|color|font-family|font-size|font-weight)$/i
    const TAG_RE = /<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g
    const ATTR_RE = /([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

    function rescuePaintAttrs(source) {
      return source.replace(TAG_RE, (whole, tagName, attrs, selfClose) => {
        const moved = []
        const kept = attrs.replace(ATTR_RE, (match, name, doubleQuoted, singleQuoted) => {
          const value = doubleQuoted !== undefined ? doubleQuoted : singleQuoted
          if (!PAINT_ATTRS.test(name) || !value.includes('var(')) return match
          moved.push(`${name}:${value}`)
          return ''
        })
        if (moved.length === 0) return whole
        const existing = /style\s*=\s*"([^"]*)"/.exec(kept)
        const rest =
          existing !== null
            ? kept.replace(existing[0], `style="${existing[1].replace(/;\s*$/, '')};${moved.join(';')}"`)
            : `${kept} style="${moved.join(';')}"`
        return `<${tagName}${rest}${selfClose}>`
      })
    }

    /* ------------------------------------------------------------- docs ---- */

    function stripFences(source) {
      return String(source)
        .replace(/^\s*```[a-zA-Z]*\s*/, '')
        .replace(/\s*```\s*$/, '')
        .trim()
    }

    /** Match the opening `<svg …>` tag, tolerating `>` inside quoted attribute values. */
    const SVG_OPEN_TAG = /<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/i

    /** Does this opening tag already carry the attribute? (quote-aware tag in, so no false negative) */
    function hasAttr(tag, name) {
      return new RegExp('\\s' + name + '\\s*=', 'i').test(tag)
    }

    function buildSvgDocument(code, theme) {
      let out = rescuePaintAttrs(sanitizeSvg(stripFences(code)))
      const tag = out.match(SVG_OPEN_TAG)
      if (tag) {
        // Never duplicate an attribute the author already wrote: in HTML the FIRST
        // occurrence wins, so a blind injection would shadow the author's value.
        const missing = []
        if (!hasAttr(tag[0], 'xmlns')) missing.push('xmlns="http://www.w3.org/2000/svg"')
        if (!hasAttr(tag[0], 'data-viz-theme')) missing.push(`data-viz-theme="${theme}"`)
        if (!hasAttr(tag[0], 'style')) missing.push('style="max-width:100%;height:auto;display:block"')
        const opener = missing.length === 0 ? tag[0] : tag[0].replace(/^<svg\b/i, `<svg ${missing.join(' ')}`)
        const css = `${tokenCss(theme)}text{font-family:var(--viz-font-sans)}`
        out = out.replace(tag[0], () => `${opener}<style>${css}</style>`)
      }
      return out
    }

    function heightBridge(token) {
      return (
        '<script>(function(){var T=' + JSON.stringify(token) + ';function send(){try{' +
        "parent.postMessage({type:'viz:height',token:T,height:Math.ceil(document.documentElement.scrollHeight)}" +
        "}catch(e){}}if(window.ResizeObserver){try{new ResizeObserver(send).observe(document.documentElement)}catch(e){}}" +
        "window.addEventListener('load',send);document.addEventListener('DOMContentLoaded',send);" +
        'setTimeout(send,60);setTimeout(send,400);setTimeout(send,1200)})()</' + 'script>'
      )
    }

    function buildHtmlDocument(code, theme, token) {
      const csp = [
        "default-src 'none'",
        `script-src 'unsafe-inline' ${CDN.join(' ')}`,
        `style-src 'unsafe-inline' ${CDN.join(' ')}`,
        'img-src data: https:',
        'media-src data:',
        'font-src data: https:',
        "connect-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; ')
      const body = stripFences(code)
      const head =
        '<!doctype html><html data-viz-theme="' + theme + '"><head><meta charset="utf-8">' +
        '<meta http-equiv="Content-Security-Policy" content="' + csp + '">' +
        '<style>' + tokenCss(theme) +
        'html{color-scheme:' + theme + '}html,body{margin:0;padding:0;background:transparent;' +
        'color:var(--viz-text-primary);font:13px/1.6 var(--viz-font-sans)}' +
        '*,*::before,*::after{box-sizing:border-box}' +
        '[data-viz-theme] .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
        '</style></head><body>'
      return head + body + heightBridge(token) + '</body></html>'
    }

    function toDataUrl(document_, kind) {
      const mime = kind === 'svg' ? 'image/svg+xml' : 'text/html'
      return `data:${mime};charset=utf-8,${encodeURIComponent(document_)}`
    }

    /* --------------------------------------------------------- arguments ---- */

    /** Mirror of the host's parsedToolCall: read the call head, tolerate streaming gaps. */
    function parseCall(block) {
      if (!block) return null
      if (!('kind' in block) && block.phase === 'preparing') return null
      const call = 'kind' in block ? block.call : block
      if (!call || typeof call.argsRaw !== 'string') return null
      try {
        const value = JSON.parse(call.argsRaw)
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
        return { name: call.name, args: value }
      } catch {
        return null
      }
    }

    function loadingMessages(args, t) {
      const raw = args && Array.isArray(args.loading_messages) ? args.loading_messages : []
      const out = raw.map((entry) => String(entry).trim()).filter((entry) => entry !== '').slice(0, 5)
      return out.length > 0 ? out : defaultLoading(t)
    }

    /* -------------------------------------------------------- components ---- */

    const S = {
      card: {
        margin: '4px 0',
        border: '1px solid var(--dsw-alias-border-l1, var(--viz-border-subtle))',
        borderRadius: 'var(--dsw-radius-md, var(--viz-radius-md))',
        background: 'var(--dsw-alias-bg-layer-1, var(--viz-bg-primary))',
        overflow: 'hidden',
      },
      head: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 10px',
        fontSize: '12px',
        lineHeight: '16px',
        color: 'var(--dsw-alias-label-secondary, var(--viz-text-secondary))',
        background: 'var(--dsw-alias-bg-layer-2, var(--viz-bg-secondary))',
      },
      title: {
        flex: '1 1 auto',
        minWidth: '0',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: 500,
        color: 'var(--dsw-alias-label-primary, var(--viz-text-primary))',
      },
      badge: {
        flex: '0 0 auto',
        padding: '0 6px',
        borderRadius: '999px',
        border: '1px solid var(--dsw-alias-border-l2, var(--viz-border-default))',
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      },
      button: {
        flex: '0 0 auto',
        font: 'inherit',
        color: 'inherit',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 'var(--dsw-radius-sm, var(--viz-radius-sm))',
        padding: '2px 6px',
        cursor: 'pointer',
      },
      body: {
        padding: '10px',
        background: 'var(--dsw-alias-bg-base, var(--viz-bg-primary))',
        overflow: 'auto',
        maxHeight: '72vh',
      },
      skeleton: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minHeight: '56px',
        padding: '16px 12px',
        fontSize: '12px',
        color: 'var(--dsw-alias-label-tertiary, var(--viz-text-tertiary))',
      },
      pre: {
        margin: '0',
        padding: '10px',
        maxHeight: '320px',
        overflow: 'auto',
        background: 'var(--dsw-alias-bg-layer-3, var(--viz-bg-tertiary))',
        borderRadius: 'var(--dsw-radius-sm, var(--viz-radius-sm))',
        font: '11px/1.5 var(--ds-font-family-code, ui-monospace, monospace)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        color: 'var(--dsw-alias-label-secondary, var(--viz-text-secondary))',
      },
      error: {
        padding: '10px',
        fontSize: '12px',
        color: 'var(--viz-danger)',
        whiteSpace: 'pre-wrap',
      },
    }

    function Spin() {
      return h(
        'span',
        {
          'aria-hidden': true,
          style: {
            width: '10px',
            height: '10px',
            border: '1.5px solid var(--dsw-alias-border-l2, var(--viz-border-default))',
            borderTopColor: 'var(--dsw-alias-label-tertiary, var(--viz-text-tertiary))',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'viz-spin 0.9s linear infinite',
          },
        },
        h('style', null, '@keyframes viz-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){span[aria-hidden]{animation:none!important}}'),
      )
    }

    function useRotating(messages) {
      const [index, setIndex] = useState(0)
      useEffect(() => {
        if (messages.length <= 1) return undefined
        const timer = setInterval(() => setIndex((prev) => (prev + 1) % messages.length), 1400)
        return () => clearInterval(timer)
      }, [messages.length])
      return messages[Math.min(index, messages.length - 1)] || ''
    }

    function Skeleton({ messages }) {
      const text = useRotating(messages)
      return h('div', { style: S.skeleton }, h(Spin), h('span', null, text))
    }

    function HtmlBody({ document_, title, minHeight }) {
      const ref = useRef(null)
      const [height, setHeight] = useState(0)
      useEffect(() => {
        const frame = ref.current
        if (!frame) return undefined
        const onMessage = (event) => {
          const data = event.data
          if (!data || data.type !== 'viz:height' || typeof data.height !== 'number') return
          if (event.source !== frame.contentWindow) return
          const next = Math.max(48, Math.min(4000, Math.round(data.height)))
          setHeight((prev) => (Math.abs(prev - next) < 2 ? prev : next))
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
      }, [document_])
      return h('iframe', {
        ref,
        title,
        srcDoc: document_,
        sandbox: 'allow-scripts',
        referrerPolicy: 'no-referrer',
        loading: 'lazy',
        style: {
          display: 'block',
          width: '100%',
          height: `${height > 0 ? height : minHeight}px`,
          border: 'none',
          background: 'transparent',
        },
      })
    }

    function CardHead({ kind, title, note, children }) {
      return h(
        'div',
        { style: S.head },
        h('span', { style: S.badge }, kind),
        h('span', { style: S.title, title }, title),
        note ? h('span', { style: { flex: '0 0 auto', fontSize: '11px', opacity: 0.75 } }, note) : null,
        children,
      )
    }

    /** Shown while the model is still streaming, or before any argument exists. */
    function WaitingCard({ messages, t }) {
      return h(
        'div',
        { style: S.card, role: 'group', 'aria-busy': 'true' },
        h(CardHead, { kind: t('card.generating'), title: t('card.waiting') }),
        h('div', { style: S.body }, h(Skeleton, { messages })),
      )
    }

    function WidgetCard({ title, kind, code, document_, fileName, t }) {
      const [showSource, setShowSource] = useState(false)
      const size = `${(code.length / 1024).toFixed(1)} KB`
      const download = () => {
        try {
          const anchor = document.createElement('a')
          anchor.href = toDataUrl(document_, kind)
          anchor.download = fileName
          anchor.rel = 'noopener'
          anchor.click()
        } catch {
          /* download is a convenience: ignore a blocked anchor */
        }
      }

      return h(
        'div',
        { style: S.card, role: 'group', 'aria-label': title },
        h(
          CardHead,
          { kind, title, note: size },
          h('button', { type: 'button', style: S.button, onClick: () => setShowSource((prev) => !prev) }, showSource ? t('card.hideCode') : t('card.showCode')),
          h('button', { type: 'button', style: S.button, onClick: download }, t('card.download')),
        ),
        showSource
          ? h('div', { style: { padding: '10px' } }, h('pre', { style: S.pre }, code))
          : h(
              'div',
              { style: S.body },
              kind === 'svg'
                ? h('img', {
                    src: toDataUrl(document_, 'svg'),
                    alt: title,
                    style: { display: 'block', width: '100%', height: 'auto' },
                  })
                : h(HtmlBody, { document_, title, minHeight: 240 }),
            ),
      )
    }

    function ErrorCard({ message, t }) {
      const text = t('error.prefix').replace('{message}', message)
      return h('div', { style: S.card, role: 'alert' }, h('div', { style: S.error }, text))
    }

    /** The tool.call.toolview row for `show_widget`. */
    function ShowWidgetRow(props) {
      const t = typeof props.t === 'function' ? props.t : fallbackT
      const theme = useTheme()
      const parsed = parseCall(props.block)

      const built = useMemo(() => {
        if (parsed === null) return null
        const args = parsed.args || {}
        const code = typeof args.widget_code === 'string' ? args.widget_code : ''
        if (code.trim() === '') return null
        if (code.length > MAX_DOC_CHARS) return { error: t('error.tooLong').replace('{chars}', String(code.length)) }
        const title = typeof args.title === 'string' && args.title.trim() !== '' ? args.title.trim() : t('card.fallbackTitle')
        const kind = /<svg[\s>]/i.test(code) ? 'svg' : 'html'
        const fileName = `${title.replace(/[\\/:*?"<>|\s-]+/g, '_').replace(/^_+|_+$/g, '') || 'widget'}.${kind}`
        try {
          if (kind === 'svg') {
            if (!/<\/\s*svg\s*>/i.test(code)) return { error: t('error.svgIncomplete') }
            return { title, kind, code, fileName, document_: buildSvgDocument(code, theme) }
          }
          const token = 'viz-static'
          return { title, kind, code, fileName, document_: buildHtmlDocument(code, theme, token) }
        } catch (error) {
          return { error: error && error.message ? error.message : String(error) }
        }
      }, [parsed, theme, t])

      if (built !== null && built.error !== undefined) return h(ErrorCard, { message: built.error, t })
      if (built === null) return h(WaitingCard, { messages: loadingMessages(parsed && parsed.args, t), t })
      return h(WidgetCard, { ...built, t })
    }

    return {
      inject: ['slots', 'locale', 'theme'],
      apply(ctx) {
        CTX = ctx

        // Own namespace dictionaries; the slot seat (`t`) is bound from it.
        if (ctx.locale) {
          const register = () => ctx.locale.register(NS, DICTS)
          if (typeof ctx.effect === 'function') ctx.effect(register, 'dsh-inline-visualizer: dictionaries')
          else register()
        }

        ctx.slots.inject('tool.call.toolview', () => {
          const t = ctx.locale && typeof ctx.locale.bind === 'function' ? ctx.locale.bind(NS) : fallbackT
          return ctx.slots.register(
            { name: 'tool.call.toolview', key: 'show_widget', locale: NS, inject: () => ({ t }) },
            ShowWidgetRow,
          )
        })
      },
    }
  },
})
