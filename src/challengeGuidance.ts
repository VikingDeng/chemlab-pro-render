import { calculatePH, getTotalLiquidVolume } from './chemEngine.js'
import type { ChemState } from './chemEngine.js'

export type HintTone = 'info' | 'success' | 'warning'

export type ActiveChallenge = {
  id: string
  title: string
  target: string
  completed: boolean
  targetId?: string
}

export type ChallengeItem = {
  id: string
  name: string
  type: string
  x: number
  y: number
  chemState: ChemState
  state?: string
  isOn?: boolean
  lastReactionTime?: number
}

export type ContainerHintCard = {
  targetId: string
  title: string
  detail: string
  tone: HintTone
}

export type ChallengeChecklistItem = {
  label: string
  detail: string
  done: boolean
}

export type ChallengeInsight = {
  goal: string
  nextHint: string
  progressLabel: string
  progressValue: number
  primaryReagents: string[]
  secondaryReagents: string[]
  suggestedPrompts: string[]
  checklist: ChallengeChecklistItem[]
}

export type ReactionHintResult = {
  newState: ChemState
  log: string
  reactionType: string
  equation: string | null
}

type PrepChallengeId = 'c1' | 'c2' | 'c3'

type PrepChallengeCopy = {
  goal: string
  primaryReagents: string[]
  secondaryReagents: string[]
  suggestedPrompts: string[]
}

const LIQUID_CONTAINER_TYPES = new Set(['beaker', 'flask', 'testtube'])

const PREP_CHALLENGES: Record<PrepChallengeId, PrepChallengeCopy> = {
  c1: {
    goal: '制备蓝绿色 Cu(OH)₂ 沉淀',
    primaryReagents: ['硫酸铜', '氢氧化钠'],
    secondaryReagents: ['氨水', '盐酸'],
    suggestedPrompts: ['下一步', '为什么变浑浊', '还能试什么'],
  },
  c2: {
    goal: '制备血红色 Fe(SCN)₃ 络合物',
    primaryReagents: ['氯化铁', '硫氰化钾'],
    secondaryReagents: ['氢氧化钠', '硫酸亚铁'],
    suggestedPrompts: ['下一步', '为什么变红', '还能试什么'],
  },
  c3: {
    goal: '制备紫色有机层',
    primaryReagents: ['碘水 (I₂ aq)', '四氯化碳 (CCl₄)'],
    secondaryReagents: ['正己烷 (Hexane)'],
    suggestedPrompts: ['下一步', '怎么看分层', '还能试什么'],
  },
}

export function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
}

export function getContainerCapacity(type: string) {
  switch (type) {
    case 'testtube':
      return 20
    case 'burette':
      return 50
    case 'pipette':
      return 10
    case 'flask':
      return 500
    case 'beaker':
    default:
      return 250
  }
}

function isPrepChallengeId(id: string): id is PrepChallengeId {
  return id === 'c1' || id === 'c2' || id === 'c3'
}

function isLiquidContainer(item: ChallengeItem) {
  return LIQUID_CONTAINER_TYPES.has(item.type)
}

function moleAmount(state: ChemState | undefined, formula: string) {
  return state?.moles?.[formula] || 0
}

function hasAnyMole(state: ChemState | undefined, formulas: string[], threshold = 1e-7) {
  return formulas.some(formula => moleAmount(state, formula) > threshold)
}

function findPrepContainer(items: ChallengeItem[], formulas: string[] = []) {
  const containers = items.filter(isLiquidContainer)
  return containers.find(item => hasAnyMole(item.chemState, formulas))
    || containers.find(item => getTotalLiquidVolume(item.chemState) > 1e-6)
    || containers[0]
}

function countDone(checklist: ChallengeChecklistItem[]) {
  return checklist.filter(item => item.done).length
}

function buildInsightResult(
  activeChallenge: ActiveChallenge,
  checklist: ChallengeChecklistItem[],
  nextHint: string,
  progressValue: number,
) {
  const copy = isPrepChallengeId(activeChallenge.id) ? PREP_CHALLENGES[activeChallenge.id] : undefined
  const isDone = activeChallenge.completed || progressValue >= 100

  return {
    goal: copy?.goal || activeChallenge.target,
    nextHint: isDone ? '完成，可以换一个制备目标。' : nextHint,
    progressLabel: isDone ? '完成' : '探索中',
    progressValue: isDone ? 100 : progressValue,
    primaryReagents: copy?.primaryReagents || [],
    secondaryReagents: copy?.secondaryReagents || [],
    suggestedPrompts: copy?.suggestedPrompts || ['下一步'],
    checklist: isDone ? checklist.map(item => ({ ...item, done: true })) : checklist,
  }
}

function hasCuPrecipitate(state: ChemState | undefined) {
  return hasAnyMole(state, ['Cu(OH)2'], 1e-6)
}

function hasFeScnComplex(state: ChemState | undefined) {
  return hasAnyMole(state, ['Fe(SCN)3'], 1e-6)
}

function hasPurpleOrganicLayer(state: ChemState | undefined) {
  if (!state) return false
  const organicVolume = state.organicVolume || 0
  const organicIodine = moleAmount(state, 'I2_org')
  const organicColor = state.organicColor || ''
  return organicVolume >= 1 && (organicIodine > 1e-6 || organicColor.includes('128,0,128'))
}

export function isChallengeCompleted(activeChallenge: ActiveChallenge | null, items: ChallengeItem[]) {
  if (!activeChallenge || activeChallenge.completed) return Boolean(activeChallenge?.completed)

  if (activeChallenge.id === 'c1') {
    return items.some(item => isLiquidContainer(item) && hasCuPrecipitate(item.chemState))
  }

  if (activeChallenge.id === 'c2') {
    return items.some(item => isLiquidContainer(item) && hasFeScnComplex(item.chemState))
  }

  if (activeChallenge.id === 'c3') {
    return items.some(item => isLiquidContainer(item) && hasPurpleOrganicLayer(item.chemState))
  }

  return false
}

function buildCopperInsight(activeChallenge: ActiveChallenge, items: ChallengeItem[]): ChallengeInsight {
  const target = findPrepContainer(items, ['CuSO4', 'NaOH', 'Cu(OH)2', 'Cu(NH3)4SO4'])
  const hasCopperSource = hasAnyMole(target?.chemState, ['CuSO4', 'Cu(OH)2', 'Cu(NH3)4SO4'])
  const hasBase = hasAnyMole(target?.chemState, ['NaOH', 'Cu(OH)2'])
  const hasProduct = hasCuPrecipitate(target?.chemState)
  const forceDone = activeChallenge.completed || isChallengeCompleted(activeChallenge, items)

  const checklist: ChallengeChecklistItem[] = [
    {
      label: '硫酸铜',
      detail: hasCopperSource ? '铜盐已在容器中。' : '先加入硫酸铜。',
      done: forceDone || hasCopperSource,
    },
    {
      label: '氢氧化钠',
      detail: hasBase ? '碱已加入。' : '再加入氢氧化钠。',
      done: forceDone || hasBase,
    },
    {
      label: '蓝绿色沉淀',
      detail: hasProduct ? '沉淀已出现。' : '观察是否变浑浊。',
      done: forceDone || hasProduct,
    },
  ]

  let nextHint = '先加硫酸铜，再加氢氧化钠。'
  if (!target) nextHint = '先放一个烧杯。'
  else if (!hasCopperSource) nextHint = '先加硫酸铜。'
  else if (!hasBase) nextHint = '再加氢氧化钠。'
  else if (!hasProduct) nextHint = '少量补加氢氧化钠，等沉淀显现。'

  const progressValue = forceDone || hasProduct ? 100 : Math.round((countDone(checklist) / checklist.length) * 100)
  return buildInsightResult(activeChallenge, checklist, nextHint, progressValue)
}

function buildIronComplexInsight(activeChallenge: ActiveChallenge, items: ChallengeItem[]): ChallengeInsight {
  const target = findPrepContainer(items, ['FeCl3', 'KSCN', 'Fe(SCN)3', 'Fe(OH)3'])
  const hasIron = hasAnyMole(target?.chemState, ['FeCl3', 'Fe(SCN)3', 'Fe(OH)3'])
  const hasThiocyanate = hasAnyMole(target?.chemState, ['KSCN', 'Fe(SCN)3'])
  const hasProduct = hasFeScnComplex(target?.chemState)
  const forceDone = activeChallenge.completed || isChallengeCompleted(activeChallenge, items)

  const checklist: ChallengeChecklistItem[] = [
    {
      label: '氯化铁',
      detail: hasIron ? '铁盐已在容器中。' : '先加入氯化铁。',
      done: forceDone || hasIron,
    },
    {
      label: '硫氰化钾',
      detail: hasThiocyanate ? 'SCN⁻ 已加入。' : '再加入硫氰化钾。',
      done: forceDone || hasThiocyanate,
    },
    {
      label: '血红色',
      detail: hasProduct ? '血红色络合物已形成。' : '观察颜色是否突然变红。',
      done: forceDone || hasProduct,
    },
  ]

  let nextHint = '先加氯化铁，再加硫氰化钾。'
  if (!target) nextHint = '先放一个烧杯。'
  else if (!hasIron) nextHint = '先加氯化铁。'
  else if (!hasThiocyanate) nextHint = '再加硫氰化钾。'
  else if (!hasProduct) nextHint = '少量补加硫氰化钾，看颜色是否变深。'

  const progressValue = forceDone || hasProduct ? 100 : Math.round((countDone(checklist) / checklist.length) * 100)
  return buildInsightResult(activeChallenge, checklist, nextHint, progressValue)
}

function buildIodineLayerInsight(activeChallenge: ActiveChallenge, items: ChallengeItem[]): ChallengeInsight {
  const target = findPrepContainer(items, ['I2', 'I2_org', 'CCl4', 'Hexane'])
  const hasIodine = hasAnyMole(target?.chemState, ['I2', 'I2_org'])
  const hasOrganic = (target?.chemState.organicVolume || 0) >= 1
  const hasProduct = hasPurpleOrganicLayer(target?.chemState)
  const forceDone = activeChallenge.completed || isChallengeCompleted(activeChallenge, items)

  const checklist: ChallengeChecklistItem[] = [
    {
      label: '碘水',
      detail: hasIodine ? '碘已加入。' : '先加入碘水。',
      done: forceDone || hasIodine,
    },
    {
      label: '有机相',
      detail: hasOrganic ? '有机层已形成。' : '再加入四氯化碳。',
      done: forceDone || hasOrganic,
    },
    {
      label: '紫色层',
      detail: hasProduct ? '紫色有机层已出现。' : '静置，观察哪一层变紫。',
      done: forceDone || hasProduct,
    },
  ]

  let nextHint = '先加碘水，再加四氯化碳。'
  if (!target) nextHint = '先放一个烧杯。'
  else if (!hasIodine) nextHint = '先加碘水。'
  else if (!hasOrganic) nextHint = '再加四氯化碳。'
  else if (!hasProduct) nextHint = '轻微混合后静置，看有机层变紫。'

  const progressValue = forceDone || hasProduct ? 100 : Math.round((countDone(checklist) / checklist.length) * 100)
  return buildInsightResult(activeChallenge, checklist, nextHint, progressValue)
}

export function getChallengeInsight(activeChallenge: ActiveChallenge | null, items: ChallengeItem[]): ChallengeInsight | null {
  if (!activeChallenge) return null

  if (activeChallenge.id === 'c1') return buildCopperInsight(activeChallenge, items)
  if (activeChallenge.id === 'c2') return buildIronComplexInsight(activeChallenge, items)
  if (activeChallenge.id === 'c3') return buildIodineLayerInsight(activeChallenge, items)

  return {
    goal: activeChallenge.target,
    nextHint: '继续推进。',
    progressLabel: activeChallenge.completed ? '完成' : '进行中',
    progressValue: activeChallenge.completed ? 100 : 0,
    primaryReagents: [],
    secondaryReagents: [],
    suggestedPrompts: ['下一步'],
    checklist: [],
  }
}

function buildPrepDragHint(
  activeChallenge: ActiveChallenge,
  target: ChallengeItem,
  reagentName: string,
  nearFullText: string,
  nearFull: boolean,
): Omit<ContainerHintCard, 'targetId'> | null {
  const id = activeChallenge.id

  if (id === 'c1') {
    const hasCopper = hasAnyMole(target.chemState, ['CuSO4', 'Cu(OH)2', 'Cu(NH3)4SO4'])
    if (reagentName === '硫酸铜') {
      return { title: '可作为起点', detail: nearFull ? nearFullText : '加入后会出现清亮蓝色。', tone: nearFull ? 'warning' : 'success' }
    }
    if (reagentName === '氢氧化钠') {
      return { title: hasCopper ? '会触发沉淀' : '需要先有铜盐', detail: nearFull ? nearFullText : '与硫酸铜相遇会生成蓝绿色沉淀。', tone: hasCopper ? 'success' : 'info' }
    }
    if (reagentName === '氨水') {
      return { title: '探索支线', detail: nearFull ? nearFullText : '铜体系里少量尝试，会出现更深的蓝色络合效果。', tone: 'info' }
    }
  }

  if (id === 'c2') {
    const hasIron = hasAnyMole(target.chemState, ['FeCl3', 'Fe(SCN)3', 'Fe(OH)3'])
    if (reagentName === '氯化铁') {
      return { title: '可作为起点', detail: nearFull ? nearFullText : '加入后是黄色铁盐溶液。', tone: nearFull ? 'warning' : 'success' }
    }
    if (reagentName === '硫氰化钾') {
      return { title: hasIron ? '会触发血红色' : '需要先有铁盐', detail: nearFull ? nearFullText : '与 Fe³⁺ 相遇会迅速变红。', tone: hasIron ? 'success' : 'info' }
    }
    if (reagentName === '氢氧化钠') {
      return { title: '探索支线', detail: nearFull ? nearFullText : '会把铁盐拉向沉淀现象，可用来对比血红络合。', tone: 'info' }
    }
  }

  if (id === 'c3') {
    const hasIodine = hasAnyMole(target.chemState, ['I2', 'I2_org'])
    const hasOrganic = (target.chemState.organicVolume || 0) >= 1
    if (reagentName === '碘水 (I₂ aq)') {
      return { title: hasOrganic ? '会给有机层上色' : '可作为起点', detail: nearFull ? nearFullText : '提供碘，后续会被有机层富集成紫色。', tone: nearFull ? 'warning' : 'success' }
    }
    if (reagentName === '四氯化碳 (CCl₄)' || reagentName === '正己烷 (Hexane)') {
      return { title: hasIodine ? '会形成紫色层' : '先形成有机层', detail: nearFull ? nearFullText : '加入后静置分层，碘会偏向有机相。', tone: hasIodine || hasOrganic ? 'success' : 'info' }
    }
  }

  if (isPrepChallengeId(id)) {
    const copy = PREP_CHALLENGES[id]
    return {
      title: '先聚焦本关试剂',
      detail: `${copy.primaryReagents.join(' + ')}。${nearFull ? ` ${nearFullText}` : ''}`,
      tone: nearFull ? 'warning' : 'info',
    }
  }

  return null
}

export function buildDragProximityHint(
  activeChallenge: ActiveChallenge | null,
  target: ChallengeItem,
  reagentName: string,
): Omit<ContainerHintCard, 'targetId'> {
  const currentVolume = getTotalLiquidVolume(target.chemState)
  const capacity = getContainerCapacity(target.type)
  const nearFull = currentVolume >= capacity * 0.82
  const nearFullText = nearFull ? `当前已装 ${currentVolume.toFixed(1)}/${capacity}mL，建议小体积操作。` : `当前 ${target.name} 已装 ${currentVolume.toFixed(1)}mL。`

  if (!activeChallenge) {
    return nearFull
      ? { title: '接近满量程', detail: nearFullText, tone: 'warning' }
      : { title: '可直接加入', detail: `${target.name} 会立即接收并混合 ${reagentName}。`, tone: 'info' }
  }

  const prepHint = buildPrepDragHint(activeChallenge, target, reagentName, nearFullText, nearFull)
  if (prepHint) return prepHint

  return nearFull
    ? { title: '接近满量程', detail: nearFullText, tone: 'warning' }
    : { title: '可直接加入', detail: `${target.name} 会立即接收并混合 ${reagentName}。`, tone: 'info' }
}

export function buildReactionHint(target: ChallengeItem, reagentName: string, previousState: ChemState, result: ReactionHintResult): Omit<ContainerHintCard, 'targetId'> {
  const nextVolume = getTotalLiquidVolume(result.newState)
  const nextPh = calculatePH(result.newState)
  const deltaPh = nextPh - calculatePH(previousState)
  const deltaTemp = result.newState.temperature - previousState.temperature
  const capacity = getContainerCapacity(target.type)
  const detailParts = [`${target.name} ${nextVolume.toFixed(1)}mL`, `pH ${nextPh.toFixed(2)}`]

  if (Math.abs(deltaPh) >= 0.15) {
    detailParts.push(`ΔpH ${deltaPh > 0 ? '+' : ''}${deltaPh.toFixed(2)}`)
  }
  if (Math.abs(deltaTemp) >= 0.5) {
    detailParts.push(`ΔT ${deltaTemp > 0 ? '+' : ''}${deltaTemp.toFixed(1)}°C`)
  }
  if ((result.newState.organicVolume || 0) > 1e-6 && (result.newState.volume || 0) > 1e-6) {
    detailParts.push('出现分层')
  }
  if (result.reactionType.includes('precipitate')) {
    detailParts.push('有沉淀')
  }
  if (result.reactionType.includes('complex')) {
    detailParts.push('颜色突变')
  }
  if (nextVolume >= capacity * 0.9) {
    detailParts.push('接近满量程')
  }

  const title = result.reactionType === 'added'
    ? `已加入 ${reagentName}`
    : result.log.split(/[，。]/)[0] || `已加入 ${reagentName}`

  const tone: HintTone = result.reactionType.includes('precipitate')
    || result.reactionType.includes('gas')
    || result.reactionType === 'neutralize'
    || result.reactionType.includes('complex')
    || result.reactionType.includes('redox')
    ? 'success'
    : nextVolume >= capacity * 0.9
    ? 'warning'
    : 'info'

  return {
    title,
    detail: detailParts.join(' · '),
    tone,
  }
}
