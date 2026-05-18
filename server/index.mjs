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

function sanitizeString(value, fallback = undefined, maxLength = 180) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.slice(0, maxLength)
}

function sanitizeStringArray(values, maxItems = 6, maxLength = 40) {
  if (!Array.isArray(values)) return []
  return values
    .map((value) => sanitizeString(value, undefined, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

function sanitizeMissionContext(mission) {
  if (!mission || typeof mission !== 'object') return null
  const proof = mission.proof && typeof mission.proof === 'object' ? mission.proof : null
  const current = proof?.current && typeof proof.current === 'object' ? proof.current : null

  return {
    id: sanitizeString(mission.id, undefined, 30),
    title: sanitizeString(mission.title, undefined, 80),
    family: sanitizeString(mission.family, undefined, 40),
    signal: sanitizeString(mission.signal, undefined, 40),
    route: sanitizeStringArray(mission.route, 5, 30),
    branch: sanitizeString(mission.branch, undefined, 80),
    target: sanitizeString(mission.target, undefined, 140),
    completed: Boolean(mission.completed),
    productReady: Boolean(mission.productReady),
    doneCount: Number.isFinite(mission.doneCount) ? Number(mission.doneCount) : null,
    stepCount: Number.isFinite(mission.stepCount) ? Number(mission.stepCount) : null,
    nextAction: sanitizeString(mission.nextAction, undefined, 60),
    proof: proof
      ? {
          solvedCount: Number.isFinite(proof.solvedCount) ? Number(proof.solvedCount) : 0,
          stepCount: Number.isFinite(proof.stepCount) ? Number(proof.stepCount) : 0,
          solved: Boolean(proof.solved),
          current: current
            ? {
                label: sanitizeString(current.label, undefined, 40),
                question: sanitizeString(current.question, undefined, 100),
                hint: sanitizeString(current.hint, undefined, 80),
                selectedFeedback: sanitizeString(current.selectedFeedback, undefined, 120),
                options: Array.isArray(current.options)
                  ? current.options
                      .map((option) => option && typeof option === 'object'
                        ? {
                            id: sanitizeString(option.id, undefined, 30),
                            label: sanitizeString(option.label, undefined, 30),
                            detail: sanitizeString(option.detail, undefined, 70),
                            selected: Boolean(option.selected),
                          }
                        : null)
                      .filter(Boolean)
                      .slice(0, 4)
                  : [],
              }
            : null,
        }
      : null,
  }
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
    mission: sanitizeMissionContext(context.mission),
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
  const prompts = ['下一步', '解释现象', '我做对了吗']
  const mission = contextDigest.mission

  if (mission?.completed) {
    prompts.unshift('下一关怎么做', '解释刚才现象')
  } else if (mission?.productReady && mission?.proof && !mission.proof.solved) {
    prompts.unshift('我该选哪个证据', '解释这个现象')
  } else if (mission?.nextAction) {
    prompts.unshift(`为什么要${mission.nextAction.replace(/^加\s*/, '加')}`)
  }

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

function buildFallbackResponse(input) {
  const contextDigest = buildContextDigest(input.context)
  const llmConfig = resolveLlmConfig()
  const hasLlmConfig = Boolean(llmConfig.apiKey && llmConfig.model && llmConfig.baseUrl)
  return {
    reply: hasLlmConfig
      ? '拉瓦锡 LLM 暂时没有返回可用答案，请重试一次。'
      : '拉瓦锡 LLM 还没接通，请配置 LLM_API_KEY、LLM_MODEL 和 LLM_API_URL。',
    headline: hasLlmConfig ? '拉瓦锡：等待 LLM 回复' : '拉瓦锡：LLM 未连接',
    suggestedPrompts: buildSuggestedPrompts(contextDigest),
    toolCalls: buildToolCalls(typeof input.message === 'string' ? input.message : '', contextDigest),
    statusLabel: hasLlmConfig ? 'LLM 暂无可用回复' : 'LLM 未连接',
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

function compactAssistantText(text, maxChars = 160) {
  const normalized = normalizeAssistantText(text)
  if (!normalized) return ''
  const sentences = normalized.match(/[^。！？.!?]+[。！？.!?]?/g) || [normalized]
  let compact = sentences.slice(0, 3).join('').trim()
  if (compact.length > maxChars) {
    compact = `${compact.slice(0, maxChars).replace(/[，,；;：:]?[^，,；;：:。！？.!?]*$/, '')}。`
  }
  return compact || normalized.slice(0, maxChars)
}

function scrubInternalLeakText(text) {
  return normalizeAssistantText(text)
    .replace(/(?:根据|从)?(?:当前)?\s*(?:context|上下文)\s*(?:显示|shows|indicates)?[，,。:：]?\s*/gi, '')
    .replace(/risks\s*[:：]?\s*为空/gi, '当前读数未显示明显风险')
    .replace(/localSignals/gi, '当前实验信号')
    .replace(/沙盒模式下?风险较低/g, '当前读数未显示明显风险')
    .replace(/沙盒模式下?/g, '当前')
    .replace(/沙盒探索模式/g, '自由探索模式')
    .trim()
}

function polishLlmResponse(response, fallback) {
  let reply = compactAssistantText(response?.reply)
  let headline = compactAssistantText(response?.headline, 80)

  if (!reply) {
    throw new Error('LLM 回复未通过校验')
  }

  if (INTERNAL_REPLY_PATTERNS.some((pattern) => pattern.test(reply) || pattern.test(headline))) {
    reply = compactAssistantText(scrubInternalLeakText(reply))
    headline = compactAssistantText(scrubInternalLeakText(headline), 80)
  }

  if (!reply || INTERNAL_REPLY_PATTERNS.some((pattern) => pattern.test(reply) || pattern.test(headline))) {
    throw new Error('LLM 回复未通过校验')
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

function shouldDisableThinking(llm) {
  return llm.provider.toLowerCase() === 'mimo' && llm.model.toLowerCase() === 'mimo-v2.5'
}

function buildChatCompletionBody(llm, messages) {
  const body = {
    model: llm.model,
    temperature: 0.35,
    max_tokens: parsePositiveInteger(process.env.LLM_MAX_TOKENS, 260),
    messages,
  }

  if (shouldDisableThinking(llm)) {
    body.chat_template_kwargs = { enable_thinking: false }
  }

  return body
}

function buildLlmInstruction(contextDigest) {
  return [
    '你是“拉瓦锡”，一个面向化学实验平台的智能化学家助手。',
    '你需要结合实验上下文、最近对话和可用 skill，给出简洁、可执行、具备化学解释的建议。',
    '如果 mission 存在，优先围绕 mission.title、mission.target、mission.nextAction 和 mission.proof.current 回答；这是当前演示的真实任务状态。',
    '当 mission.productReady=true 且 mission.proof.current 存在时，先确认“现象已出现”，再用当前题目、选项、hint 帮用户判断证据；不要重复长路线。',
    '当 mission.completed=true 时，建议用户解释现象或进入下一关；不要继续要求加同一主线试剂。',
    '严格按上下文说话：只有在 focusedContainer.species、containers.species、lastEvent、challenge.target、mission.target/route/proof 或最近用户消息中明确出现的物质/离子/沉淀，才可以点名；不要根据 intent、模式或常识臆测 Fe²⁺、Cu²⁺、Ag⁺ 等具体体系。',
    '如果上下文没有明确试剂或主容器，就说“还没拿到具体体系/需要先聚焦容器或查看日志”，不要编造实验。',
    '不要把内部字段名或调试信息说给用户：禁止输出“risks为空”“context显示”“localSignals”“沙盒模式下风险较低”等表述。可改写为“当前读数未显示温度、压力或满量风险”。',
    '安全建议必须先基于当前读数和已知物质；未知物质时只给通用 PPE、小体积加料、通风、避免飞溅建议。',
    'reply 字段要像产品内实验导师，不要像报告：禁止 Markdown、粗体、项目符号和长编号清单；总长尽量低于 140 个中文字符。',
    '回答“解释现象/下一步/做对了吗”这类演示问题时，优先用最多 3 行短句：现象：…；原因：…；下一步：…。信息不足时只说缺什么和一个最小动作。',
    '必须输出 JSON 对象，不要输出 Markdown，不要输出代码块。',
    'JSON 结构：{"reply": string, "headline": string, "suggestedPrompts": string[], "toolCalls": Array<{"type": "focus_container"|"open_logs"|"open_reagents"|"save_note", "targetId"?: string, "note"?: string}>, "statusLabel"?: string}',
    `当前上下文摘要：${JSON.stringify(contextDigest)}`,
    '信息不足时也必须保持像真人助手：说明缺哪类实验信息，并提出一个最小可执行动作；不要输出模板化兜底话术。',
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

  const messages = [
    { role: 'system', content: buildLlmInstruction(contextDigest) },
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
      body: JSON.stringify(buildChatCompletionBody(llm, messages)),
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
  const choice = payload?.choices?.[0]
  const content = choice?.message?.content
  const parsed = extractJsonObject(typeof content === 'string' ? content : '')
  if (!parsed) {
    const plainText = typeof content === 'string' && content.trim() ? content.trim() : ''
    if (!plainText) {
      const reason = choice?.finish_reason === 'length'
        ? 'LLM 只返回了推理过程，未输出最终答案'
        : 'LLM 返回为空'
      throw new Error(reason)
    }
    return polishLlmResponse({
      ...fallback,
      reply: plainText,
      statusLabel: `LLM 已接入 · ${llm.provider}/${llm.model}`,
    }, fallback)
  }

  return polishLlmResponse({
    reply: typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : fallback.reply,
    headline: typeof parsed.headline === 'string' && parsed.headline.trim() ? parsed.headline.trim() : fallback.headline,
    suggestedPrompts: Array.isArray(parsed.suggestedPrompts)
      ? parsed.suggestedPrompts.filter((entry) => typeof entry === 'string' && entry.trim()).slice(0, 5)
      : fallback.suggestedPrompts,
    toolCalls: sanitizeToolCalls(Array.isArray(parsed.toolCalls) ? parsed.toolCalls : fallback.toolCalls),
    statusLabel: `LLM 已接入 · ${llm.provider}/${llm.model}`,
  }, fallback)
}

async function generateLavoisierResponse(input) {
  const fallback = buildFallbackResponse(input)
  try {
    const llmResponse = await callConfiguredLlm(input, fallback)
    return llmResponse || fallback
  } catch (error) {
    console.warn('[lavoisier-api] llm error:', error instanceof Error ? error.message : error)
    return {
      ...fallback,
      reply: `拉瓦锡 LLM 暂时无响应：${error instanceof Error ? error.message : '未知错误'}。`,
      headline: '拉瓦锡：LLM 暂时无响应',
      statusLabel: 'LLM 暂时无响应',
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
      statusLabel: configured ? `LLM 配置已检测 · ${llmConfig.provider}/${llmConfig.model}` : 'LLM 未连接',
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
