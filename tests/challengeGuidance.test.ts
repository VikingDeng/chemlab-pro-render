import test from 'node:test'
import assert from 'node:assert/strict'

import { createEmptyState, mixReagent } from '../src/chemEngine.js'
import type { ChemState } from '../src/chemEngine.js'
import {
  buildDragProximityHint,
  buildReactionHint,
  getChallengeInsight,
  isChallengeCompleted,
  type ActiveChallenge,
  type ChallengeItem,
} from '../src/challengeGuidance.js'
import {
  buildGoalProgress,
  inferAgentState,
} from '../src/agentHeuristics.js'

function makeContainer(name: string, chemState: ChemState, overrides: Partial<ChallengeItem> = {}): ChallengeItem {
  return {
    id: overrides.id ?? `${name}-id`,
    name,
    type: overrides.type ?? 'beaker',
    x: overrides.x ?? 200,
    y: overrides.y ?? 240,
    chemState,
    state: overrides.state,
    isOn: overrides.isOn ?? false,
    lastReactionTime: overrides.lastReactionTime,
  }
}

type TestChallengeId = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6'

function makeChallenge(id: TestChallengeId, completed = false): ActiveChallenge {
  const copy: Record<TestChallengeId, [string, string]> = {
    c1: ['未知 A：蓝色沉淀', '鉴定未知样品 A，制备蓝绿色 Cu(OH)₂ 沉淀'],
    c2: ['未知 B：白色沉淀', '鉴定未知样品 B，制备白色 AgCl 沉淀'],
    c3: ['未知 C：血红络合', '鉴定未知样品 C，制备血红色 Fe(SCN)₃ 络合物'],
    c4: ['未知 D：气泡', '鉴定未知样品 D，制备二氧化碳气泡'],
    c5: ['未知 E：紫色分层', '鉴定未知样品 E，制备紫色有机层'],
    c6: ['未知 F：褪色', '鉴定未知样品 F，制备高锰酸钾褪色体系'],
  }

  return {
    id,
    title: copy[id][0],
    target: copy[id][1],
    completed,
  }
}

test('c1 制备任务在未放置容器时给出单容器提示', () => {
  const insight = getChallengeInsight(makeChallenge('c1'), [])

  assert.ok(insight)
  assert.equal(insight?.progressValue, 0)
  assert.match(insight?.nextHint ?? '', /烧杯/)
  assert.deepEqual(insight?.primaryReagents, ['未知样品 A', '氢氧化钠'])
  assert.deepEqual(insight?.secondaryReagents, ['氨水', '盐酸'])
})

test('c1 混合硫酸铜和氢氧化钠后完成蓝色沉淀制备', () => {
  let state = createEmptyState()
  state = mixReagent(state, '未知样品 A', 20).newState
  state = mixReagent(state, '氢氧化钠', 20).newState

  const items = [makeContainer('烧杯', state, { state: 'precipitate_cu' })]

  assert.equal(isChallengeCompleted(makeChallenge('c1'), items), true)
  assert.equal(getChallengeInsight(makeChallenge('c1'), items)?.progressValue, 100)
})

test('c2 混合硝酸银和盐酸后完成白色沉淀制备', () => {
  let state = createEmptyState()
  state = mixReagent(state, '硝酸银', 20).newState
  state = mixReagent(state, '盐酸', 20).newState

  const items = [makeContainer('烧杯', state, { state: 'precipitate_ag' })]

  assert.equal(isChallengeCompleted(makeChallenge('c2'), items), true)
  assert.equal(getChallengeInsight(makeChallenge('c2'), items)?.progressValue, 100)
})

test('c3 混合氯化铁和硫氰化钾后完成血红络合物制备', () => {
  let state = createEmptyState()
  state = mixReagent(state, '氯化铁', 12).newState
  state = mixReagent(state, '硫氰化钾', 36).newState

  const items = [makeContainer('烧杯', state, { state: 'complex_fe_scn' })]

  assert.equal(isChallengeCompleted(makeChallenge('c3'), items), true)
  assert.equal(getChallengeInsight(makeChallenge('c3'), items)?.progressValue, 100)
})

test('c4 混合碳酸钠和盐酸后完成气泡制备', () => {
  let state = createEmptyState()
  state = mixReagent(state, '碳酸钠', 20).newState
  state = mixReagent(state, '盐酸', 40).newState

  const items = [makeContainer('烧杯', state, { state: 'gas_co2' })]

  assert.equal(isChallengeCompleted(makeChallenge('c4'), items), true)
  assert.equal(getChallengeInsight(makeChallenge('c4'), items)?.progressValue, 100)
})

test('c5 形成含碘紫色有机层后完成制备', () => {
  let state = createEmptyState()
  state = mixReagent(state, '碘水 (I₂ aq)', 12).newState
  state = mixReagent(state, '四氯化碳 (CCl₄)', 8).newState

  const items = [makeContainer('烧杯', state)]

  assert.equal(isChallengeCompleted(makeChallenge('c5'), items), true)
  assert.equal(getChallengeInsight(makeChallenge('c5'), items)?.progressValue, 100)
})

test('新增萃取剂同样能形成碘的紫色有机层', () => {
  for (const solvent of ['二氯甲烷 (DCM)', '乙酸乙酯 (EtOAc)', '甲苯 (Toluene)', '乙醚 (Ether)', '环己烷 (Cyclohexane)']) {
    let state = createEmptyState()
    state = mixReagent(state, '碘水 (I₂ aq)', 12).newState
    state = mixReagent(state, solvent, 8).newState

    assert.equal(isChallengeCompleted(makeChallenge('c5'), [makeContainer('烧杯', state)]), true, solvent)
    assert.ok((state.organicVolume || 0) > 0, solvent)
    assert.match(state.organicColor || '', /128,0,128/, solvent)
  }
})

test('c6 草酸酸性还原高锰酸钾后完成褪色任务', () => {
  let state = createEmptyState()
  state = mixReagent(state, '高锰酸钾', 20).newState
  state = mixReagent(state, '草酸 (H₂C₂O₄)', 60).newState
  state = mixReagent(state, '硫酸', 40).newState

  const items = [makeContainer('烧杯', state, { state: 'redox_kmno4' })]

  assert.equal(isChallengeCompleted(makeChallenge('c6'), items), true)
  assert.equal(getChallengeInsight(makeChallenge('c6'), items)?.progressValue, 100)
})

test('拖拽任务主试剂到对应容器时返回成功型提示', () => {
  let state = createEmptyState()
  state = mixReagent(state, '未知样品 A', 15).newState

  const hint = buildDragProximityHint(makeChallenge('c1'), makeContainer('烧杯', state), '氢氧化钠')

  assert.equal(hint.tone, 'success')
  assert.match(hint.title, /沉淀/)
})

test('反应提示会带出 pH 和温度增量', () => {
  const previousState = createEmptyState()
  const reaction = mixReagent(mixReagent(previousState, '盐酸', 20).newState, '氢氧化钠', 20)

  const hint = buildReactionHint(makeContainer('烧杯', reaction.newState), '氢氧化钠', previousState, reaction)

  assert.match(hint.detail, /pH/)
  assert.match(hint.detail, /ΔpH|ΔT/)
})

test('挑战模式下的轻量建议复用 challenge insight 的下一步提示', () => {
  const agentState = inferAgentState({
    items: [],
    focusedId: null,
    gameMode: 'challenge',
    activeChallenge: makeChallenge('c1'),
  })

  assert.equal(agentState.intent, 'exploration')
  assert.match(agentState.suggestion, /烧杯/)
  assert.equal(agentState.goal?.title, '未知 A：蓝色沉淀')
})

test('滴定场景在偏碱时给出盐酸微调建议', () => {
  let state = createEmptyState()
  state = mixReagent(state, '氢氧化钠', 25).newState

  const agentState = inferAgentState({
    items: [
      makeContainer('烧杯', state, { id: 'focus-beaker' }),
      makeContainer('滴定管', createEmptyState(), { type: 'burette', id: 'burette-1' }),
    ],
    focusedId: 'focus-beaker',
    gameMode: 'free',
  })

  assert.equal(agentState.intent, 'titration')
  assert.match(agentState.suggestion, /盐酸/)
})

test('高温且接近满量程时优先输出风险警告', () => {
  const hotState = {
    ...createEmptyState(),
    volume: 240,
    temperature: 88,
  }

  const agentState = inferAgentState({
    items: [makeContainer('烧杯', hotState, { id: 'hot-beaker' })],
    focusedId: 'hot-beaker',
    gameMode: 'free',
  })

  assert.match(agentState.headline, /拉瓦锡警告/)
  assert.ok(agentState.risks.some((risk: string) => /满量|温度偏高/.test(risk)))
})

test('挑战目标进度使用新的制备任务文案', () => {
  const goal = buildGoalProgress({
    items: [],
    gameMode: 'challenge',
    activeChallenge: makeChallenge('c3'),
  })

  assert.equal(goal.title, '未知 C：血红络合')
  assert.equal(goal.status, 'in_progress')
  assert.match(goal.progress, /未知样品 C|硫氰化钾|烧杯/)
})

test('反应事件优先进入轻量建议解释文案', () => {
  const agentState = inferAgentState({
    items: [],
    focusedId: null,
    gameMode: 'free',
    lastEvent: {
      kind: 'reaction',
      reacted: '观察到紫色有机层明显加深',
    },
  })

  assert.match(agentState.explanation, /紫色有机层明显加深/)
})
