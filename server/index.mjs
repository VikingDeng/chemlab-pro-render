import { createServer } from 'node:http'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PROJECT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DIST_DIR = resolve(PROJECT_ROOT, 'dist')
const DEFAULT_ENV_FILE = resolve(PROJECT_ROOT, '.env')
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
}

function parseEnvValue(rawValue) {
  const value = rawValue.trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}

function loadProjectEnv() {
  const envFile = (process.env.CHEMLAB_ENV_FILE || DEFAULT_ENV_FILE).trim()
  if (!existsSync(envFile)) return
  const text = readFileSync(envFile, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line
    const separatorIndex = normalized.indexOf('=')
    if (separatorIndex <= 0) continue
    const key = normalized.slice(0, separatorIndex).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue
    process.env[key] = parseEnvValue(normalized.slice(separatorIndex + 1))
  }
}

loadProjectEnv()

const PORT = Number(process.env.PORT || 8787)
const MAX_BODY_SIZE = 1024 * 1024
const DEFAULT_LLM_TIMEOUT_MS = 8000
const TOOL_TYPES = new Set(['focus_container', 'open_logs', 'open_reagents', 'save_note'])
const INTERNAL_REPLY_PATTERNS = [
  /risks\s*[:：]?\s*为空/i,
  /context\s*(显示|shows|indicates)?/i,
  /localSignals/i,
  /沙盒模式下?风险较低/i,
  /沙盒模式下?/i,
]
const GROUNDING_TERMS = [
  {
    key: 'Fe',
    patterns: [/Fe(?:[²³23]?\+)?/i, /亚铁|铁离子|氢氧化铁|氢氧化亚铁|氯化铁|硫酸亚铁/],
  },
  {
    key: 'Cu',
    patterns: [/Cu(?:[²2]?\+)?/i, /铜离子|氢氧化铜|硫酸铜/],
  },
  {
    key: 'Ag',
    patterns: [/Ag\+?/i, /银离子|硝酸银|氯化银|银镜/],
  },
  {
    key: 'Ba',
    patterns: [/Ba(?:[²2]?\+)?/i, /钡离子|氯化钡|硫酸钡/],
  },
  {
    key: 'Mn',
    patterns: [/Mn/i, /锰|高锰酸钾/],
  },
]

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  res.end(JSON.stringify(payload))
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
  })
  res.end(text)
}

function sendStaticFile(req, res, filePath) {
  const ext = extname(filePath).toLowerCase()
  const method = req.method || 'GET'
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  })
  if (method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(filePath).pipe(res)
}

function tryServeStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  if (!existsSync(DIST_DIR)) return false

  const rawPathname = decodeURIComponent(url.pathname)
  const normalizedPathname = rawPathname === '/' ? '/index.html' : rawPathname
  let filePath = resolve(DIST_DIR, `.${normalizedPathname}`)
  const insideDist = filePath === DIST_DIR || filePath.startsWith(`${DIST_DIR}${sep}`)
  if (!insideDist) {
    sendText(res, 403, 'Forbidden')
    return true
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    filePath = resolve(DIST_DIR, 'index.html')
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false
  sendStaticFile(req, res, filePath)
  return true
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0

  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_SIZE) {
      throw new Error('请求体过大')
    }
    chunks.push(chunk)
  }

  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return {}
  return JSON.parse(text)
}

function sanitizeConversation(conversation) {
  if (!Array.isArray(conversation)) return []
  return conversation
    .map((entry) => {
      const role = entry?.role === 'agent' ? 'assistant' : entry?.role === 'assistant' ? 'assistant' : 'user'
      const text = typeof entry?.text === 'string' ? entry.text.trim() : typeof entry?.content === 'string' ? entry.content.trim() : ''
      if (!text) return null
      return { role, text }
    })
    .filter(Boolean)
    .slice(-8)
}

function sanitizeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) return []
  return toolCalls
    .map((toolCall) => {
      if (!toolCall || typeof toolCall !== 'object') return null
      const type = typeof toolCall.type === 'string' ? toolCall.type : ''
      if (!TOOL_TYPES.has(type)) return null
      return {
        type,
        targetId: typeof toolCall.targetId === 'string' ? toolCall.targetId : undefined,
        note: typeof toolCall.note === 'string' ? toolCall.note : undefined,
      }
    })
    .filter(Boolean)
}

function inferIntentLabel(intent) {
  switch (intent) {
    case 'titration':
      return '滴定控制'
    case 'precipitation':
      return '沉淀分离'
    case 'extraction':
      return '液液萃取'
    case 'heating':
      return '热过程'
    case 'distillation':
      return '蒸馏转移'
    default:
      return '自由探索'
  }
}

function sanitizeSpecies(species) {
  if (!Array.isArray(species)) return []
  return species
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const formula = typeof entry.formula === 'string' ? entry.formula.trim() : ''
      const label = typeof entry.label === 'string' ? entry.label.trim() : formula
      const amount = Number.isFinite(entry.amount) ? Number(entry.amount) : null
      if (!formula && !label) return null
      return { formula: formula || label, label: label || formula, amount }
    })
    .filter(Boolean)
    .slice(0, 10)
}

function sanitizeLastEvent(lastEvent) {
  if (!lastEvent || typeof lastEvent !== 'object') return null
  return {
    kind: typeof lastEvent.kind === 'string' ? lastEvent.kind : undefined,
    name: typeof lastEvent.name === 'string' ? lastEvent.name : undefined,
    reacted: typeof lastEvent.reacted === 'string' ? lastEvent.reacted : undefined,
    temp: Number.isFinite(lastEvent.temp) ? Number(lastEvent.temp) : undefined,
    ph: Number.isFinite(lastEvent.ph) ? Number(lastEvent.ph) : undefined,
  }
}

function buildContextDigest(context = {}) {
  const focused = context.focusedContainer && typeof context.focusedContainer === 'object'
    ? context.focusedContainer
    : null
  const containers = Array.isArray(context.containers) ? context.containers.slice(0, 4) : []
  const localSignals = context.localSignals && typeof context.localSignals === 'object' ? context.localSignals : {}
  const risks = Array.isArray(localSignals.risks)
    ? localSignals.risks.filter((entry) => typeof entry === 'string' && entry.trim())
    : []
  const availableSkills = Array.isArray(context.availableSkills)
    ? context.availableSkills.filter((entry) => typeof entry === 'string' && TOOL_TYPES.has(entry))
    : []

  return {
    mode: typeof context.mode === 'string' ? context.mode : 'free',
    challenge: context.challenge && typeof context.challenge === 'object'
      ? {
          id: typeof context.challenge.id === 'string' ? context.challenge.id : undefined,
          title: typeof context.challenge.title === 'string' ? context.challenge.title : undefined,
          target: typeof context.challenge.target === 'string' ? context.challenge.target : undefined,
          completed: Boolean(context.challenge.completed),
        }
      : null,
    intent: typeof localSignals.intent === 'string' ? localSignals.intent : 'exploration',
    risks,
    goal: localSignals.goal && typeof localSignals.goal === 'object'
      ? {
          title: typeof localSignals.goal.title === 'string' ? localSignals.goal.title : undefined,
          progress: typeof localSignals.goal.progress === 'string' ? localSignals.goal.progress : undefined,
          status: typeof localSignals.goal.status === 'string' ? localSignals.goal.status : undefined,
        }
      : null,
    lastEvent: sanitizeLastEvent(context.lastEvent),
    focusedContainer: focused
      ? {
          id: typeof focused.id === 'string' ? focused.id : undefined,
          name: typeof focused.name === 'string' ? focused.name : '当前容器',
          type: typeof focused.type === 'string' ? focused.type : 'container',
          volume: Number.isFinite(focused.volume) ? Number(focused.volume) : null,
          temperature: Number.isFinite(focused.temperature) ? Number(focused.temperature) : null,
          ph: Number.isFinite(focused.ph) ? Number(focused.ph) : null,
          pressure: Number.isFinite(focused.pressure) ? Number(focused.pressure) : null,
          state: typeof focused.state === 'string' ? focused.state : 'idle',
          organicVolume: Number.isFinite(focused.organicVolume) ? Number(focused.organicVolume) : null,
          organicColor: typeof focused.organicColor === 'string' ? focused.organicColor : null,
          species: sanitizeSpecies(focused.species),
        }
      : null,
    containers: containers.map((container) => ({
      id: typeof container?.id === 'string' ? container.id : undefined,
      name: typeof container?.name === 'string' ? container.name : '容器',
      type: typeof container?.type === 'string' ? container.type : 'container',
      volume: Number.isFinite(container?.volume) ? Number(container.volume) : null,
      temperature: Number.isFinite(container?.temperature) ? Number(container.temperature) : null,
      ph: Number.isFinite(container?.ph) ? Number(container.ph) : null,
      pressure: Number.isFinite(container?.pressure) ? Number(container.pressure) : null,
      state: typeof container?.state === 'string' ? container.state : 'idle',
      organicVolume: Number.isFinite(container?.organicVolume) ? Number(container.organicVolume) : null,
      organicColor: typeof container?.organicColor === 'string' ? container.organicColor : null,
      species: sanitizeSpecies(container?.species),
    })),
    availableSkills,
  }
}

function buildSuggestedPrompts(contextDigest) {
  const prompts = ['下一步', '解释现象', '安全风险']

  if (contextDigest.focusedContainer?.name) {
    prompts.unshift('分析当前容器')
  }

  if (contextDigest.intent === 'titration') {
    prompts.unshift('继续滴定吗')
  } else if (contextDigest.intent === 'extraction') {
    prompts.unshift('看哪一层')
  } else if (contextDigest.intent === 'heating') {
    prompts.unshift('继续加热吗')
  }

  return Array.from(new Set(prompts)).slice(0, 3)
}

function buildToolCalls(message, contextDigest) {
  const lowerMessage = message.toLowerCase()
  const toolCalls = []

  if ((lowerMessage.includes('日志') || lowerMessage.includes('记录')) && contextDigest.availableSkills.includes('open_logs')) {
    toolCalls.push({ type: 'open_logs' })
  }

  if ((lowerMessage.includes('试剂') || lowerMessage.includes('reagent')) && contextDigest.availableSkills.includes('open_reagents')) {
    toolCalls.push({ type: 'open_reagents' })
  }

  if ((lowerMessage.includes('看看') || lowerMessage.includes('聚焦') || lowerMessage.includes('focus')) && contextDigest.focusedContainer?.id && contextDigest.availableSkills.includes('focus_container')) {
    toolCalls.push({ type: 'focus_container', targetId: contextDigest.focusedContainer.id })
  }

  if ((lowerMessage.includes('记一下') || lowerMessage.includes('笔记') || lowerMessage.includes('总结一下')) && contextDigest.availableSkills.includes('save_note')) {
    toolCalls.push({
      type: 'save_note',
      note: `拉瓦锡备忘：${contextDigest.focusedContainer?.name || '当前实验'}需要继续关注 ${inferIntentLabel(contextDigest.intent)}。`,
    })
  }

  return toolCalls.slice(0, 3)
}

function formatSpeciesList(species) {
  if (!Array.isArray(species) || species.length === 0) return ''
  return species
    .slice(0, 5)
    .map((entry) => entry.label || entry.formula)
    .filter(Boolean)
    .join('、')
}

function inferChemExplanation(contextDigest) {
  const focusedSpecies = contextDigest.focusedContainer?.species || []
  const allSpecies = [
    ...focusedSpecies,
    ...contextDigest.containers.flatMap((container) => container.species || []),
  ]
  const labels = allSpecies.map((entry) => `${entry.formula || ''} ${entry.label || ''}`).join(' ')
  const eventText = `${contextDigest.lastEvent?.name || ''} ${contextDigest.lastEvent?.reacted || ''} ${labels}`

  if (/Cu\\(OH\\)2|氢氧化铜|蓝绿|CuSO4|硫酸铜/.test(eventText)) {
    return '蓝绿色絮状物来自 Cu²⁺ 与 OH⁻ 生成难溶 Cu(OH)₂；继续少量加碱即可观察沉淀增多。'
  }
  if (/AgCl|氯化银|硝酸银|白色/.test(eventText)) {
    return '白色浑浊来自 Ag⁺ 与 Cl⁻ 生成难溶 AgCl；这是典型沉淀反应。'
  }
  if (/Fe\\(SCN\\)3|硫氰|血红|变红/.test(eventText)) {
    return '血红色来自 Fe³⁺ 与 SCN⁻ 形成 Fe(SCN)₃ 络合物；颜色越深通常代表络合物越多。'
  }
  if (/CO2|二氧化碳|冒泡|气泡|碳酸钠/.test(eventText)) {
    return '气泡主要是碳酸盐遇酸释放 CO₂；加酸越快，冒泡会越明显。'
  }
  if (/I2_org|有机相碘|紫色|四氯化碳|分层/.test(eventText)) {
    return '紫色层来自碘更容易进入有机相；静置后看颜色最深的那一层。'
  }
  if (/MnSO4|高锰酸钾|褪色|草酸|KMnO4/.test(eventText)) {
    return '紫色褪去是 MnO₄⁻ 在酸性条件下被草酸还原；同时可能产生 CO₂ 气泡。'
  }
  return ''
}

function buildFallbackReply(message, contextDigest) {
  const focused = contextDigest.focusedContainer
  const speciesText = focused ? formatSpeciesList(focused.species) : ''
  const explanation = inferChemExplanation(contextDigest)
  const asksExplanation = message.includes('为什么') || message.includes('解释') || /why|explain/i.test(message)
  const asksSafety = asksForSafety(message)

  if (contextDigest.risks.length > 0) {
    return `先处理风险：${contextDigest.risks[0]}。暂停加料，观察温度、压力和容器余量。`
  }

  if (asksSafety) {
    return speciesText
      ? `${focused?.name || '当前容器'}里主要有 ${speciesText}；当前读数未显示满量、高温或高压风险。继续小体积加料，避免飞溅。`
      : '当前没有足够信息判断特定风险；读数未显示满量、高温或高压风险。继续小体积加料，佩戴护目镜和手套。'
  }

  if (explanation && asksExplanation) {
    return explanation
  }

  if (explanation) {
    return `${explanation} 下一步小体积补加目标试剂，观察颜色或沉淀是否继续增强。`
  }

  if (speciesText) {
    return `${focused?.name || '当前容器'}里主要有 ${speciesText}。下一步先少量加入目标试剂，再看颜色、沉淀或分层变化。`
  }

  return focused
    ? `${focused.name}当前没有明确试剂记录；我不会猜具体离子。先加入本关推荐试剂中的第一种。`
    : '还没有锁定主容器；先选择一个烧杯开始。'
}

function buildFallbackResponse(input) {
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  const contextDigest = buildContextDigest(input.context)
  const hasGroundedContext = hasConcreteExperimentContext(contextDigest) || Boolean(contextDigest.focusedContainer)
  const headlineBase = contextDigest.risks[0]
    ? `拉瓦锡警告：${contextDigest.risks[0]}`
    : hasGroundedContext
      ? `拉瓦锡判断：当前更接近${inferIntentLabel(contextDigest.intent)}阶段。`
      : '拉瓦锡提醒：还没拿到具体实验体系。'

  return {
    reply: buildFallbackReply(message, contextDigest),
    headline: headlineBase,
    suggestedPrompts: buildSuggestedPrompts(contextDigest),
    toolCalls: buildToolCalls(message, contextDigest),
    statusLabel: '后端已就绪 · 待接入 LLM',
  }
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeAssistantText(text) {
  if (typeof text !== 'string') return ''
  return text
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/^\s*\d+[.)、]\s+/gm, '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function compactAssistantText(text, maxChars = 180) {
  const normalized = normalizeAssistantText(text)
  if (!normalized) return ''
  const sentences = normalized.match(/[^。！？.!?]+[。！？.!?]?/g) || [normalized]
  let compact = sentences.slice(0, 2).join('').trim()
  if (compact.length > maxChars) {
    compact = `${compact.slice(0, maxChars).replace(/[，,；;：:]?[^，,；;：:。！？.!?]*$/, '')}。`
  }
  return compact || normalized.slice(0, maxChars)
}

function collectGroundingText(contextDigest, message) {
  return JSON.stringify({
    message,
    challenge: contextDigest.challenge,
    lastEvent: contextDigest.lastEvent,
    focusedSpecies: contextDigest.focusedContainer?.species || [],
    containerSpecies: contextDigest.containers.flatMap((container) => container.species || []),
  })
}

function hasConcreteExperimentContext(contextDigest) {
  if (contextDigest.focusedContainer?.species?.length) return true
  if (contextDigest.containers.some((container) => container.species?.length)) return true
  if (contextDigest.lastEvent?.name || contextDigest.lastEvent?.reacted) return true
  return Boolean(contextDigest.challenge?.target)
}

function asksForSafety(message) {
  return /危险|风险|安全|防护|hazard|risk|safety/i.test(message)
}

function hasUnsupportedGroundingTerms(text, contextDigest, message) {
  if (!text) return false
  const groundingText = collectGroundingText(contextDigest, message)
  return GROUNDING_TERMS.some(({ key, patterns }) => {
    const mentioned = patterns.some((pattern) => pattern.test(text))
    if (!mentioned) return false
    return !new RegExp(key, 'i').test(groundingText) && !patterns.some((pattern) => pattern.test(groundingText))
  })
}

function shouldSkipLlm(input, contextDigest) {
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  if (asksForSafety(message)) return true
  return !hasConcreteExperimentContext(contextDigest)
}

function polishLlmResponse(response, fallback, contextDigest, message) {
  const reply = compactAssistantText(response?.reply)
  const headline = compactAssistantText(response?.headline, 80)
  const hasInternalLeak = INTERNAL_REPLY_PATTERNS.some((pattern) => pattern.test(reply) || pattern.test(headline))
  const hasUnsupportedTerms = hasUnsupportedGroundingTerms(reply, contextDigest, message)

  if (!reply || hasInternalLeak || hasUnsupportedTerms) {
    return {
      ...fallback,
      statusLabel: response?.statusLabel || fallback.statusLabel,
    }
  }

  return {
    ...response,
    reply,
    headline: headline || fallback.headline,
  }
}

function resolveLlmConfig() {
  const provider = (process.env.LLM_PROVIDER || 'openai-compatible').trim()
  const model = (process.env.LLM_MODEL || '').trim()
  const apiKey = (process.env.LLM_API_KEY || '').trim()
  const explicitUrl = (process.env.LLM_API_URL || '').trim()

  const providerBaseUrl = {
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    deepseek: 'https://api.deepseek.com',
    siliconflow: 'https://api.siliconflow.cn/v1',
    mimo: 'https://token-plan-cn.xiaomimimo.com/v1',
    'openai-compatible': '',
  }[provider] || ''

  const baseUrl = explicitUrl || providerBaseUrl
  return { provider, model, apiKey, baseUrl }
}

function buildLlmInstruction(contextDigest, fallback) {
  return [
    '你是“拉瓦锡”，一个面向化学实验平台的智能化学家助手。',
    '你需要结合实验上下文、最近对话和可用 skill，给出简洁、可执行、具备化学解释的建议。',
    '严格按上下文说话：只有在 focusedContainer.species、containers.species、lastEvent、challenge.target 或最近用户消息中明确出现的物质/离子/沉淀，才可以点名；不要根据 intent、模式或常识臆测 Fe²⁺、Cu²⁺、Ag⁺ 等具体体系。',
    '如果上下文没有明确试剂或主容器，就说“还没拿到具体体系/需要先聚焦容器或查看日志”，不要编造实验。',
    '不要把内部字段名或调试信息说给用户：禁止输出“risks为空”“context显示”“localSignals”“沙盒模式下风险较低”等表述。可改写为“当前读数未显示温度、压力或满量风险”。',
    '安全建议必须先基于当前读数和已知物质；未知物质时只给通用 PPE、小体积加料、通风、避免飞溅建议。',
    'reply 字段要像产品内助手，不要像报告：禁止 Markdown、粗体、项目符号和长编号清单；最多 2 句，总长尽量低于 160 个中文字符。',
    '必须输出 JSON 对象，不要输出 Markdown，不要输出代码块。',
    'JSON 结构：{"reply": string, "headline": string, "suggestedPrompts": string[], "toolCalls": Array<{"type": "focus_container"|"open_logs"|"open_reagents"|"save_note", "targetId"?: string, "note"?: string}>, "statusLabel"?: string}',
    `当前上下文摘要：${JSON.stringify(contextDigest)}`,
    `若信息不足，也至少要保持与这个兜底判断一致：${JSON.stringify(fallback)}`,
  ].join('\n')
}

function extractJsonObject(text) {
  if (typeof text !== 'string') return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fenced?.[1] || text
  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(source.slice(start, end + 1))
  } catch {
    return null
  }
}

async function callConfiguredLlm(input, fallback) {
  const llm = resolveLlmConfig()
  if (!llm.apiKey || !llm.model || !llm.baseUrl) {
    return null
  }

  const contextDigest = buildContextDigest(input.context)
  if (shouldSkipLlm(input, contextDigest)) {
    return {
      ...fallback,
      statusLabel: '已按当前读数判断',
    }
  }

  const messages = [
    { role: 'system', content: buildLlmInstruction(contextDigest, fallback) },
    ...sanitizeConversation(input.conversation).map((entry) => ({ role: entry.role, content: entry.text })),
    { role: 'user', content: typeof input.message === 'string' ? input.message.trim() : '' },
  ]

  const endpoint = llm.baseUrl.endsWith('/chat/completions')
    ? llm.baseUrl
    : `${llm.baseUrl.replace(/\/$/, '')}/chat/completions`

  const timeoutMs = parsePositiveInteger(process.env.LLM_TIMEOUT_MS, DEFAULT_LLM_TIMEOUT_MS)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llm.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: llm.model,
        temperature: 0.35,
        max_tokens: parsePositiveInteger(process.env.LLM_MAX_TOKENS, 260),
        messages,
      }),
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`LLM 超时 ${Math.round(timeoutMs / 1000)}s`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new Error(`LLM HTTP ${response.status}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  const parsed = extractJsonObject(typeof content === 'string' ? content : '')
  if (!parsed) {
    const plainText = typeof content === 'string' && content.trim() ? content.trim() : ''
    if (!plainText) {
      throw new Error('LLM 返回为空')
    }
    return polishLlmResponse({
      ...fallback,
      reply: plainText,
      statusLabel: `LLM 已接入 · ${llm.provider}/${llm.model}`,
    }, fallback, contextDigest, typeof input.message === 'string' ? input.message.trim() : '')
  }

  return polishLlmResponse({
    reply: typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : fallback.reply,
    headline: typeof parsed.headline === 'string' && parsed.headline.trim() ? parsed.headline.trim() : fallback.headline,
    suggestedPrompts: Array.isArray(parsed.suggestedPrompts)
      ? parsed.suggestedPrompts.filter((entry) => typeof entry === 'string' && entry.trim()).slice(0, 5)
      : fallback.suggestedPrompts,
    toolCalls: sanitizeToolCalls(Array.isArray(parsed.toolCalls) ? parsed.toolCalls : fallback.toolCalls),
    statusLabel: `LLM 已接入 · ${llm.provider}/${llm.model}`,
  }, fallback, contextDigest, typeof input.message === 'string' ? input.message.trim() : '')
}

async function generateLavoisierResponse(input) {
  const fallback = buildFallbackResponse(input)
  try {
    const llmResponse = await callConfiguredLlm(input, fallback)
    return llmResponse || fallback
  } catch (error) {
    console.warn('[lavoisier-api] llm fallback:', error instanceof Error ? error.message : error)
    return {
      ...fallback,
      statusLabel: '本地判断 · LLM 暂时无响应',
    }
  }
}

export function createLavoisierServer() {
  return createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { reply: '请求缺少 URL。' })
    return
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/lavoisier') {
    const llmConfig = resolveLlmConfig()
    const configured = Boolean(llmConfig.apiKey && llmConfig.model && llmConfig.baseUrl)
    sendJson(res, 200, {
      ok: true,
      name: 'lavoisier-api',
      provider: llmConfig.provider,
      model: llmConfig.model || null,
      statusLabel: configured ? `LLM 配置已检测 · ${llmConfig.provider}/${llmConfig.model}` : '后端已启动 · 待接入 LLM',
    })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/lavoisier') {
    try {
      const body = await readJsonBody(req)
      const message = typeof body?.message === 'string' ? body.message.trim() : ''
      if (!message) {
        sendJson(res, 400, {
          reply: '缺少 message 字段，无法生成实验建议。',
          headline: '拉瓦锡提醒：请先输入问题。',
          suggestedPrompts: ['现在该做什么？', '解释一下当前现象', '帮我总结实验状态'],
          toolCalls: [],
          statusLabel: '请求格式错误',
        })
        return
      }

      const payload = {
        message,
        conversation: sanitizeConversation(body?.conversation),
        context: body?.context && typeof body.context === 'object' ? body.context : {},
      }
      const response = await generateLavoisierResponse(payload)
      sendJson(res, 200, response)
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      sendJson(res, 500, {
        reply: `拉瓦锡后端暂时不可用：${message}`,
        headline: '拉瓦锡接口异常',
        suggestedPrompts: ['重试刚才的问题', '总结当前实验状态', '现在是否有风险？'],
        toolCalls: [],
        statusLabel: '服务错误',
      })
    }
    return
  }

  if (tryServeStatic(req, res, url)) return

  sendJson(res, 404, {
    reply: '未找到对应接口。',
    statusLabel: '404',
  })
  })
}

export function startServer({ port = PORT, host } = {}) {
  const server = createLavoisierServer()

  return new Promise((resolveServer, rejectServer) => {
    server.once('error', rejectServer)
    server.listen(port, host, () => {
      server.off('error', rejectServer)
      const address = server.address()
      const resolvedPort = typeof address === 'object' && address ? address.port : port
      const hostname = host || 'localhost'
      resolveServer({
        server,
        port: resolvedPort,
        url: `http://${hostname}:${resolvedPort}`,
      })
    })
  })
}

const isCliEntry = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isCliEntry) {
  startServer().then(({ url }) => {
    console.log(`[lavoisier-api] listening on ${url}`)
  }).catch((error) => {
    console.error('[lavoisier-api] failed to start:', error)
    process.exitCode = 1
  })
}
