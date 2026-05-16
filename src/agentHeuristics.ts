import { calculatePH, calculatePressureEstimate, getTotalLiquidVolume } from './chemEngine.js'
import {
  dedupeStrings,
  getChallengeInsight,
  getContainerCapacity,
  isChallengeCompleted,
  type ActiveChallenge,
  type ChallengeItem,
} from './challengeGuidance.js'

export type AgentIntent = 'exploration' | 'titration' | 'precipitation' | 'extraction' | 'heating' | 'distillation'

export type AgentGoal = {
  title: string
  progress: string
  status: 'idle' | 'in_progress' | 'completed'
}

export type AgentState = {
  intent: AgentIntent
  confidence: number
  headline: string
  suggestion: string
  explanation: string
  risks: string[]
  nextSteps: string[]
  goal?: AgentGoal
}

export type AgentLastEvent = {
  kind: 'reaction' | 'readout'
  name?: string
  reacted?: string
  temp?: number
  ph?: number
}

export type InferAgentStateInput = {
  items: ChallengeItem[]
  focusedId: string | null
  lastEvent?: AgentLastEvent
  gameMode?: string
  activeChallenge?: ActiveChallenge | null
}

export type BuildGoalProgressInput = {
  items: ChallengeItem[]
  gameMode?: string
  activeChallenge?: ActiveChallenge | null
}

export function buildGoalProgress({ items, gameMode, activeChallenge }: BuildGoalProgressInput): AgentGoal {
  if (gameMode !== 'challenge' || !activeChallenge) {
    if (items.length === 0) {
      return { title: '自由实验', progress: '先放一个容器并加入第一种试剂。', status: 'idle' }
    }

    const hasDualPhase = items.some(i => (i.chemState.organicVolume || 0) > 1e-6 && (i.chemState.volume || 0) > 1e-6)
    const hasPrecipitate = items.some(i => (i.state || '').includes('precipitate'))
    const hasHeated = items.some(i => i.type === 'flame' && i.isOn)
    const hasBurette = items.some(i => i.type === 'burette')

    if (hasDualPhase) {
      return { title: '自由实验', progress: '临时目标：等待分层稳定后，尝试只转移一层液相。', status: 'in_progress' }
    }
    if (hasPrecipitate) {
      return { title: '自由实验', progress: '临时目标：让沉淀充分静置，再尝试倾析或过滤。', status: 'in_progress' }
    }
    if (hasHeated) {
      return { title: '自由实验', progress: '临时目标：观察升温、沸腾或气体逸散，并避免干烧。', status: 'in_progress' }
    }
    if (hasBurette) {
      return { title: '自由实验', progress: '临时目标：加入指示剂后，用滴定管把 pH 缓慢逼近目标值。', status: 'in_progress' }
    }

    return { title: '自由实验', progress: '试着组合两种核心试剂，观察颜色、沉淀或相态变化。', status: 'in_progress' }
  }

  if (activeChallenge.completed || isChallengeCompleted(activeChallenge, items)) {
    return { title: activeChallenge.title, progress: '已完成 ✅', status: 'completed' }
  }

  const challengeInsight = getChallengeInsight(activeChallenge, items)
  if (challengeInsight) {
    return {
      title: activeChallenge.title,
      progress: `${challengeInsight.progressLabel} · ${challengeInsight.nextHint}`,
      status: challengeInsight.progressValue >= 100 ? 'completed' : 'in_progress',
    }
  }

  return { title: activeChallenge.title, progress: '进行中…', status: 'in_progress' }
}

export function inferAgentState({
  items,
  focusedId,
  lastEvent,
  gameMode,
  activeChallenge,
}: InferAgentStateInput): AgentState {
  const focused = focusedId ? items.find(i => i.id === focusedId) : undefined
  const focusedContainer = focused && (focused.type === 'beaker' || focused.type === 'flask' || focused.type === 'testtube') ? focused : undefined
  const hasBurette = items.some(i => i.type === 'burette')
  const hasTube = items.some(i => i.type === 'tube')
  const hasFlameOn = items.some(i => i.type === 'flame' && i.isOn)
  const hasDualPhase = items.some(i => (i.chemState.organicVolume || 0) > 1e-6 && (i.chemState.volume || 0) > 1e-6)
  const hasPrecipitate = items.some(i => (i.state || '').includes('precipitate'))
  const hasGasOrBoil = items.some(i => (i.state || '').includes('gas'))
  const challengeInsight = gameMode === 'challenge' && activeChallenge ? getChallengeInsight(activeChallenge, items) : null
  const challengeCompleted = Boolean(activeChallenge && (activeChallenge.completed || isChallengeCompleted(activeChallenge, items)))

  let intent: AgentIntent = 'exploration'
  let confidence = 0.35

  if (hasDualPhase) {
    intent = 'extraction'
    confidence = 0.75
  } else if (hasTube && hasFlameOn) {
    intent = 'distillation'
    confidence = 0.7
  } else if (hasFlameOn || hasGasOrBoil) {
    intent = 'heating'
    confidence = 0.65
  } else if (hasPrecipitate) {
    intent = 'precipitation'
    confidence = 0.7
  } else if (hasBurette) {
    intent = 'titration'
    confidence = 0.6
  }

  const risks: string[] = []
  if (focusedContainer) {
    const cap = getContainerCapacity(focusedContainer.type)
    const vol = getTotalLiquidVolume(focusedContainer.chemState)
    if (vol >= cap * 0.92) risks.push(`容器接近满量（${vol.toFixed(1)}/${cap}mL）`)
    const temp = focusedContainer.chemState.temperature
    if (temp >= 70) risks.push(`温度偏高（${temp.toFixed(1)}°C）`)
    const pressure = calculatePressureEstimate(focusedContainer.chemState, cap)
    if (pressure >= 1.6) risks.push(`压力偏高（${pressure.toFixed(2)} atm）`)
  }

  let headline = '拉瓦锡判断：先建立一个清晰的反应体系。'
  let suggestion = '先放置容器并加入两种核心试剂，我会根据现象帮你判断下一步。'
  let nextSteps = ['放置一个烧杯或锥形瓶', '加入第一种试剂', '观察颜色、沉淀或温度变化']
  if (intent === 'titration') {
    headline = '拉瓦锡判断：你正在接近一个滴定控制场景。'
    suggestion = '滴定建议：先加入指示剂（酚酞/甲基橙），再用滴定管小体积逐步逼近 pH=7。'
    nextSteps = ['先加入指示剂', '切换到滴定管小体积加入', '紧盯 pH 是否逼近 7']
    if (focusedContainer) {
      const ph = calculatePH(focusedContainer.chemState)
      if (ph > 7.2) suggestion = '当前偏碱：用滴定管少量加入盐酸，逐步逼近 pH=7。'
      if (ph < 6.8) suggestion = '当前偏酸：用滴定管少量加入 NaOH，逐步逼近 pH=7。'
    }
  } else if (intent === 'precipitation') {
    headline = '拉瓦锡判断：体系已经进入沉淀分离阶段。'
    suggestion = '沉淀体系建议：先静置让沉淀下沉，再倾析上清液；需要更干净可用漏斗过滤。'
    nextSteps = ['先静置沉降', '优先倾析上清液', '必要时再用漏斗过滤']
  } else if (intent === 'extraction') {
    headline = '拉瓦锡判断：这是典型的相间分配问题。'
    suggestion = '萃取建议：等待分层稳定后，只转移上层（或指定相）以提高目标组分富集。'
    nextSteps = ['确认上下层是否稳定', '只转移目标液层', '对比颜色与体积判断富集']
  } else if (intent === 'heating') {
    headline = '拉瓦锡判断：热过程正在主导实验行为。'
    suggestion = '加热建议：点燃酒精灯并观察温升；接近沸点时注意体积与压力，避免干烧。'
    nextSteps = ['缓慢加热', '观察温度和沸点趋势', '注意压力与干烧风险']
  } else if (intent === 'distillation') {
    headline = '拉瓦锡判断：你正在搭一个蒸馏路径。'
    suggestion = '蒸馏建议：确保加热源与连接导管就位，观察沸腾与冷凝转移的趋势。'
    nextSteps = ['确认导管连接完整', '检查加热源位置', '追踪蒸出液的转移']
  }

  if (challengeInsight && !challengeCompleted) {
    suggestion = `任务建议：${challengeInsight.nextHint}`
    const remainingChecklist = challengeInsight.checklist.filter(item => !item.done).map(item => item.label)
    const reagentHints = challengeInsight.primaryReagents.slice(0, 2).map(name => `优先尝试 ${name}`)
    nextSteps = dedupeStrings([...remainingChecklist, ...reagentHints]).slice(0, 3)
    if (nextSteps.length === 0) {
      nextSteps = dedupeStrings(challengeInsight.suggestedPrompts).slice(0, 3)
    }
    if (intent === 'exploration') {
      headline = `拉瓦锡判断：${challengeInsight.progressLabel}`
    }
  }

  if (risks.length > 0) {
    headline = `拉瓦锡警告：${risks[0]}`
  }

  let explanation = '我会结合你的操作、反应日志和读数变化给出解释。'
  if (lastEvent?.kind === 'reaction') {
    const reactedText = (lastEvent.reacted || '').trim()
    if (reactedText) {
      explanation = `刚刚的关键现象：${reactedText}`
    } else if (lastEvent.name) {
      explanation = `已加入试剂：${lastEvent.name}。如果没有明显现象，可能需要调整浓度/顺序/温度。`
    }
  } else if (lastEvent?.kind === 'readout' && typeof lastEvent.temp === 'number' && typeof lastEvent.ph === 'number') {
    explanation = `读数变化：温度 ${lastEvent.temp.toFixed(1)}°C，pH ${lastEvent.ph.toFixed(2)}。`
  }

  const goal = buildGoalProgress({ items, gameMode, activeChallenge })
  return { intent, confidence, headline, suggestion, explanation, risks, nextSteps, goal }
}
