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

const MISSION_PRESETS = ['prepCu', 'prepAg', 'prepFe', 'prepCo2', 'prepIodine', 'prepMn']
const MISSION_TEMPLATES = {
  prepCu: {
    preset: 'prepCu',
    challengeId: 'c1',
    discoveryId: 'cu-oh2',
    title: '未知 A：蓝色沉淀',
    family: '沉淀鉴定',
    signal: '蓝绿色絮状',
    route: ['样品 A', '加碱', '沉淀'],
    branch: '氨水会转深蓝',
    reagents: ['未知样品 A', '氢氧化钠', '氨水'],
    accent: 'cyan',
    target: '鉴定未知样品 A，制备蓝绿色 Cu(OH)₂ 沉淀',
  },
  prepAg: {
    preset: 'prepAg',
    challengeId: 'c2',
    discoveryId: 'agcl',
    title: '未知 B：白色沉淀',
    family: '沉淀鉴定',
    signal: '白色凝乳状',
    route: ['样品 B', '加氯离子', '沉淀'],
    branch: '氨水可做对照',
    reagents: ['未知样品 B', '盐酸', '氨水'],
    accent: 'emerald',
    target: '鉴定未知样品 B，制备白色 AgCl 沉淀',
  },
  prepFe: {
    preset: 'prepFe',
    challengeId: 'c3',
    discoveryId: 'fe-scn',
    title: '未知 C：血红络合',
    family: '络合显色',
    signal: '瞬间血红',
    route: ['样品 C', 'SCN⁻', '显色'],
    branch: '加碱会变沉淀',
    reagents: ['未知样品 C', '硫氰化钾', '氢氧化钠'],
    accent: 'rose',
    target: '鉴定未知样品 C，制备血红色 Fe(SCN)₃ 络合物',
  },
  prepCo2: {
    preset: 'prepCo2',
    challengeId: 'c4',
    discoveryId: 'co2',
    title: '未知 D：气泡',
    family: '气体生成',
    signal: '连续气泡',
    route: ['样品 D', '加酸', '冒泡'],
    branch: '指示剂看酸化',
    reagents: ['未知样品 D', '盐酸', '甲基橙'],
    accent: 'amber',
    target: '鉴定未知样品 D，制备二氧化碳气泡',
  },
  prepIodine: {
    preset: 'prepIodine',
    challengeId: 'c5',
    discoveryId: 'iodine-layer',
    title: '未知 E：紫色分层',
    family: '萃取分层',
    signal: '有机层变紫',
    route: ['样品 E', '有机相', '分层'],
    branch: '正己烷可对比',
    reagents: ['未知样品 E', '四氯化碳', '正己烷'],
    accent: 'violet',
    target: '鉴定未知样品 E，制备紫色有机层',
  },
  prepMn: {
    preset: 'prepMn',
    challengeId: 'c6',
    discoveryId: 'permanganate-fade',
    title: '未知 F：褪色',
    family: '氧化还原',
    signal: '紫色褪去',
    route: ['样品 F', '还原剂', '酸化'],
    branch: '酸度决定速度',
    reagents: ['未知样品 F', '草酸', '硫酸'],
    accent: 'amber',
    target: '鉴定未知样品 F，制备高锰酸钾褪色体系',
  },
}

function cloneMissionTemplate(template) {
  return {
    ...template,
    route: [...template.route],
    reagents: [...template.reagents],
  }
}

function sanitizeMissionStringArray(value, maxItems = 4, maxLength = 24, fallback = []) {
  if (!Array.isArray(value)) return [...fallback]
  const next = value
    .map((entry) => sanitizeString(entry, '', maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
  return next.length ? next : [...fallback]
}

function createTemplateMissionDeck(episode = 1) {
  if (episode <= 1) {
    return {
      id: 'preset-v1',
      episode: 1,
      title: '基础反应鉴定',
      source: 'preset',
      missions: MISSION_PRESETS.map((preset) => cloneMissionTemplate(MISSION_TEMPLATES[preset])),
    }
  }

  const themes = [
    { title: '沉淀与显色复核', order: ['prepAg', 'prepFe', 'prepCu', 'prepCo2', 'prepIodine', 'prepMn'] },
    { title: '未知样品二轮挑战', order: ['prepCo2', 'prepCu', 'prepIodine', 'prepAg', 'prepMn', 'prepFe'] },
    { title: '证据链强化', order: ['prepFe', 'prepMn', 'prepAg', 'prepIodine', 'prepCu', 'prepCo2'] },
  ]
  const variants = {
    prepCu: { title: '未知 A：蓝絮复核', signal: '蓝绿色絮凝', family: '金属离子鉴定', route: ['样品 A', '预测', '加碱', '沉淀'], branch: '氨水对照会推向深蓝' },
    prepAg: { title: '未知 B：白浊锁定', signal: '白色凝乳', family: '阴离子沉淀', route: ['样品 B', '预测', '加 Cl⁻', '沉淀'], branch: '硝酸对照不提供 Cl⁻' },
    prepFe: { title: '未知 C：血红证据', signal: '血红显色', family: '络合显色', route: ['样品 C', '预测', 'SCN⁻', '显色'], branch: 'NaOH 会抢先沉淀铁离子' },
    prepCo2: { title: '未知 D：放气确认', signal: '细密气泡', family: '气体生成', route: ['样品 D', '预测', '加酸', '气泡'], branch: '酸化速度决定气泡强弱' },
    prepIodine: { title: '未知 E：紫相迁移', signal: '紫色有机层', family: '萃取分配', route: ['样品 E', '预测', '有机相', '分层'], branch: '正己烷对比层位不同' },
    prepMn: { title: '未知 F：紫色褪去', signal: '紫色衰减', family: '氧化还原', route: ['样品 F', '预测', '草酸', '酸化'], branch: '硫酸比盐酸更干净' },
  }
  const theme = themes[(episode - 2 + themes.length) % themes.length]

  return {
    id: `template-${episode}-${theme.order.join('-')}`,
    episode,
    title: theme.title,
    source: 'template',
    missions: theme.order.map((preset) => ({
      ...cloneMissionTemplate(MISSION_TEMPLATES[preset]),
      ...(variants[preset] || {}),
    })),
  }
}

function normalizeGeneratedMissionDeck(rawDeck, fallbackEpisode = 2, source = 'template') {
  if (!rawDeck || typeof rawDeck !== 'object') return null
  const missionsInput = Array.isArray(rawDeck.missions) ? rawDeck.missions : []
  if (!missionsInput.length) return null

  const byPreset = new Map()
  for (const entry of missionsInput) {
    if (!entry || typeof entry !== 'object') continue
    const preset = typeof entry.preset === 'string'
      ? entry.preset
      : typeof entry.templateId === 'string'
      ? entry.templateId
      : ''
    const normalizedPreset = MISSION_PRESETS.includes(preset)
      ? preset
      : MISSION_PRESETS.find((candidate) => MISSION_TEMPLATES[candidate].challengeId === preset)
    if (!normalizedPreset || byPreset.has(normalizedPreset)) continue
    byPreset.set(normalizedPreset, entry)
  }

  if (byPreset.size < MISSION_PRESETS.length) return null

  const orderedPresets = [
    ...missionsInput
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const preset = typeof entry.preset === 'string' ? entry.preset : typeof entry.templateId === 'string' ? entry.templateId : ''
        return MISSION_PRESETS.includes(preset)
          ? preset
          : MISSION_PRESETS.find((candidate) => MISSION_TEMPLATES[candidate].challengeId === preset) || null
      })
      .filter(Boolean),
    ...MISSION_PRESETS,
  ].filter((preset, index, array) => array.indexOf(preset) === index)

  return {
    id: sanitizeString(rawDeck.id, `${source}-${fallbackEpisode}-${Date.now()}`, 48),
    episode: Number.isFinite(rawDeck.episode) ? Math.max(1, Number(rawDeck.episode)) : fallbackEpisode,
    title: sanitizeString(rawDeck.title, `第 ${fallbackEpisode} 组实验`, 42),
    source,
    missions: orderedPresets.map((preset) => {
      const base = MISSION_TEMPLATES[preset]
      const entry = byPreset.get(preset) || {}
      return {
        ...cloneMissionTemplate(base),
        title: sanitizeString(entry.title, base.title, 48),
        family: sanitizeString(entry.family, base.family, 32),
        signal: sanitizeString(entry.signal, base.signal, 32),
        route: sanitizeMissionStringArray(entry.route, 4, 18, base.route),
        branch: sanitizeString(entry.branch, base.branch, 64),
        target: sanitizeString(entry.target, base.target, 120),
      }
    }),
  }
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
    evidenceScore: Number.isFinite(mission.evidenceScore) ? Number(mission.evidenceScore) : null,
    integrity: Number.isFinite(mission.integrity) ? Number(mission.integrity) : null,
    pollution: Number.isFinite(mission.pollution) ? Number(mission.pollution) : null,
    purity: Number.isFinite(mission.purity) ? Number(mission.purity) : null,
    canComplete: typeof mission.canComplete === 'boolean' ? mission.canComplete : null,
    failureReason: sanitizeString(mission.failureReason, undefined, 80),
    hintUses: Number.isFinite(mission.hintUses) ? Number(mission.hintUses) : null,
    lastPenalty: sanitizeString(mission.lastPenalty, undefined, 80),
    coachLine: sanitizeString(mission.coachLine, undefined, 80),
    nextAction: sanitizeString(mission.nextAction, undefined, 60),
    proof: proof
      ? {
          solvedCount: Number.isFinite(proof.solvedCount) ? Number(proof.solvedCount) : 0,
          stepCount: Number.isFinite(proof.stepCount) ? Number(proof.stepCount) : 0,
          solved: Boolean(proof.solved),
          current: current
            ? {
                stage: sanitizeString(current.stage, undefined, 20),
                label: sanitizeString(current.label, undefined, 40),
                question: sanitizeString(current.question, undefined, 100),
                hint: sanitizeString(current.hint, undefined, 80),
                wrongAnswerPenalty: current.wrongAnswerPenalty && typeof current.wrongAnswerPenalty === 'object'
                  ? {
                      integrity: Number.isFinite(current.wrongAnswerPenalty.integrity) ? Number(current.wrongAnswerPenalty.integrity) : null,
                      pollution: Number.isFinite(current.wrongAnswerPenalty.pollution) ? Number(current.wrongAnswerPenalty.pollution) : null,
                    }
                  : null,
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

function compactAssistantText(text, maxChars = 140) {
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

function buildChatCompletionBody(llm, messages, options = {}) {
  const body = {
    model: llm.model,
    temperature: Number.isFinite(options.temperature) ? options.temperature : 0.35,
    max_tokens: parsePositiveInteger(options.maxTokens || process.env.LLM_MAX_TOKENS, 260),
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
    '如果 mission.proof.current.stage="predict"，不要直接替用户选最终答案；用当前题目和选项提示如何预测，并提醒先预测再验证。',
    '当用户只要“线索”时，只给一个观察角度，不点名最终选项；不要直接说“选 X”。',
    '当 mission.productReady=true 且 mission.proof.current 存在时，先确认“现象已出现”，再用当前题目、选项、hint 帮用户判断证据；不要重复长路线。',
    '当 mission.completed=true 时，建议用户解释现象或进入下一关；不要继续要求加同一主线试剂。',
    '当 mission.pollution 较高或 mission.canComplete=false 时，优先指出污染/可信度问题，用最短路线复盘；不要鼓励继续乱加试剂。',
    '严格按上下文说话：只有在 focusedContainer.species、containers.species、lastEvent、challenge.target、mission.target/route/proof 或最近用户消息中明确出现的物质/离子/沉淀，才可以点名；不要根据 intent、模式或常识臆测 Fe²⁺、Cu²⁺、Ag⁺ 等具体体系。',
    '如果上下文没有明确试剂或主容器，就说“还没拿到具体体系/需要先聚焦容器或查看日志”，不要编造实验。',
    '不要把内部字段名或调试信息说给用户：禁止输出“risks为空”“context显示”“localSignals”“沙盒模式下风险较低”等表述。可改写为“当前读数未显示温度、压力或满量风险”。',
    '安全建议必须先基于当前读数和已知物质；未知物质时只给通用 PPE、小体积加料、通风、避免飞溅建议。',
    'reply 字段要像产品内实验导师，不要像报告：禁止 Markdown、粗体、项目符号和长编号清单；总长尽量低于 110 个中文字符。',
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

function buildMissionDeckInstruction(episode, fallbackDeck) {
  const safeTemplates = MISSION_PRESETS.map((preset) => {
    const template = MISSION_TEMPLATES[preset]
    return {
      preset,
      fixedChallengeId: template.challengeId,
      fixedReagents: template.reagents,
      baseline: {
        title: template.title,
        family: template.family,
        signal: template.signal,
        route: template.route,
        branch: template.branch,
        target: template.target,
      },
    }
  })

  return [
    '你是 ChemLab Pro 的关卡策划 Agent。目标是让 6 个化学挑战像“下一组关卡”一样更有新鲜感，但必须保持化学模拟稳定。',
    '硬约束：只能改展示文案和 6 关顺序，不能发明新反应、不能改试剂、不能改 challengeId、不能改 discoveryId、不能改成功条件。',
    '每个 preset 必须且只能出现一次：prepCu、prepAg、prepFe、prepCo2、prepIodine、prepMn。',
    '文案要短、像游戏关卡，不要写教学废话，不要编号说明，不要 Markdown。',
    'route 只能是 3-4 个很短的步骤词；branch 是一个可选对照/变量提示。',
    '必须输出 JSON 对象，不要输出代码块。',
    'JSON 结构：{"title": string, "missions": [{"preset": string, "title": string, "family": string, "signal": string, "route": string[], "branch": string, "target": string}]}',
    `当前需要生成第 ${episode} 组。安全模板如下：${JSON.stringify(safeTemplates)}`,
    `本地兜底卡组如下，可在这个审美基础上微调：${JSON.stringify(fallbackDeck)}`,
  ].join('\n')
}

async function callMissionDeckLlm(episode, fallbackDeck) {
  const llm = resolveLlmConfig()
  if (!llm.apiKey || !llm.model || !llm.baseUrl) return null

  const messages = [
    { role: 'system', content: buildMissionDeckInstruction(episode, fallbackDeck) },
    { role: 'user', content: `生成 ChemLab Pro 第 ${episode} 组 6 关任务。只返回 JSON。` },
  ]
  const endpoint = llm.baseUrl.endsWith('/chat/completions')
    ? llm.baseUrl
    : `${llm.baseUrl.replace(/\/$/, '')}/chat/completions`
  const timeoutMs = parsePositiveInteger(process.env.MISSION_LLM_TIMEOUT_MS || process.env.LLM_TIMEOUT_MS, DEFAULT_LLM_TIMEOUT_MS)
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
      body: JSON.stringify(buildChatCompletionBody(llm, messages, {
        temperature: 0.62,
        maxTokens: process.env.MISSION_LLM_MAX_TOKENS || 900,
      })),
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Mission LLM 超时 ${Math.round(timeoutMs / 1000)}s`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new Error(`Mission LLM HTTP ${response.status}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  const parsed = extractJsonObject(typeof content === 'string' ? content : '')
  if (!parsed) {
    throw new Error('Mission LLM 返回为空或不是 JSON')
  }

  const rawDeck = parsed.deck && typeof parsed.deck === 'object' ? parsed.deck : parsed
  const normalized = normalizeGeneratedMissionDeck({
    ...rawDeck,
    id: `agent-${episode}-${Date.now()}`,
    episode,
  }, episode, 'agent')
  if (!normalized) {
    throw new Error('Mission LLM 关卡未通过校验')
  }
  return normalized
}

async function generateMissionDeck(input = {}) {
  const episode = parsePositiveInteger(input.episode, 2)
  const fallbackDeck = createTemplateMissionDeck(episode)

  try {
    const llmDeck = await callMissionDeckLlm(episode, fallbackDeck)
    return llmDeck || fallbackDeck
  } catch (error) {
    console.warn('[mission-api] llm error:', error instanceof Error ? error.message : error)
    return fallbackDeck
  }
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

  if (req.method === 'GET' && url.pathname === '/api/missions/generate') {
    const llmConfig = resolveLlmConfig()
    const configured = Boolean(llmConfig.apiKey && llmConfig.model && llmConfig.baseUrl)
    sendJson(res, 200, {
      ok: true,
      name: 'mission-generator',
      provider: llmConfig.provider,
      model: llmConfig.model || null,
      statusLabel: configured ? `关卡 Agent 已配置 · ${llmConfig.provider}/${llmConfig.model}` : '关卡 Agent 未连接，使用本地模板',
    })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/missions/generate') {
    try {
      const body = await readJsonBody(req)
      const deck = await generateMissionDeck({
        episode: body?.episode,
        completed: Array.isArray(body?.completed) ? body.completed : [],
        reason: typeof body?.reason === 'string' ? body.reason : 'auto',
      })
      sendJson(res, 200, {
        ok: true,
        deck,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      sendJson(res, 500, {
        ok: false,
        message,
        deck: createTemplateMissionDeck(2),
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
