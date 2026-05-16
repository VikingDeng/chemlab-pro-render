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

function makeChallenge(id: 'c1' | 'c2', completed = false): ActiveChallenge {
  return id === 'c1'
    ? {
        id,
        title: '精密酸碱滴定',
        target: '使用滴定管与指示剂制备中性溶液',
        completed,
      }
    : {
        id,
        title: '高级萃取挑战',
        target: '完全萃取出深紫色的碘有机相',
        completed,
      }
}

test('c1 挑战在未放置容器时给出建系提示', () => {
  const insight = getChallengeInsight(makeChallenge('c1'), [])

  assert.ok(insight)
  assert.equal(insight?.progressValue, 0)
  assert.match(insight?.nextHint ?? '', /目标容器|酸\/碱/)
  assert.deepEqual(insight?.primaryReagents, ['盐酸', '氢氧化钠', '酚酞指示剂', '甲基橙指示剂'])
})

test('c1 挑战在 100mL 且 pH 约等于 7 并加入指示剂时判定完成', () => {
  let state = createEmptyState()
  state = mixReagent(state, '盐酸', 49.5).newState
  state = mixReagent(state, '氢氧化钠', 49.5).newState
  state = mixReagent(state, '酚酞指示剂', 1).newState

  const items = [
    makeContainer('烧杯', state),
    makeContainer('滴定管', createEmptyState(), { type: 'burette' }),
  ]

  assert.equal(isChallengeCompleted(makeChallenge('c1'), items), true)
  assert.equal(getChallengeInsight(makeChallenge('c1'), items)?.progressValue, 100)
})

test('c2 挑战在有机层富集碘后判定完成', () => {
  const items = [
    makeContainer('锥形瓶', {
      ...createEmptyState(),
      volume: 30,
      organicVolume: 20,
      organicColor: 'rgba(128,0,128,0.7)',
      moles: {
        I2: 0.00008,
        I2_org: 0.0012,
      },
    }, { type: 'flask' }),
  ]

  assert.equal(isChallengeCompleted(makeChallenge('c2'), items), true)
  assert.equal(getChallengeInsight(makeChallenge('c2'), items)?.progressValue, 100)
})

test('拖拽盐酸到偏碱容器时返回成功型提示', () => {
  let state = createEmptyState()
  state = mixReagent(state, '氢氧化钠', 30).newState

  const hint = buildDragProximityHint(makeChallenge('c1'), makeContainer('烧杯', state), '盐酸')

  assert.equal(hint.tone, 'success')
  assert.match(hint.title, /更需要酸|拉低 pH/)
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
  assert.match(agentState.suggestion, /目标容器|酸\/碱/)
  assert.equal(agentState.goal?.title, '精密酸碱滴定')
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

test('挑战目标进度使用共享 challenge insight 文案', () => {
  const goal = buildGoalProgress({
    items: [],
    gameMode: 'challenge',
    activeChallenge: makeChallenge('c2'),
  })

  assert.equal(goal.title, '高级萃取挑战')
  assert.equal(goal.status, 'in_progress')
  assert.match(goal.progress, /双相|萃取/)
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
