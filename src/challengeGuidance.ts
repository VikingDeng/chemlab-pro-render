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

export function isChallengeCompleted(activeChallenge: ActiveChallenge | null, items: ChallengeItem[]) {
  if (!activeChallenge || activeChallenge.completed) return Boolean(activeChallenge?.completed)

  if (activeChallenge.id === 'c1') {
    return items.some(item => {
      if (item.type !== 'beaker' && item.type !== 'flask') return false
      const volume = getTotalLiquidVolume(item.chemState)
      const ph = calculatePH(item.chemState)
      const hasPhenol = (item.chemState.moles.Phenolphthalein || 0) > 0
      const hasMethyl = (item.chemState.moles.MethylOrange || 0) > 0
      return volume >= 99 && volume <= 101 && ph >= 6.95 && ph <= 7.05 && (hasPhenol || hasMethyl)
    })
  }

  if (activeChallenge.id === 'c2') {
    return items.some(item => {
      if (item.type !== 'beaker' && item.type !== 'flask') return false
      const aqueousVol = item.chemState.volume || 0
      const organicVol = item.chemState.organicVolume || 0
      const aqueousIodine = item.chemState.moles.I2 || 0
      const organicIodine = item.chemState.moles.I2_org || 0
      const totalIodine = aqueousIodine + organicIodine

      if (organicVol < 10 || aqueousVol < 10 || totalIodine <= 1e-5) return false

      const organicFraction = organicIodine / totalIodine
      const aqueousConcentration = aqueousVol > 0 ? aqueousIodine / (aqueousVol / 1000) : 0
      const organicConcentration = organicVol > 0 ? organicIodine / (organicVol / 1000) : 0
      const hasPurpleOrganicLayer = Boolean(item.chemState.organicColor?.includes('128,0,128')) || organicConcentration >= 0.01

      return hasPurpleOrganicLayer && organicFraction >= 0.85 && aqueousConcentration <= 0.005 && organicConcentration >= 0.01
    })
  }

  return false
}

export function getChallengeInsight(activeChallenge: ActiveChallenge | null, items: ChallengeItem[]): ChallengeInsight | null {
  if (!activeChallenge) return null

  if (activeChallenge.id === 'c1') {
    const targetContainer = items.find(item => (item.type === 'beaker' || item.type === 'flask') && getTotalLiquidVolume(item.chemState) > 1e-6)
      || items.find(item => item.type === 'beaker' || item.type === 'flask')
    const hasBurette = items.some(item => item.type === 'burette')
    const hasSetup = Boolean(targetContainer) && hasBurette
    const volume = targetContainer ? getTotalLiquidVolume(targetContainer.chemState) : 0
    const ph = targetContainer ? calculatePH(targetContainer.chemState) : 7
    const hasIndicator = targetContainer
      ? (targetContainer.chemState.moles.Phenolphthalein || 0) > 0 || (targetContainer.chemState.moles.MethylOrange || 0) > 0
      : false
    const volumeOk = targetContainer ? volume >= 99 && volume <= 101 : false
    const phOk = targetContainer ? ph >= 6.95 && ph <= 7.05 : false
    const forceDone = activeChallenge.completed || isChallengeCompleted(activeChallenge, items)
    const checklist: ChallengeChecklistItem[] = [
      {
        label: '搭建滴定体系',
        detail: hasSetup ? `已锁定 ${targetContainer?.name || '目标容器'} 与滴定管。` : '先准备烧杯/锥形瓶，并保留滴定管进行精调。',
        done: forceDone || hasSetup,
      },
      {
        label: '总体积逼近 100mL',
        detail: targetContainer ? `${targetContainer.name} 当前 ${volume.toFixed(1)}mL` : '先向目标容器加入酸/碱建立体系。',
        done: forceDone || volumeOk,
      },
      {
        label: '终点收敛到 pH 7.00',
        detail: targetContainer ? `pH ${ph.toFixed(2)} · ${hasIndicator ? '已加指示剂' : '缺少指示剂'}` : '等待形成待测溶液。',
        done: forceDone || (phOk && hasIndicator),
      },
    ]
    const doneCount = checklist.filter(item => item.done).length
    let nextHint = '先加入盐酸和氢氧化钠建立可观察的滴定体系。'
    if (forceDone) {
      nextHint = '终点已经锁定，可以记录现象并进入下一关。'
    } else if (!targetContainer) {
      nextHint = '先选一个烧杯或锥形瓶作为唯一目标容器，再开始加入酸/碱。'
    } else if (!hasIndicator) {
      nextHint = '先补一滴酚酞或甲基橙，再用滴定管少量多次逼近终点。'
    } else if (!volumeOk) {
      nextHint = '把总体积慢慢推到 100mL 左右，宁可少量多次，不要一次性灌满。'
    } else if (!phOk) {
      nextHint = ph > 7.05
        ? '当前偏碱，改用盐酸小体积滴加，让 pH 从上方向 7.00 收敛。'
        : '当前偏酸，改用氢氧化钠小体积滴加，让 pH 从下方向 7.00 收敛。'
    }

    return {
      goal: activeChallenge.target,
      nextHint,
      progressLabel: `${doneCount}/${checklist.length}`,
      progressValue: Math.round((doneCount / checklist.length) * 100),
      primaryReagents: ['盐酸', '氢氧化钠', '酚酞指示剂', '甲基橙指示剂'],
      secondaryReagents: [],
      suggestedPrompts: ['这一步先加什么', '怎么把 pH 调到 7.00', '为什么必须加指示剂'],
      checklist,
    }
  }

  if (activeChallenge.id === 'c2') {
    const targetContainer = items.find(item => (item.type === 'beaker' || item.type === 'flask') && ((item.chemState.organicVolume || 0) > 1e-6 || (item.chemState.volume || 0) > 1e-6))
      || items.find(item => item.type === 'beaker' || item.type === 'flask')
    const aqueousVol = targetContainer?.chemState.volume || 0
    const organicVol = targetContainer?.chemState.organicVolume || 0
    const aqueousIodine = targetContainer?.chemState.moles.I2 || 0
    const organicIodine = targetContainer?.chemState.moles.I2_org || 0
    const totalIodine = aqueousIodine + organicIodine
    const organicFraction = totalIodine > 0 ? organicIodine / totalIodine : 0
    const aqueousConcentration = aqueousVol > 0 ? aqueousIodine / (aqueousVol / 1000) : 0
    const organicConcentration = organicVol > 0 ? organicIodine / (organicVol / 1000) : 0
    const hasDualPhase = aqueousVol > 1e-6 && organicVol > 1e-6
    const hasPurpleOrganicLayer = targetContainer
      ? Boolean(targetContainer.chemState.organicColor?.includes('128,0,128')) || organicConcentration >= 0.01
      : false
    const extractionOk = organicFraction >= 0.85 && aqueousConcentration <= 0.005 && organicConcentration >= 0.01
    const forceDone = activeChallenge.completed || isChallengeCompleted(activeChallenge, items)
    const checklist: ChallengeChecklistItem[] = [
      {
        label: '形成稳定双相',
        detail: targetContainer ? `水相 ${aqueousVol.toFixed(1)}mL / 有机相 ${organicVol.toFixed(1)}mL` : '先在同一容器中建立水/有机两层液相。',
        done: forceDone || hasDualPhase,
      },
      {
        label: '让碘进入有机层',
        detail: hasPurpleOrganicLayer ? '有机层已显著变深，碘开始富集。' : '观察有机层是否出现更深的紫色。',
        done: forceDone || hasPurpleOrganicLayer,
      },
      {
        label: '富集率 ≥ 85%',
        detail: `当前有机富集率 ${(organicFraction * 100).toFixed(0)}%`,
        done: forceDone || extractionOk,
      },
    ]
    const doneCount = checklist.filter(item => item.done).length
    let nextHint = '先把碘水和四氯化碳加入同一容器，静置观察分层。'
    if (forceDone) {
      nextHint = '富集已经达标，可以分离目标液层并记录层析现象。'
    } else if (!targetContainer || !hasDualPhase) {
      nextHint = '先形成稳定双相，再进行萃取判断；没有分层就先不要急着转移。'
    } else if (!hasPurpleOrganicLayer) {
      nextHint = '轻微混合后静置，让碘优先转入有机层，再看紫色是否明显加深。'
    } else if (!extractionOk) {
      nextHint = '继续提高有机层富集率，尽量减少水相中的碘残留后再分离。'
    }

    return {
      goal: activeChallenge.target,
      nextHint,
      progressLabel: `${doneCount}/${checklist.length}`,
      progressValue: Math.round((doneCount / checklist.length) * 100),
      primaryReagents: ['四氯化碳 (CCl₄)', '碘水 (I₂ aq)', '碘单质 (I₂ 固体)'],
      secondaryReagents: [],
      suggestedPrompts: ['萃取下一步做什么', '怎么判断哪一层是有机层', '为什么碘会跑到有机相'],
      checklist,
    }
  }

  return {
    goal: activeChallenge.target,
    nextHint: '继续推进。',
    progressLabel: activeChallenge.completed ? '完成' : '进行中',
    progressValue: activeChallenge.completed ? 100 : 0,
    primaryReagents: [],
    secondaryReagents: [],
    suggestedPrompts: ['下一步做什么'],
    checklist: [],
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

  if (activeChallenge.id === 'c1') {
    const ph = calculatePH(target.chemState)
    const hasIndicator = (target.chemState.moles.Phenolphthalein || 0) > 0 || (target.chemState.moles.MethylOrange || 0) > 0
    if (reagentName === '酚酞指示剂' || reagentName === '甲基橙指示剂') {
      return {
        title: hasIndicator ? '已具备终点标记' : '建议先标记终点',
        detail: hasIndicator ? '该容器已有指示剂，可直接精调 pH。' : '先少量加入指示剂，再用滴定管逼近终点。',
        tone: 'success',
      }
    }
    if (reagentName === '盐酸') {
      return {
        title: ph > 7.05 ? '当前更需要酸' : '盐酸可用于拉低 pH',
        detail: nearFull ? nearFullText : '建议小体积滴加，观察 pH 是否从上方向 7.00 收敛。',
        tone: ph > 7.05 ? 'success' : nearFull ? 'warning' : 'info',
      }
    }
    if (reagentName === '氢氧化钠') {
      return {
        title: ph < 6.95 ? '当前更需要碱' : 'NaOH 可用于抬高 pH',
        detail: nearFull ? nearFullText : '建议小体积滴加，观察 pH 是否从下方向 7.00 收敛。',
        tone: ph < 6.95 ? 'success' : nearFull ? 'warning' : 'info',
      }
    }

    return {
      title: '与本关关联较弱',
      detail: `本关优先使用盐酸、氢氧化钠和指示剂。${nearFull ? ` ${nearFullText}` : ''}`,
      tone: 'warning',
    }
  }

  if (activeChallenge.id === 'c2') {
    if (reagentName === '四氯化碳 (CCl₄)') {
      return {
        title: '关键萃取相',
        detail: nearFull ? nearFullText : '加入后有机会形成有机层，是本关的核心操作。',
        tone: 'success',
      }
    }
    if (reagentName === '碘水 (I₂ aq)' || reagentName === '碘单质 (I₂ 固体)') {
      return {
        title: '目标溶质来源',
        detail: nearFull ? nearFullText : '加入后观察碘是否向有机层迁移并让紫色加深。',
        tone: 'success',
      }
    }

    return {
      title: '先聚焦萃取主试剂',
      detail: `本关更推荐先用四氯化碳和碘体系建立双相。${nearFull ? ` ${nearFullText}` : ''}`,
      tone: 'warning',
    }
  }

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
    detailParts.push('出现双相')
  }
  if (result.reactionType.includes('precipitate')) {
    detailParts.push('静置后可倾析/过滤')
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
