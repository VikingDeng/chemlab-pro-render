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

type PrepChallengeId = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6'

type PrepStep = {
  label: string
  formulas: string[]
  pending: string
  done: string
}

type PrepChallengeCopy = {
  goal: string
  primaryReagents: string[]
  secondaryReagents: string[]
  suggestedPrompts: string[]
  containerFormulas: string[]
  productLabel: string
  startHint: string
  steps: PrepStep[]
}

const LIQUID_CONTAINER_TYPES = new Set(['beaker', 'flask', 'testtube'])

const REAGENT_FORMULAS: Record<string, string[]> = {
  硫酸铜: ['CuSO4'],
  '未知样品 A': ['CuSO4'],
  '未知样品 B': ['AgNO3'],
  '未知样品 C': ['FeCl3'],
  '未知样品 D': ['Na2CO3'],
  '未知样品 E': ['I2'],
  '未知样品 F': ['KMnO4'],
  氢氧化钠: ['NaOH'],
  氨水: ['NH3H2O'],
  盐酸: ['HCl'],
  硝酸银: ['AgNO3'],
  氯化铁: ['FeCl3'],
  硫氰化钾: ['KSCN'],
  碳酸钠: ['Na2CO3'],
  '碘水 (I₂ aq)': ['I2'],
  '四氯化碳 (CCl₄)': ['CCl4'],
  '二氯甲烷 (DCM)': ['CH2Cl2'],
  '乙酸乙酯 (EtOAc)': ['EtOAc'],
  '甲苯 (Toluene)': ['Toluene'],
  '乙醚 (Ether)': ['Et2O'],
  '环己烷 (Cyclohexane)': ['Cyclohexane'],
  '正己烷 (Hexane)': ['Hexane'],
  高锰酸钾: ['KMnO4'],
  '草酸 (H₂C₂O₄)': ['H2C2O4'],
  硫酸: ['H2SO4'],
}

const PREP_CHALLENGES: Record<PrepChallengeId, PrepChallengeCopy> = {
  c1: {
    goal: '鉴定未知样品 A，制备蓝绿色 Cu(OH)₂ 沉淀',
    primaryReagents: ['未知样品 A', '氢氧化钠'],
    secondaryReagents: ['氨水', '盐酸'],
    suggestedPrompts: ['下一步', '为什么浑浊', '还能试什么'],
    containerFormulas: ['CuSO4', 'NaOH', 'Cu(OH)2', 'Cu(NH3)4SO4'],
    productLabel: '蓝绿色沉淀',
    startHint: '先加未知样品 A，再加氢氧化钠。',
    steps: [
      { label: '未知样品 A', formulas: ['CuSO4', 'Cu(OH)2', 'Cu(NH3)4SO4'], pending: '先加入未知样品 A。', done: '样品 A 已加入。' },
      { label: '氢氧化钠', formulas: ['NaOH', 'Cu(OH)2'], pending: '再加入氢氧化钠。', done: '碱已加入。' },
      { label: '蓝绿色沉淀', formulas: ['Cu(OH)2'], pending: '观察是否变浑浊。', done: '沉淀已出现。' },
    ],
  },
  c2: {
    goal: '鉴定未知样品 B，制备白色 AgCl 沉淀',
    primaryReagents: ['未知样品 B', '盐酸'],
    secondaryReagents: ['氨水', '硝酸'],
    suggestedPrompts: ['下一步', '为什么变白', '还能试什么'],
    containerFormulas: ['AgNO3', 'HCl', 'AgCl', 'HNO3'],
    productLabel: '白色沉淀',
    startHint: '先加未知样品 B，再加盐酸。',
    steps: [
      { label: '未知样品 B', formulas: ['AgNO3', 'AgCl'], pending: '先加入未知样品 B。', done: '样品 B 已加入。' },
      { label: '盐酸', formulas: ['HCl', 'AgCl'], pending: '再加入盐酸。', done: '氯离子已加入。' },
      { label: '白色沉淀', formulas: ['AgCl'], pending: '观察白色浑浊。', done: 'AgCl 已出现。' },
    ],
  },
  c3: {
    goal: '鉴定未知样品 C，制备血红色 Fe(SCN)₃ 络合物',
    primaryReagents: ['未知样品 C', '硫氰化钾'],
    secondaryReagents: ['氢氧化钠', '硫酸亚铁'],
    suggestedPrompts: ['下一步', '为什么变红', '还能试什么'],
    containerFormulas: ['FeCl3', 'KSCN', 'Fe(SCN)3', 'Fe(OH)3'],
    productLabel: '血红色',
    startHint: '先加未知样品 C，再加硫氰化钾。',
    steps: [
      { label: '未知样品 C', formulas: ['FeCl3', 'Fe(SCN)3', 'Fe(OH)3'], pending: '先加入未知样品 C。', done: '样品 C 已加入。' },
      { label: '硫氰化钾', formulas: ['KSCN', 'Fe(SCN)3'], pending: '再加入硫氰化钾。', done: 'SCN⁻ 已加入。' },
      { label: '血红色', formulas: ['Fe(SCN)3'], pending: '观察颜色是否突然变红。', done: '血红络合物已形成。' },
    ],
  },
  c4: {
    goal: '鉴定未知样品 D，制备二氧化碳气泡',
    primaryReagents: ['未知样品 D', '盐酸'],
    secondaryReagents: ['甲基橙指示剂', '氢氧化钠'],
    suggestedPrompts: ['下一步', '为什么冒泡', '还能试什么'],
    containerFormulas: ['Na2CO3', 'HCl', 'CO2', 'NaCl'],
    productLabel: '气泡',
    startHint: '先加未知样品 D，再加盐酸。',
    steps: [
      { label: '未知样品 D', formulas: ['Na2CO3', 'CO2'], pending: '先加入未知样品 D。', done: '样品 D 已加入。' },
      { label: '盐酸', formulas: ['HCl', 'CO2'], pending: '再加入盐酸。', done: '酸已加入。' },
      { label: '气泡', formulas: ['CO2'], pending: '观察是否冒泡。', done: 'CO₂ 已产生。' },
    ],
  },
  c5: {
    goal: '鉴定未知样品 E，制备紫色有机层',
    primaryReagents: ['未知样品 E', '四氯化碳 (CCl₄)'],
    secondaryReagents: ['正己烷 (Hexane)', '二氯甲烷 (DCM)', '乙酸乙酯 (EtOAc)', '甲苯 (Toluene)', '乙醚 (Ether)', '环己烷 (Cyclohexane)'],
    suggestedPrompts: ['下一步', '怎么看分层', '还能试什么'],
    containerFormulas: ['I2', 'I2_org', 'CCl4', 'CH2Cl2', 'EtOAc', 'Toluene', 'Et2O', 'Cyclohexane', 'Hexane'],
    productLabel: '紫色层',
    startHint: '先加未知样品 E，再加四氯化碳。',
    steps: [
      { label: '未知样品 E', formulas: ['I2', 'I2_org'], pending: '先加入未知样品 E。', done: '样品 E 已加入。' },
      { label: '有机相', formulas: ['CCl4', 'CH2Cl2', 'EtOAc', 'Toluene', 'Et2O', 'Cyclohexane', 'Hexane', 'I2_org'], pending: '再加入一种萃取剂。', done: '有机层已形成。' },
      { label: '紫色层', formulas: ['I2_org'], pending: '静置，观察哪一层变紫。', done: '紫色有机层已出现。' },
    ],
  },
  c6: {
    goal: '鉴定未知样品 F，制备高锰酸钾褪色体系',
    primaryReagents: ['未知样品 F', '草酸 (H₂C₂O₄)', '硫酸'],
    secondaryReagents: ['双氧水', '盐酸'],
    suggestedPrompts: ['下一步', '为什么褪色', '还能试什么'],
    containerFormulas: ['KMnO4', 'H2C2O4', 'H2SO4', 'MnSO4', 'CO2'],
    productLabel: '褪色与气泡',
    startHint: '先加未知样品 F，再加草酸和硫酸。',
    steps: [
      { label: '未知样品 F', formulas: ['KMnO4', 'MnSO4'], pending: '先加入未知样品 F。', done: '样品 F 已加入。' },
      { label: '草酸', formulas: ['H2C2O4', 'MnSO4'], pending: '再加入草酸。', done: '还原剂已加入。' },
      { label: '硫酸', formulas: ['H2SO4', 'MnSO4'], pending: '补加少量硫酸。', done: '酸性环境已建立。' },
      { label: '褪色', formulas: ['MnSO4', 'K2SO4'], pending: '观察紫色是否变浅并出现气泡。', done: '褪色反应已发生。' },
    ],
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
  return id === 'c1' || id === 'c2' || id === 'c3' || id === 'c4' || id === 'c5' || id === 'c6'
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

function hasPurpleOrganicLayer(state: ChemState | undefined) {
  if (!state) return false
  const organicVolume = state.organicVolume || 0
  const organicIodine = moleAmount(state, 'I2_org')
  const organicColor = state.organicColor || ''
  return organicVolume >= 1 && (organicIodine > 1e-6 || organicColor.includes('128,0,128'))
}

function isPrepProductDone(id: string, state: ChemState | undefined) {
  if (!state) return false
  switch (id) {
    case 'c1': return hasAnyMole(state, ['Cu(OH)2'], 1e-6)
    case 'c2': return hasAnyMole(state, ['AgCl'], 1e-6)
    case 'c3': return hasAnyMole(state, ['Fe(SCN)3'], 1e-6)
    case 'c4': return hasAnyMole(state, ['CO2'], 1e-6)
    case 'c5': return hasPurpleOrganicLayer(state)
    case 'c6': return hasAnyMole(state, ['MnSO4', 'K2SO4'], 1e-7)
    default: return false
  }
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
    nextHint: isDone ? '完成，可以换下一关。' : nextHint,
    progressLabel: isDone ? '完成' : '探索中',
    progressValue: isDone ? 100 : progressValue,
    primaryReagents: copy?.primaryReagents || [],
    secondaryReagents: copy?.secondaryReagents || [],
    suggestedPrompts: copy?.suggestedPrompts || ['下一步'],
    checklist: isDone ? checklist.map(item => ({ ...item, done: true })) : checklist,
  }
}

export function isChallengeCompleted(activeChallenge: ActiveChallenge | null, items: ChallengeItem[]) {
  if (!activeChallenge || activeChallenge.completed) return Boolean(activeChallenge?.completed)
  if (!isPrepChallengeId(activeChallenge.id)) return false
  return items.some(item => isLiquidContainer(item) && isPrepProductDone(activeChallenge.id, item.chemState))
}

function buildPrepInsight(activeChallenge: ActiveChallenge, items: ChallengeItem[]): ChallengeInsight {
  const copy = PREP_CHALLENGES[activeChallenge.id as PrepChallengeId]
  const target = findPrepContainer(items, copy.containerFormulas)
  const forceDone = activeChallenge.completed || isChallengeCompleted(activeChallenge, items)

  const checklist = copy.steps.map(step => {
    const done = forceDone || hasAnyMole(target?.chemState, step.formulas, 1e-7) || (step.label === copy.productLabel && isPrepProductDone(activeChallenge.id, target?.chemState))
    return {
      label: step.label,
      detail: done ? step.done : step.pending,
      done,
    }
  })

  const nextUndone = checklist.find(item => !item.done)
  const productDone = forceDone || isPrepProductDone(activeChallenge.id, target?.chemState)
  let nextHint = copy.startHint
  if (!target) nextHint = '先放一个烧杯。'
  else if (nextUndone) nextHint = copy.steps.find(step => step.label === nextUndone.label)?.pending || copy.startHint

  const progressValue = productDone ? 100 : Math.round((countDone(checklist) / checklist.length) * 100)
  return buildInsightResult(activeChallenge, checklist, nextHint, progressValue)
}

export function getChallengeInsight(activeChallenge: ActiveChallenge | null, items: ChallengeItem[]): ChallengeInsight | null {
  if (!activeChallenge) return null
  if (isPrepChallengeId(activeChallenge.id)) return buildPrepInsight(activeChallenge, items)

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

function formulasForReagents(reagents: string[]) {
  return reagents.flatMap(reagent => REAGENT_FORMULAS[reagent] || [])
}

function buildPrepDragHint(
  activeChallenge: ActiveChallenge,
  target: ChallengeItem,
  reagentName: string,
  nearFullText: string,
  nearFull: boolean,
): Omit<ContainerHintCard, 'targetId'> | null {
  if (!isPrepChallengeId(activeChallenge.id)) return null

  const copy = PREP_CHALLENGES[activeChallenge.id]
  const isPrimary = copy.primaryReagents.includes(reagentName)
  const isSecondary = copy.secondaryReagents.includes(reagentName)
  const otherPrimaryFormulas = formulasForReagents(copy.primaryReagents.filter(name => name !== reagentName))
  const hasPartner = hasAnyMole(target.chemState, otherPrimaryFormulas)

  if (isPrimary) {
    return {
      title: hasPartner ? `会触发${copy.productLabel}` : '可作为起点',
      detail: nearFull ? nearFullText : copy.startHint,
      tone: nearFull ? 'warning' : 'success',
    }
  }

  if (isSecondary) {
    return {
      title: '探索支线',
      detail: nearFull ? nearFullText : '可以少量尝试，对比颜色、沉淀或读数变化。',
      tone: nearFull ? 'warning' : 'info',
    }
  }

  return {
    title: '先聚焦本关试剂',
    detail: `${copy.primaryReagents.join(' + ')}。${nearFull ? ` ${nearFullText}` : ''}`,
    tone: nearFull ? 'warning' : 'info',
  }
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
