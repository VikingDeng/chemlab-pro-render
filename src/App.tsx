import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import { Beaker, FlaskConical, Flame, TestTubes, TestTube, Pipette, Gauge, Menu, X, ChevronUp, ChevronDown, Droplets, Thermometer, PenTool, Blend, Cable, BookOpen } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { EquipmentCard } from './EquipmentCard'
import { ReagentShelf } from './ReagentShelf'
import { ObservationLog } from './ObservationLog'
import { DashboardReadouts } from './DashboardReadouts'
import { createEmptyState, mixReagent, calculatePH, calculatePressureEstimate, getChemColor, mergeChemStates, splitChemState, getTotalLiquidVolume, getReagentLiquidContributionML } from './chemEngine'
import type { ChemState, SplitChemStateOptions } from './chemEngine'
import { usePhysicsEngine } from './hooks/usePhysicsEngine'
import type { PlacedItem } from './hooks/usePhysicsEngine'
import './index.css'
import { RealisticBeaker } from './components/RealisticBeaker'
import { RealisticFlask } from './components/RealisticFlask'
import { AlcoholLamp } from './components/AlcoholLamp'
import { BrokenGlass } from './components/BrokenGlass'
import { Burette } from './components/Burette'
import { DistillationSetup } from './components/DistillationSetup'
import { HolographicTooltip } from './components/HolographicTooltip'
import { TestTubeRack } from './components/TestTubeRack'
import { RealisticTestTube } from './components/RealisticTestTube'
import { ThermoChart } from './components/ThermoChart'
import {
  buildDragProximityHint as computeDragProximityHint,
  buildReactionHint as computeReactionHint,
  dedupeStrings as dedupePromptStrings,
  getChallengeInsight as computeChallengeInsight,
  isChallengeCompleted as computeChallengeCompleted,
} from './challengeGuidance'
import { inferAgentState } from './agentHeuristics'
import type { AgentIntent, AgentLastEvent } from './agentHeuristics'
// import { playSound, stopSound } from './utils/audio'

type BrokenGlassPiece = { id: string; x: number; y: number; color: string };

type HistorySnapshot = {
  placedItems: PlacedItem[];
  brokenGlass: BrokenGlassPiece[];
  focusedItemId: string | null;
  temperatureHistory: { time: number; temp: number }[];
};

const ROOM_TEMPERATURE = 22.4;
let runtimeIdCounter = 0;

type ReactionResult = {
  newState: ChemState;
  log: string;
  reactionType: string;
  equation: string | null;
};

type AgentChatMessage = {
  id: string;
  role: 'agent' | 'user';
  text: string;
};

type AgentToolCall = {
  type: 'focus_container' | 'open_logs' | 'open_reagents' | 'save_note';
  targetId?: string;
  note?: string;
};

type LavoisierAgentApiResponse = {
  reply: string;
  headline?: string;
  suggestedPrompts?: string[];
  toolCalls?: AgentToolCall[];
  statusLabel?: string;
};

type AgentSpeciesSummary = {
  formula: string;
  label: string;
  amount: number;
};

type DragInfoLike = {
  point?: { x: number; y: number };
};

type WorkspaceDragGuide = {
  kind: 'equipment' | 'reagent';
  type?: string;
  name: string;
  inWorkspace: boolean;
  targetId: string | null;
  message?: string;
};

type HintTone = 'info' | 'success' | 'warning';

type ContainerHintCard = {
  targetId: string;
  title: string;
  detail: string;
  tone: HintTone;
};

type ReactionSpotlight = {
  id: string;
  title: string;
  detail: string;
  accent: string;
};

type MissionCompletionCard = {
  id: string;
  challengeId: string;
  title: string;
  product: string;
  formula: string;
  accent: string;
};

type MissionProofOption = {
  id: string;
  label: string;
  detail: string;
};

type MissionProofCheckpoint = {
  id: string;
  label: string;
  question: string;
  answerId: string;
  success: string;
  options: MissionProofOption[];
};

type MissionProof = {
  checkpoints: MissionProofCheckpoint[];
};

type FloatingAgentPosition = {
  x: number;
  y: number;
};

type MissionPreset = 'prepCu' | 'prepAg' | 'prepFe' | 'prepCo2' | 'prepIodine' | 'prepMn';

type MissionBrief = {
  title: string;
  family: string;
  signal: string;
  route: string[];
  branch: string;
  reagents: string[];
  accent: 'cyan' | 'rose' | 'emerald' | 'amber' | 'violet';
  preset: MissionPreset;
  challengeId: string;
  discoveryId: string;
  target: string;
};

type AgentDragState = {
  pointerId: number | null;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  dragging: boolean;
};

const LIQUID_CONTAINER_TYPES = new Set(['beaker', 'flask', 'testtube']);
const AGENT_ORB_WIDTH = 84;
const AGENT_ORB_HEIGHT = 84;
const AGENT_FLOATING_MARGIN = 14;
const AGENT_REQUEST_TIMEOUT_MS = 18000;
const PUBLIC_LAVOISIER_API_URL = 'https://chemlab-pro.onrender.com/api/lavoisier';
const PREP_CU_TARGET = '鉴定未知样品 A，制备蓝绿色 Cu(OH)₂ 沉淀';
const PREP_AG_TARGET = '鉴定未知样品 B，制备白色 AgCl 沉淀';
const PREP_FE_TARGET = '鉴定未知样品 C，制备血红色 Fe(SCN)₃ 络合物';
const PREP_CO2_TARGET = '鉴定未知样品 D，制备二氧化碳气泡';
const PREP_IODINE_TARGET = '鉴定未知样品 E，制备紫色有机层';
const PREP_MN_TARGET = '鉴定未知样品 F，制备高锰酸钾褪色体系';
const AGENT_SPECIES_LABELS: Record<string, string> = {
  HCl: '盐酸',
  H2SO4: '硫酸',
  HNO3: '硝酸',
  NaOH: '氢氧化钠',
  NH3H2O: '氨水',
  CuSO4: '硫酸铜',
  AgNO3: '硝酸银',
  FeCl3: '氯化铁',
  FeSO4: '硫酸亚铁',
  BaCl2: '氯化钡',
  Na2CO3: '碳酸钠',
  KSCN: '硫氰化钾',
  KMnO4: '高锰酸钾',
  H2O2: '双氧水',
  I2: '碘',
  I2_org: '有机相碘',
  CCl4: '四氯化碳',
  Hexane: '正己烷',
  Phenolphthalein: '酚酞',
  MethylOrange: '甲基橙',
  CuOH2: '氢氧化铜',
  'Cu(OH)2': '氢氧化铜',
  AgCl: '氯化银沉淀',
  BaSO4: '硫酸钡沉淀',
  'Fe(OH)3': '氢氧化铁沉淀',
  'Fe(OH)2': '氢氧化亚铁沉淀',
  'Fe(SCN)3': '硫氰合铁络合物',
  NaCl: '氯化钠',
  NaNO3: '硝酸钠',
  Na2SO4: '硫酸钠',
  CO2: '二氧化碳',
  O2: '氧气',
  Cl2: '氯气',
};
const MISSION_BRIEFS: Record<MissionPreset, MissionBrief> = {
  prepCu: {
    title: '未知 A：蓝色沉淀',
    family: '沉淀鉴定',
    signal: '蓝绿色絮状',
    route: ['样品 A', '加碱', '沉淀'],
    branch: '氨水会转深蓝',
    reagents: ['未知样品 A', '氢氧化钠', '氨水'],
    accent: 'cyan',
    preset: 'prepCu',
    challengeId: 'c1',
    discoveryId: 'cu-oh2',
    target: PREP_CU_TARGET,
  },
  prepAg: {
    title: '未知 B：白色沉淀',
    family: '沉淀鉴定',
    signal: '白色凝乳状',
    route: ['样品 B', '加氯离子', '沉淀'],
    branch: '氨水可做对照',
    reagents: ['未知样品 B', '盐酸', '氨水'],
    accent: 'emerald',
    preset: 'prepAg',
    challengeId: 'c2',
    discoveryId: 'agcl',
    target: PREP_AG_TARGET,
  },
  prepFe: {
    title: '未知 C：血红络合',
    family: '络合显色',
    signal: '瞬间血红',
    route: ['样品 C', 'SCN⁻', '显色'],
    branch: '加碱会变沉淀',
    reagents: ['未知样品 C', '硫氰化钾', '氢氧化钠'],
    accent: 'rose',
    preset: 'prepFe',
    challengeId: 'c3',
    discoveryId: 'fe-scn',
    target: PREP_FE_TARGET,
  },
  prepCo2: {
    title: '未知 D：气泡',
    family: '气体生成',
    signal: '连续气泡',
    route: ['样品 D', '加酸', '冒泡'],
    branch: '指示剂看酸化',
    reagents: ['未知样品 D', '盐酸', '甲基橙'],
    accent: 'amber',
    preset: 'prepCo2',
    challengeId: 'c4',
    discoveryId: 'co2',
    target: PREP_CO2_TARGET,
  },
  prepIodine: {
    title: '未知 E：紫色分层',
    family: '萃取分层',
    signal: '有机层变紫',
    route: ['样品 E', '有机相', '分层'],
    branch: '正己烷可对比',
    reagents: ['未知样品 E', '四氯化碳', '正己烷'],
    accent: 'violet',
    preset: 'prepIodine',
    challengeId: 'c5',
    discoveryId: 'iodine-layer',
    target: PREP_IODINE_TARGET,
  },
  prepMn: {
    title: '未知 F：褪色',
    family: '氧化还原',
    signal: '紫色褪去',
    route: ['样品 F', '还原剂', '酸化'],
    branch: '酸度决定速度',
    reagents: ['未知样品 F', '草酸', '硫酸'],
    accent: 'amber',
    preset: 'prepMn',
    challengeId: 'c6',
    discoveryId: 'permanganate-fade',
    target: PREP_MN_TARGET,
  },
};
const MISSION_SEQUENCE: MissionPreset[] = ['prepCu', 'prepAg', 'prepFe', 'prepCo2', 'prepIodine', 'prepMn'];
const DISCOVERY_STORAGE_KEY = 'chemlab:discovery-unlocks:v1';
const MISSION_COMPLETION_STORAGE_KEY = 'chemlab:mission-completions:v1';
const MISSION_SUCCESS_META: Record<string, { product: string; formula: string; accent: string }> = {
  c1: { product: '蓝绿色絮状沉淀', formula: 'Cu(OH)₂', accent: '#22d3ee' },
  c2: { product: '白色沉淀', formula: 'AgCl', accent: '#f8fafc' },
  c3: { product: '血红色络合物', formula: 'Fe(SCN)₃', accent: '#fb7185' },
  c4: { product: '无色气泡', formula: 'CO₂', accent: '#f59e0b' },
  c5: { product: '紫色有机层', formula: 'I₂(org)', accent: '#a855f7' },
  c6: { product: '紫色褪去', formula: 'Mn²⁺', accent: '#c4b5fd' },
};
const MISSION_PROOFS: Record<string, MissionProof> = {
  c1: {
    checkpoints: [
      {
        id: 'ion',
        label: '离子',
        question: '蓝绿色絮状沉淀锁定哪个阳离子？',
        answerId: 'cu2',
        success: 'Cu²⁺ 被锁定。',
        options: [
          { id: 'cu2', label: 'Cu²⁺', detail: '遇 OH⁻ 生成 Cu(OH)₂' },
          { id: 'ag', label: 'Ag⁺', detail: '更像白色 AgCl' },
          { id: 'co3', label: 'CO₃²⁻', detail: '遇酸会放 CO₂' },
        ],
      },
      {
        id: 'reagent-role',
        label: '作用',
        question: 'NaOH 在这一步提供了什么？',
        answerId: 'oh',
        success: 'OH⁻ 是沉淀剂。',
        options: [
          { id: 'oh', label: 'OH⁻', detail: '把 Cu²⁺ 拉成难溶沉淀' },
          { id: 'cl', label: 'Cl⁻', detail: '对应银盐检验' },
          { id: 'scn', label: 'SCN⁻', detail: '对应铁离子显色' },
        ],
      },
      {
        id: 'control',
        label: '对照',
        question: '若先加入过量氨水，更可能看到什么？',
        answerId: 'deep-blue',
        success: '深蓝色支持铜氨络合。',
        options: [
          { id: 'deep-blue', label: '深蓝溶液', detail: '铜氨络合物' },
          { id: 'white-clot', label: '白色凝乳', detail: 'AgCl 特征' },
          { id: 'purple-layer', label: '紫色分层', detail: '碘萃取特征' },
        ],
      },
    ],
  },
  c2: {
    checkpoints: [
      {
        id: 'product',
        label: '产物',
        question: '白色凝乳状沉淀最可能是什么？',
        answerId: 'agcl',
        success: 'AgCl 被锁定。',
        options: [
          { id: 'gas', label: 'CO₂↑', detail: '应表现为气泡' },
          { id: 'agcl', label: 'AgCl↓', detail: 'Ag⁺ + Cl⁻' },
          { id: 'feoh3', label: 'Fe(OH)₃↓', detail: '红褐色沉淀' },
        ],
      },
      {
        id: 'missing-ion',
        label: '变量',
        question: '若用硝酸代替盐酸，少了哪种关键离子？',
        answerId: 'chloride',
        success: 'Cl⁻ 是本关变量。',
        options: [
          { id: 'chloride', label: 'Cl⁻', detail: '决定 AgCl 沉淀' },
          { id: 'hydroxide', label: 'OH⁻', detail: '对应氢氧化物沉淀' },
          { id: 'carbonate', label: 'CO₃²⁻', detail: '对应冒泡' },
        ],
      },
      {
        id: 'principle',
        label: '本质',
        question: '这类现象属于哪种判断？',
        answerId: 'insoluble-salt',
        success: '难溶盐沉淀成立。',
        options: [
          { id: 'neutralization', label: '中和放热', detail: '主要看 pH 与温度' },
          { id: 'insoluble-salt', label: '难溶盐沉淀', detail: '离子结合后析出' },
          { id: 'extraction', label: '萃取分配', detail: '应出现两层' },
        ],
      },
    ],
  },
  c3: {
    checkpoints: [
      {
        id: 'phenomenon',
        label: '现象',
        question: '血红色来自哪类变化？',
        answerId: 'complex',
        success: '络合显色成立。',
        options: [
          { id: 'complex', label: '络合显色', detail: 'Fe³⁺ + SCN⁻' },
          { id: 'neutral', label: '酸碱中和', detail: '主要改变 pH' },
          { id: 'extract', label: '萃取分层', detail: '应有上下层' },
        ],
      },
      {
        id: 'iron-state',
        label: '价态',
        question: '本关主要检出的铁离子价态是？',
        answerId: 'fe3',
        success: 'Fe³⁺ 与 SCN⁻ 显血红。',
        options: [
          { id: 'fe2', label: 'Fe²⁺', detail: '常见浅绿色' },
          { id: 'fe3', label: 'Fe³⁺', detail: '与 SCN⁻ 血红' },
          { id: 'cu2', label: 'Cu²⁺', detail: '偏蓝色体系' },
        ],
      },
      {
        id: 'interference',
        label: '干扰',
        question: '若先加 NaOH，最可能干扰成什么？',
        answerId: 'feoh3',
        success: 'OH⁻ 会抢先沉淀 Fe³⁺。',
        options: [
          { id: 'feoh3', label: '红褐沉淀', detail: 'Fe(OH)₃' },
          { id: 'agcl', label: '白色沉淀', detail: 'AgCl 路线' },
          { id: 'co2', label: '无色气泡', detail: '碳酸盐路线' },
        ],
      },
    ],
  },
  c4: {
    checkpoints: [
      {
        id: 'sample',
        label: '样品',
        question: '连续气泡最能说明样品 D 含什么？',
        answerId: 'carbonate',
        success: '碳酸盐被锁定。',
        options: [
          { id: 'carbonate', label: 'CO₃²⁻', detail: '遇酸放 CO₂' },
          { id: 'cu2', label: 'Cu²⁺', detail: '遇碱沉淀' },
          { id: 'i2', label: 'I₂', detail: '有机相变紫' },
        ],
      },
      {
        id: 'acid-role',
        label: '试剂',
        question: '盐酸在这里的关键作用是？',
        answerId: 'h-plus',
        success: 'H⁺ 触发碳酸盐放气。',
        options: [
          { id: 'h-plus', label: '提供 H⁺', detail: '推动 CO₂ 生成' },
          { id: 'oh', label: '提供 OH⁻', detail: '会偏碱' },
          { id: 'organic', label: '形成有机层', detail: '不是气体路线' },
        ],
      },
      {
        id: 'gas-id',
        label: '气体',
        question: '这一步生成的无色气体应判断为？',
        answerId: 'co2',
        success: 'CO₂ 与碳酸盐证据吻合。',
        options: [
          { id: 'h2', label: 'H₂', detail: '通常金属+酸' },
          { id: 'co2', label: 'CO₂', detail: '碳酸盐+酸' },
          { id: 'cl2', label: 'Cl₂', detail: '黄绿色且有风险' },
        ],
      },
    ],
  },
  c5: {
    checkpoints: [
      {
        id: 'process',
        label: '过程',
        question: '紫色集中在有机层，说明发生了什么？',
        answerId: 'partition',
        success: '碘进入有机相。',
        options: [
          { id: 'precipitate', label: '沉淀', detail: '不会形成两层' },
          { id: 'partition', label: '分配/萃取', detail: 'I₂ 进入有机相' },
          { id: 'gas', label: '气体生成', detail: '不是分层现象' },
        ],
      },
      {
        id: 'layer',
        label: '层位',
        question: '使用 CCl₄ 时，紫色层通常在哪一侧？',
        answerId: 'bottom',
        success: 'CCl₄ 密度大，沉在下层。',
        options: [
          { id: 'top', label: '上层', detail: '更像正己烷' },
          { id: 'bottom', label: '下层', detail: 'CCl₄ 密度大于水' },
          { id: 'solid', label: '杯底固体', detail: '不是萃取层' },
        ],
      },
      {
        id: 'property',
        label: '性质',
        question: '这个现象主要利用碘的哪种性质？',
        answerId: 'nonpolar',
        success: '相似相溶解释分配。',
        options: [
          { id: 'nonpolar', label: '更亲非极性相', detail: '有机层显紫' },
          { id: 'strong-acid', label: '强酸性', detail: '不是本关核心' },
          { id: 'hydroxide', label: '提供 OH⁻', detail: '对应沉淀' },
        ],
      },
    ],
  },
  c6: {
    checkpoints: [
      {
        id: 'condition',
        label: '条件',
        question: '高锰酸钾褪色需要哪个条件？',
        answerId: 'acid-redox',
        success: '酸性还原条件成立。',
        options: [
          { id: 'base', label: '强碱环境', detail: '不符合本关路线' },
          { id: 'acid-redox', label: '酸性还原', detail: '草酸 + 硫酸' },
          { id: 'chloride', label: '氯离子沉淀', detail: '对应银盐' },
        ],
      },
      {
        id: 'oxidant',
        label: '角色',
        question: '紫色的 MnO₄⁻ 在反应中扮演什么角色？',
        answerId: 'oxidant',
        success: 'MnO₄⁻ 是氧化剂。',
        options: [
          { id: 'indicator', label: '酸碱指示剂', detail: '不是单纯变色剂' },
          { id: 'oxidant', label: '氧化剂', detail: '被还原后褪色' },
          { id: 'solvent', label: '有机溶剂', detail: '不是分层路线' },
        ],
      },
      {
        id: 'acid-choice',
        label: '选酸',
        question: '本关更适合用硫酸而不是盐酸，原因是？',
        answerId: 'avoid-cl2',
        success: '避免氯离子被氧化成 Cl₂。',
        options: [
          { id: 'avoid-cl2', label: '避免 Cl₂', detail: '盐酸可能被氧化' },
          { id: 'make-agcl', label: '生成 AgCl', detail: '没有银离子' },
          { id: 'extract-i2', label: '萃取碘', detail: '不是氧化还原主线' },
        ],
      },
    ],
  },
};

function getNextMissionPreset(challengeId: string) {
  const currentIndex = MISSION_SEQUENCE.findIndex(preset => MISSION_BRIEFS[preset].challengeId === challengeId);
  return MISSION_SEQUENCE[(currentIndex + 1 + MISSION_SEQUENCE.length) % MISSION_SEQUENCE.length];
}

function getMissionSuccessMeta(challengeId: string) {
  return MISSION_SUCCESS_META[challengeId] || { product: '目标现象', formula: '✓', accent: '#22d3ee' };
}

function readStoredDiscoveryIds() {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DISCOVERY_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((id): id is string => DISCOVERY_LIBRARY.some(discovery => discovery.id === id)));
  } catch {
    return new Set<string>();
  }
}

function writeStoredDiscoveryIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    void 0;
  }
}

function readStoredMissionCompletionIds() {
  if (typeof window === 'undefined') return new Set<string>();
  const validIds = new Set(Object.values(MISSION_BRIEFS).map(mission => mission.challengeId));
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MISSION_COMPLETION_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && validIds.has(id)));
  } catch {
    return new Set<string>();
  }
}

function writeStoredMissionCompletionIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MISSION_COMPLETION_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    void 0;
  }
}

type DiscoveryCardView = {
  id: string;
  title: string;
  formula: string;
  hint: string;
  accent: string;
  unlocked: boolean;
};

type DiscoveryDefinition = Omit<DiscoveryCardView, 'unlocked'> & {
  isUnlocked: (state: ChemState) => boolean;
};

function hasMole(state: ChemState, formula: string, threshold = 1e-7) {
  return (state.moles?.[formula] || 0) > threshold;
}

const DISCOVERY_LIBRARY: DiscoveryDefinition[] = [
  {
    id: 'cu-oh2',
    title: '蓝绿色絮状沉淀',
    formula: 'Cu(OH)₂',
    hint: '铜盐遇碱',
    accent: '#22d3ee',
    isUnlocked: (state) => hasMole(state, 'Cu(OH)2', 1e-6),
  },
  {
    id: 'agcl',
    title: '白色沉淀',
    formula: 'AgCl',
    hint: '银离子遇氯离子',
    accent: '#f8fafc',
    isUnlocked: (state) => hasMole(state, 'AgCl', 1e-6),
  },
  {
    id: 'fe-scn',
    title: '血红络合物',
    formula: 'Fe(SCN)₃',
    hint: '铁离子遇 SCN⁻',
    accent: '#fb7185',
    isUnlocked: (state) => hasMole(state, 'Fe(SCN)3', 1e-7),
  },
  {
    id: 'co2',
    title: '无色气泡',
    formula: 'CO₂',
    hint: '碳酸盐遇酸',
    accent: '#f59e0b',
    isUnlocked: (state) => hasMole(state, 'CO2', 1e-7),
  },
  {
    id: 'iodine-layer',
    title: '紫色有机层',
    formula: 'I₂(org)',
    hint: '碘进入有机相',
    accent: '#a855f7',
    isUnlocked: (state) => (state.organicVolume || 0) >= 1 && (hasMole(state, 'I2_org', 1e-7) || (state.organicColor || '').includes('128,0,128')),
  },
  {
    id: 'permanganate-fade',
    title: '紫色褪去',
    formula: 'Mn²⁺',
    hint: '酸性氧化还原',
    accent: '#c084fc',
    isUnlocked: (state) => hasMole(state, 'MnSO4', 1e-7) || hasMole(state, 'K2SO4', 1e-7),
  },
];

type PointerLike = {
  clientX?: number;
  clientY?: number;
  changedTouches?: ArrayLike<{ clientX: number; clientY: number }>;
  touches?: ArrayLike<{ clientX: number; clientY: number }>;
};

type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function createRuntimeId(prefix: string) {
  runtimeIdCounter += 1;
  return `${prefix}-${runtimeIdCounter}`;
}

function clampAgentPosition(position: FloatingAgentPosition, viewportWidth: number, viewportHeight: number): FloatingAgentPosition {
  return {
    x: Math.min(Math.max(0, position.x), Math.max(0, viewportWidth - AGENT_ORB_WIDTH)),
    y: Math.min(Math.max(AGENT_FLOATING_MARGIN, position.y), Math.max(AGENT_FLOATING_MARGIN, viewportHeight - AGENT_ORB_HEIGHT - AGENT_FLOATING_MARGIN)),
  };
}

function getDefaultAgentPosition(viewportWidth: number, viewportHeight: number): FloatingAgentPosition {
  const preferredBottom = viewportWidth >= 768 ? 86 : 76;
  const avoidRightPanel = viewportWidth >= 1180 ? 360 : 0;
  return clampAgentPosition({
    x: viewportWidth - AGENT_ORB_WIDTH - avoidRightPanel,
    y: viewportHeight - AGENT_ORB_HEIGHT - preferredBottom,
  }, viewportWidth, viewportHeight);
}

function getAgentIntentMeta(intent: AgentIntent) {
  switch (intent) {
    case 'titration':
      return {
        label: '滴定',
        badge: 'border-[#22d3ee]/25 bg-[#22d3ee]/10 text-[#67e8f9]',
        bubbleBorder: 'border-[#22d3ee]/24',
        suggestion: 'text-[#67e8f9]',
        orbGradient: 'from-[#22d3ee] via-[#38bdf8] to-[#0f172a]',
        orbGlow: '0 0 42px rgba(34,211,238,0.35)',
      };
    case 'precipitation':
      return {
        label: '沉淀',
        badge: 'border-[#10b981]/25 bg-[#10b981]/10 text-[#6ee7b7]',
        bubbleBorder: 'border-[#10b981]/24',
        suggestion: 'text-[#6ee7b7]',
        orbGradient: 'from-[#10b981] via-[#34d399] to-[#0f172a]',
        orbGlow: '0 0 42px rgba(16,185,129,0.34)',
      };
    case 'extraction':
      return {
        label: '萃取',
        badge: 'border-[#a855f7]/25 bg-[#a855f7]/10 text-[#d8b4fe]',
        bubbleBorder: 'border-[#a855f7]/24',
        suggestion: 'text-[#d8b4fe]',
        orbGradient: 'from-[#a855f7] via-[#8b5cf6] to-[#0f172a]',
        orbGlow: '0 0 42px rgba(168,85,247,0.34)',
      };
    case 'heating':
      return {
        label: '加热',
        badge: 'border-[#f97316]/25 bg-[#f97316]/10 text-[#fdba74]',
        bubbleBorder: 'border-[#f97316]/24',
        suggestion: 'text-[#fdba74]',
        orbGradient: 'from-[#fb7185] via-[#f97316] to-[#0f172a]',
        orbGlow: '0 0 42px rgba(249,115,22,0.34)',
      };
    case 'distillation':
      return {
        label: '蒸馏',
        badge: 'border-[#38bdf8]/25 bg-[#38bdf8]/10 text-[#bae6fd]',
        bubbleBorder: 'border-[#38bdf8]/24',
        suggestion: 'text-[#bae6fd]',
        orbGradient: 'from-[#38bdf8] via-[#818cf8] to-[#0f172a]',
        orbGlow: '0 0 42px rgba(56,189,248,0.34)',
      };
    case 'exploration':
    default:
      return {
        label: '探索',
        badge: 'border-white/12 bg-white/6 text-[#cbd5e1]',
        bubbleBorder: 'border-white/10',
        suggestion: 'text-[#e2e8f0]',
        orbGradient: 'from-[#6366f1] via-[#22d3ee] to-[#0f172a]',
        orbGlow: '0 0 42px rgba(99,102,241,0.28)',
      };
  }
}

function renderAgentIntentGlyph(intent: AgentIntent) {
  switch (intent) {
    case 'titration':
      return <PenTool size={16} />;
    case 'precipitation':
      return <Blend size={16} />;
    case 'extraction':
      return <Droplets size={16} />;
    case 'heating':
      return <Flame size={16} />;
    case 'distillation':
      return <TestTubes size={16} />;
    case 'exploration':
    default:
      return <Beaker size={16} />;
  }
}

function getMissionAccentClasses(accent: MissionBrief['accent']) {
  switch (accent) {
    case 'rose':
      return {
        ring: 'border-[#f43f5e]/26 hover:border-[#f43f5e]/45',
        dot: 'bg-[#f43f5e] shadow-[0_0_16px_rgba(244,63,94,0.6)]',
        button: 'border-[#f43f5e]/35 bg-[#f43f5e]/12 text-[#fecdd3] hover:bg-[#f43f5e]/20',
      };
    case 'emerald':
      return {
        ring: 'border-[#10b981]/26 hover:border-[#10b981]/45',
        dot: 'bg-[#10b981] shadow-[0_0_16px_rgba(16,185,129,0.6)]',
        button: 'border-[#10b981]/35 bg-[#10b981]/12 text-[#a7f3d0] hover:bg-[#10b981]/20',
      };
    case 'amber':
      return {
        ring: 'border-[#f59e0b]/26 hover:border-[#f59e0b]/45',
        dot: 'bg-[#f59e0b] shadow-[0_0_16px_rgba(245,158,11,0.6)]',
        button: 'border-[#f59e0b]/35 bg-[#f59e0b]/12 text-[#fde68a] hover:bg-[#f59e0b]/20',
      };
    case 'violet':
      return {
        ring: 'border-[#a855f7]/26 hover:border-[#a855f7]/45',
        dot: 'bg-[#a855f7] shadow-[0_0_16px_rgba(168,85,247,0.6)]',
        button: 'border-[#a855f7]/35 bg-[#a855f7]/12 text-[#e9d5ff] hover:bg-[#a855f7]/20',
      };
    case 'cyan':
    default:
      return {
        ring: 'border-[#22d3ee]/26 hover:border-[#22d3ee]/45',
        dot: 'bg-[#22d3ee] shadow-[0_0_16px_rgba(34,211,238,0.6)]',
        button: 'border-[#22d3ee]/35 bg-[#22d3ee]/12 text-[#a5f3fc] hover:bg-[#22d3ee]/20',
      };
  }
}

function getLiveDiscoveryIds(items: PlacedItem[]) {
  return new Set(DISCOVERY_LIBRARY
    .filter(discovery => items.some(item => LIQUID_CONTAINER_TYPES.has(item.type) && discovery.isUnlocked(item.chemState)))
    .map(discovery => discovery.id));
}

function buildDiscoveryCards(items: PlacedItem[], persistedIds: Set<string>): DiscoveryCardView[] {
  const liveIds = getLiveDiscoveryIds(items);
  return DISCOVERY_LIBRARY.map(discovery => ({
    ...discovery,
    unlocked: persistedIds.has(discovery.id) || liveIds.has(discovery.id),
  }));
}

function buildReactionSpotlight(reagentName: string, result: ReactionResult): ReactionSpotlight | null {
  if (result.reactionType === 'added') return null;
  const log = result.log || '';
  const title = log.split(/[，。；]/)[0] || `已加入 ${reagentName}`;
  const accent = result.reactionType.includes('gas')
    ? '#f59e0b'
    : result.reactionType.includes('complex')
    ? '#fb7185'
    : result.reactionType.includes('redox')
    ? '#a855f7'
    : result.reactionType.includes('precipitate')
    ? '#22d3ee'
    : '#10b981';
  const detail = result.equation || `继续观察颜色、沉淀、气泡或分层变化`;
  return {
    id: createRuntimeId('reaction-spotlight'),
    title,
    detail,
    accent,
  };
}

function DiscoveryAtlasModal({ cards, onClose }: { cards: DiscoveryCardView[]; onClose: () => void }) {
  const unlockedCount = cards.filter(card => card.unlocked).length;

  return (
    <motion.div
      className="fixed inset-0 z-[360] flex items-center justify-center px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/62 backdrop-blur-[10px]" />
      <motion.section
        data-panel="discovery-atlas"
        className="relative flex max-h-[min(720px,calc(100vh-48px))] w-full max-w-[760px] flex-col overflow-hidden rounded-[28px] border border-white/12 bg-[#080d18]/95 shadow-[0_34px_90px_rgba(2,6,23,0.66)]"
        initial={{ y: 20, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 14, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div>
            <div className="text-[18px] font-semibold text-white">反应图鉴</div>
            <div className="mt-0.5 text-[12px] text-[#64748b]">已发现 {unlockedCount}/{cards.length}</div>
          </div>
          <button
            type="button"
            aria-label="关闭反应图鉴"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#94a3b8] transition-colors hover:border-white/18 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(card => (
              <div
                key={card.id}
                className={`relative min-h-[136px] overflow-hidden rounded-[20px] border px-4 py-4 transition-all ${card.unlocked ? 'border-white/14 bg-white/[0.055]' : 'border-white/6 bg-black/14 opacity-60 grayscale'}`}
              >
                <div
                  className={`absolute inset-x-4 top-0 h-1 rounded-b-full ${card.unlocked ? 'opacity-100' : 'opacity-25'}`}
                  style={{ backgroundColor: card.accent, boxShadow: card.unlocked ? `0 0 20px ${card.accent}` : undefined }}
                />
                <div className="flex h-full flex-col justify-between gap-4">
                  <div>
                    <div className="text-[13px] font-semibold text-[#f8fafc]">{card.unlocked ? card.title : '待发现'}</div>
                    <div className="mt-2 font-mono text-[16px] font-semibold text-white">{card.unlocked ? card.formula : '???'}</div>
                  </div>
                  <div className="text-[12px] leading-relaxed text-[#94a3b8]">
                    {card.unlocked ? card.hint : '完成反应后自动解锁'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function summarizeAgentSpecies(chemState: ChemState): AgentSpeciesSummary[] {
  return Object.entries(chemState.moles || {})
    .filter(([, amount]) => Number.isFinite(amount) && Math.abs(amount) > 1e-7)
    .sort(([, amountA], [, amountB]) => Math.abs(amountB) - Math.abs(amountA))
    .slice(0, 10)
    .map(([formula, amount]) => ({
      formula,
      label: AGENT_SPECIES_LABELS[formula] || formula,
      amount: Number(amount.toPrecision(4)),
    }));
}

function extractLavoisierTextFromUnknown(payload: unknown): string {
  if (typeof payload === 'string') return payload.trim();
  if (!payload || typeof payload !== 'object') return '';

  const record = payload as Record<string, unknown>;
  const directFields = [record.reply, record.message, record.content, record.output_text];
  for (const field of directFields) {
    if (typeof field === 'string' && field.trim()) return field.trim();
  }

  const choices = Array.isArray(record.choices) ? record.choices : undefined;
  const choiceMessage = choices?.[0] as Record<string, unknown> | undefined;
  const nestedMessage = choiceMessage?.message as Record<string, unknown> | undefined;
  if (typeof nestedMessage?.content === 'string' && nestedMessage.content.trim()) {
    return nestedMessage.content.trim();
  }

  const output = Array.isArray(record.output) ? record.output : undefined;
  const outputText = output
    ?.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [] as unknown[];
      const content = (entry as Record<string, unknown>).content;
      return Array.isArray(content) ? content : [];
    })
    .map((part) => (part && typeof part === 'object' ? (part as Record<string, unknown>).text : undefined))
    .find((text): text is string => typeof text === 'string' && text.trim().length > 0);

  return outputText?.trim() || '';
}

function getLavoisierApiCandidates(primaryUrl: string) {
  const trimmedPrimary = primaryUrl.trim() || '/api/lavoisier';
  const candidates = [trimmedPrimary];

  if (typeof window !== 'undefined') {
    const isRelativeApi = trimmedPrimary.startsWith('/');
    const isProductionHost = window.location.hostname === 'chemlab-pro.onrender.com';
    if (isRelativeApi && !isProductionHost) {
      candidates.push(PUBLIC_LAVOISIER_API_URL);
    }
  }

  return Array.from(new Set(candidates));
}

function getPointerCoordinates(pointerLike?: PointerLike | null) {
  if (!pointerLike) return null;
  if (typeof pointerLike.clientX === 'number' && typeof pointerLike.clientY === 'number') {
    return { x: pointerLike.clientX, y: pointerLike.clientY };
  }
  if (pointerLike.changedTouches && pointerLike.changedTouches.length > 0) {
    return {
      x: pointerLike.changedTouches[0].clientX,
      y: pointerLike.changedTouches[0].clientY,
    };
  }
  if (pointerLike.touches && pointerLike.touches.length > 0) {
    return {
      x: pointerLike.touches[0].clientX,
      y: pointerLike.touches[0].clientY,
    };
  }
  return null;
}


function getPrecipitateSettlingProgress(item: PlacedItem) {
  if (!item.state?.includes('precipitate') || !item.lastReactionTime) return 0;
  const elapsed = Date.now() - item.lastReactionTime;
  return Math.max(0, Math.min(1, (elapsed - 2500) / 12500));
}

function getPickupTransferOptions(container: PlacedItem, pickupY: number): SplitChemStateOptions {
  const preferredPhase: SplitChemStateOptions['preferredPhase'] = pickupY > container.y ? 'bottom' : 'top';
  const hasDualLiquidPhases = (container.chemState.volume || 0) > 1e-6 && (container.chemState.organicVolume || 0) > 1e-6;

  if (!container.state?.includes('precipitate') || hasDualLiquidPhases) {
    return { preferredPhase };
  }

  const settlingProgress = getPrecipitateSettlingProgress(container);
  if (settlingProgress <= 0.02) {
    return { preferredPhase: 'aqueous', solidMode: 'follow', settlingProgress };
  }

  return {
    preferredPhase: 'aqueous',
    solidMode: pickupY > container.y ? 'sediment' : 'supernatant',
    settlingProgress,
  };
}

function getClosestFunnelTarget(items: PlacedItem[], x: number, y: number) {
  return items
    .filter(item => LIQUID_CONTAINER_TYPES.has(item.type) && Math.abs(item.x - x) < (item.type === 'testtube' ? 42 : 74) && item.y > y - 10 && item.y < y + 140)
    .sort((a, b) => {
      const distA = Math.hypot(a.x - x, a.y - y);
      const distB = Math.hypot(b.x - x, b.y - y);
      return distA - distB;
    })[0];
}

function getClosestPourTarget(items: PlacedItem[], source: PlacedItem) {
  return items
    .filter(item => item.id !== source.id && LIQUID_CONTAINER_TYPES.has(item.type) && Math.abs(item.x - source.x) < (item.type === 'testtube' ? 46 : 86) && item.y > source.y - 16 && item.y < source.y + 150)
    .sort((a, b) => {
      const distA = Math.hypot(a.x - source.x, a.y - source.y);
      const distB = Math.hypot(b.x - source.x, b.y - source.y);
      return distA - distB;
    })[0];
}

function getContainerDragGuide(items: PlacedItem[], source: PlacedItem) {
  const activeFunnel = items.find(item => item.type === 'funnel' && item.linkedTargetId && item.linkedTargetId !== source.id && Math.abs(item.x - source.x) < 75 && source.y < item.y + 42 && source.y > item.y - 120);
  if (activeFunnel) {
    const funnelTarget = items.find(item => item.id === activeFunnel.linkedTargetId);
    return {
      targetId: activeFunnel.id,
      message: funnelTarget ? `释放以过滤到：${funnelTarget.name}` : '释放以通过漏斗过滤',
    };
  }

  const directTarget = getClosestPourTarget(items, source);
  if (directTarget) {
    const options = getPourTransferOptions(source);
    const message = options.solidMode === 'supernatant'
      ? `释放以倾析上清液到：${directTarget.name}`
      : options.preferredPhase === 'top' && (source.chemState.organicVolume || 0) > 1e-6 && (source.chemState.volume || 0) > 1e-6
      ? `释放以转移上层液相到：${directTarget.name}`
      : `释放以倾倒到：${directTarget.name}`;
    return { targetId: directTarget.id, message };
  }

  return { targetId: null, message: '将容器拖到另一容器上方以倾倒，或拖到漏斗上方以过滤' };
}

function getPourTransferOptions(container: PlacedItem): SplitChemStateOptions {
  const hasDualLiquidPhases = (container.chemState.volume || 0) > 1e-6 && (container.chemState.organicVolume || 0) > 1e-6;
  const settlingProgress = getPrecipitateSettlingProgress(container);

  if (container.state?.includes('precipitate')) {
    return settlingProgress <= 0.02
      ? { preferredPhase: hasDualLiquidPhases ? 'top' : 'mixed', solidMode: 'follow', settlingProgress }
      : { preferredPhase: hasDualLiquidPhases ? 'top' : 'aqueous', solidMode: 'supernatant', settlingProgress };
  }

  return { preferredPhase: hasDualLiquidPhases ? 'top' : 'mixed' };
}

function getDropCoordinates(event: unknown, info?: DragInfoLike) {
  if (info?.point && typeof info.point.x === 'number' && typeof info.point.y === 'number') {
    return info.point;
  }

  if (!event || typeof event !== 'object') {
    return { x: 0, y: 0 };
  }

  const eventRecord = event as Record<string, unknown>;
  const detail = eventRecord.detail as { event?: PointerLike } | undefined;
  const nativeEvent = eventRecord.nativeEvent as PointerLike | undefined;
  const point = getPointerCoordinates(detail?.event ?? nativeEvent ?? (event as PointerLike));

  return point ?? { x: 0, y: 0 };
}

function getContainerCapacity(type: string) {
  switch (type) {
    case 'testtube':
      return 20;
    case 'burette':
      return 50;
    case 'pipette':
      return 10;
    case 'flask':
      return 500;
    case 'beaker':
    default:
      return 250;
  }
}

function canAcceptIncomingVolume(type: string, currentState: ChemState, incomingVolumeML: number) {
  if (incomingVolumeML <= 0) return true;
  return getTotalLiquidVolume(currentState) + incomingVolumeML <= getContainerCapacity(type) + 1e-6;
}

// let focusedItemId: string | null = null;
function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [activeRightPanelTab, setActiveRightPanelTab] = useState<'reagents' | 'logs'>('reagents');
  const [dragGuide, setDragGuide] = useState<WorkspaceDragGuide | null>(null);
  
  // Drag and Drop state
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const placedItemsRef = useRef<PlacedItem[]>([]);
  
  const [brokenGlass, setBrokenGlass] = useState<BrokenGlassPiece[]>([]);
  
  // History for Undo (Time Travel)
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [temperatureHistory, setTemperatureHistory] = useState<{ time: number, temp: number }[]>([]);
  const [isThermoChartOpen, setIsThermoChartOpen] = useState(false);
  const [renderNow, setRenderNow] = useState<number>(0);
  const hasTimedVisualEffects = placedItems.some(item => {
    if (!item.state || !item.lastReactionTime) return false;
    return item.state.includes('precipitate') || item.state === 'neutralize' || item.state === 'redox_silver_mirror' || item.state === 'complex_cu_nh3';
  });

  const syncReadouts = useCallback((chemState?: ChemState | null) => {
    const detail = chemState
      ? { temp: chemState.temperature, ph: calculatePH(chemState) }
      : { temp: ROOM_TEMPERATURE, ph: 7.0 };
    const customEvent = new CustomEvent('tempSync', { detail });
    window.dispatchEvent(customEvent);
  }, []);

  const saveSnapshot = (
    itemsSnapshot: PlacedItem[] = placedItems,
    brokenGlassSnapshot: BrokenGlassPiece[] = brokenGlass,
    focusedSnapshot: string | null = focusedItemIdRef.current,
    temperatureHistorySnapshot: { time: number; temp: number }[] = temperatureHistory,
  ) => {
    setHistory(prev => {
      const newHistory = [...prev, {
        placedItems: JSON.parse(JSON.stringify(itemsSnapshot)),
        brokenGlass: JSON.parse(JSON.stringify(brokenGlassSnapshot)),
        focusedItemId: focusedSnapshot,
        temperatureHistory: JSON.parse(JSON.stringify(temperatureHistorySnapshot)),
      }];
      // keep last 20 states
      return newHistory.slice(-20);
    });
  };

  const undo = () => {
    if (history.length === 0) {
       showToast("🚫 没有可以撤销的操作");
       return;
    }
    const previousState = history[history.length - 1];
    setPlacedItems(previousState.placedItems);
    setBrokenGlass(previousState.brokenGlass);
    setFocusedItemId(previousState.focusedItemId);
    setTemperatureHistory(previousState.temperatureHistory);
    setHistory(prev => prev.slice(0, prev.length - 1));
    const focusedItem = previousState.placedItems.find(i => i.id === previousState.focusedItemId);
    syncReadouts(focusedItem?.chemState);
    playSound('pour');
    showToast("⏪ 时间回溯完成");
  };

  // Volume slider popover state
  const [activeDrop, setActiveDrop] = useState<{targetId: string, reagentName: string, x: number, y: number, maxAdd: number} | null>(null);
  const [dropVolume, setDropVolume] = useState<number>(50);

  // Holographic Equations state
  const [equations, setEquations] = useState<{id: string, text: string, x: number, y: number}[]>([]);
  const [reactionSpotlight, setReactionSpotlight] = useState<ReactionSpotlight | null>(null);
  const [missionCompletionCard, setMissionCompletionCard] = useState<MissionCompletionCard | null>(null);
  const [rightPanelPulse, setRightPanelPulse] = useState<'reagents' | 'logs' | null>(null);
  const [reagentFocusSignal, setReagentFocusSignal] = useState(0);
  const [unlockedDiscoveryIds, setUnlockedDiscoveryIds] = useState<Set<string>>(() => readStoredDiscoveryIds());
  const [completedMissionIds, setCompletedMissionIds] = useState<Set<string>>(() => readStoredMissionCompletionIds());
  const [missionProofAnswers, setMissionProofAnswers] = useState<Record<string, Record<string, { selectedId: string; correct: boolean }>>>({});
  
  // Custom Toast State
  const [toast, setToast] = useState<{id: string, message: string} | null>(null);
  const [discoveryToast, setDiscoveryToast] = useState<DiscoveryCardView | null>(null);
  const [atlasOpen, setAtlasOpen] = useState(false);

  const showToast = useCallback((message: string) => {
    const id = createRuntimeId('toast');
    setToast({ id, message });
    setTimeout(() => {
      setToast(current => current?.id === id ? null : current);
    }, 3000);
  }, [setToast]);

  // Play Mode State
  const [gameMode, setGameMode] = useState<'sandbox' | 'challenge'>('sandbox');
  const [activeChallenge, setActiveChallenge] = useState<{id: string, title: string, target: string, completed: boolean, targetId?: string} | null>(null);

  // Focused item for dashboard readouts
  // const [focusedItemId, setFocusedItemId] = useState<string | null>(null); // MOVED UP
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [inlineContainerFeedback, setInlineContainerFeedback] = useState<ContainerHintCard | null>(null);
  const [agentExpanded, setAgentExpanded] = useState(false);
  const [agentOrbPulse, setAgentOrbPulse] = useState(false);
  const [agentIsDragging, setAgentIsDragging] = useState(false);
  const [agentHasFreshUpdate, setAgentHasFreshUpdate] = useState(false);
  const [agentDraft, setAgentDraft] = useState('');
  const [agentIsLoading, setAgentIsLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentStatusLabel, setAgentStatusLabel] = useState('在线');
  const [agentRemoteHeadline, setAgentRemoteHeadline] = useState('');
  const [agentRemoteSummary, setAgentRemoteSummary] = useState('');
  const [agentSuggestedPrompts, setAgentSuggestedPrompts] = useState<string[]>(['下一步', '解释现象', '我做对了吗']);
  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([]);
  const [agentLastEvent, setAgentLastEvent] = useState<AgentLastEvent | undefined>(undefined);
  const [agentViewport, setAgentViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
  }));
  const [agentPosition, setAgentPosition] = useState<FloatingAgentPosition>(() => {
    const width = typeof window === 'undefined' ? 1440 : window.innerWidth;
    const height = typeof window === 'undefined' ? 900 : window.innerHeight;
    return getDefaultAgentPosition(width, height);
  });

  // Audio nodes cache for continuous sounds
  const audioContextRef = useRef<AudioContext | null>(null);
  const continuousAudioRef = useRef<{[id: string]: {oscillator: OscillatorNode, gainNode: GainNode, mod: OscillatorNode}}>({});
  const focusedItemIdRef = useRef<string | null>(focusedItemId);
  const lastThermoSampleRef = useRef<{ time: number; temp: number } | null>(null);
  const pendingChallengeCompletionRef = useRef<string | null>(null);
  const lastAgentNoteRef = useRef<{ at: number; message: string } | null>(null);
  const lastAgentDigestRef = useRef<string>('');
  const lastAgentConversationDigestRef = useRef<string>('');
  const lastUnlockedDiscoveryIdsRef = useRef<Set<string>>(new Set(unlockedDiscoveryIds));
  const agentAbortControllerRef = useRef<AbortController | null>(null);
  const agentShellRef = useRef<HTMLDivElement | null>(null);
  const agentDockButtonRef = useRef<HTMLButtonElement | null>(null);
  const agentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const agentMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const inlineContainerFeedbackTimeoutRef = useRef<number | null>(null);
  const agentDragStateRef = useRef<AgentDragState>({ pointerId: null, startX: 0, startY: 0, originX: 0, originY: 0, dragging: false });
  const handleDragEndRef = useRef(handleDragEnd);
  const emitReactionOutcomeRef = useRef(emitReactionOutcome);

  const handleExportData = () => {
     const csvContent = "data:text/csv;charset=utf-8," 
         + "Time(ms),Temperature(C)\n"
         + temperatureHistory.map(e => `${e.time},${e.temp.toFixed(2)}`).join("\n");
    
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", `${createRuntimeId('chemlab-thermo-log')}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     showToast("✅ 热力学数据导出成功");
  };

  const showInlineContainerHint = useCallback((hint: ContainerHintCard, duration = 2400) => {
    setInlineContainerFeedback(hint);
    if (inlineContainerFeedbackTimeoutRef.current) {
      window.clearTimeout(inlineContainerFeedbackTimeoutRef.current);
    }
    inlineContainerFeedbackTimeoutRef.current = window.setTimeout(() => {
      setInlineContainerFeedback(current => current?.targetId === hint.targetId ? null : current);
      inlineContainerFeedbackTimeoutRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (inlineContainerFeedbackTimeoutRef.current) {
        window.clearTimeout(inlineContainerFeedbackTimeoutRef.current);
      }
    };
  }, []);

  function handleDragEnd(_event: unknown, info: DragInfoLike | undefined, itemType: string, itemName: string) {
    if (!workspaceRef.current) {
      showToast('⚠️ 实验台尚未准备完成，请稍后再试');
      return;
    }
    const newItemId = itemType === 'reagent' ? null : createRuntimeId(itemType);

    const workspaceRect = workspaceRef.current.getBoundingClientRect();
    const { x: dropX, y: dropY } = getDropCoordinates(_event, info);

    if (
      dropX >= workspaceRect.left &&
      dropX <= workspaceRect.right &&
      dropY >= workspaceRect.top &&
      dropY <= workspaceRect.bottom
    ) {
      const relativeX = dropX - workspaceRect.left;
      const relativeY = dropY - workspaceRect.top;

      setPlacedItems(currentItems => {
        const rackCollision = currentItems.find(item => {
          if (item.type !== 'testtubes') return false;
          const dx = item.x - relativeX;
          const dy = item.y - relativeY;
          return Math.sqrt(dx * dx + dy * dy) < 100;
        });

        if (itemType === 'testtube' && rackCollision) {
          const slotIndex = Math.max(0, Math.min(5, Math.floor((relativeX - rackCollision.x + 90) / (180 / 6))));
          const slotXOffset = (slotIndex - 2.5) * (180 / 6);
          const finalX = rackCollision.x + slotXOffset;
          const finalY = rackCollision.y - 20;

          saveSnapshot(currentItems, brokenGlass);
          playSound('place');
          return [
            ...currentItems,
            {
              id: newItemId!,
              name: itemName,
              type: itemType,
              x: finalX,
              y: finalY,
              chemState: createEmptyState(),
              isOn: false,
              rackId: rackCollision.id,
              rackSlot: slotIndex
            }
          ];
        }

        const collisionItem = currentItems.find(item => {
          if (item.type !== 'beaker' && item.type !== 'flask' && item.type !== 'burette' && item.type !== 'testtube') return false;

          const dx = item.x - relativeX;
          const dy = item.y - relativeY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          return distance < (item.type === 'testtube' ? 40 : 90);
        });

        if (itemType === 'reagent') {
          if (collisionItem) {
            const currentVol = getTotalLiquidVolume(collisionItem.chemState);
            const absoluteMax = getContainerCapacity(collisionItem.type);
            if (currentVol >= absoluteMax) {
              showToast(`🚫 该容器容量已满 (${absoluteMax}mL)，无法再加入试剂`);
              return currentItems;
            }
            const maxAdd = absoluteMax - currentVol;
            const initAdd = Math.min(collisionItem.type === 'testtube' ? 5 : 50, maxAdd);

            setActiveDrop({
              targetId: collisionItem.id,
              reagentName: itemName,
              x: collisionItem.x,
              y: collisionItem.y,
              maxAdd
            });
            setDropVolume(initAdd);

            return currentItems;
          }

          showToast('🧪 请将试剂拖到烧杯、锥形瓶、试管或滴定管上');
          return currentItems;
        }

        saveSnapshot(currentItems, brokenGlass);
        playSound('place');

        const funnelTarget = itemType === 'funnel' ? getClosestFunnelTarget(currentItems, relativeX, relativeY) : undefined;

        return [
          ...currentItems,
          {
            id: newItemId!,
            name: itemName,
            type: itemType,
            x: funnelTarget ? funnelTarget.x : relativeX,
            y: funnelTarget ? funnelTarget.y - (funnelTarget.type === 'testtube' ? 84 : 102) : relativeY,
            chemState: createEmptyState(),
            isOn: false,
            linkedTargetId: funnelTarget?.id,
          }
        ];
      });

      if (newItemId && (itemType === 'beaker' || itemType === 'flask' || itemType === 'testtube')) {
        setFocusedItemId(newItemId);
        syncReadouts(createEmptyState());
      }
      return;
    }

    showToast(itemType === 'reagent' ? '🧪 拖入容器' : '📍 拖到实验台');
  }

  useEffect(() => {
    placedItemsRef.current = placedItems;
  }, [placedItems]);

  useEffect(() => {
    focusedItemIdRef.current = focusedItemId;
    lastThermoSampleRef.current = null;
  }, [focusedItemId]);

  useEffect(() => {
    if (!hasTimedVisualEffects) {
      return;
    }

    const updateRenderNow = () => setRenderNow(Date.now());
    updateRenderNow();
    const timer = window.setInterval(updateRenderNow, 200);
    return () => window.clearInterval(timer);
  }, [hasTimedVisualEffects]);

  useEffect(() => {
    if (!activeChallenge || activeChallenge.completed) {
      pendingChallengeCompletionRef.current = null;
    }
  }, [activeChallenge]);

  useEffect(() => {
    const syncAgentViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setAgentViewport({ width, height });
      setAgentPosition(current => clampAgentPosition(current, width, height));
    };

    syncAgentViewport();
    window.addEventListener('resize', syncAgentViewport);
    return () => window.removeEventListener('resize', syncAgentViewport);
  }, []);

  useEffect(() => {
    const handleTempSync = (event: Event) => {
      if (!focusedItemIdRef.current) return;

      const customEvent = event as CustomEvent<{ temp?: number }>;
      const nextTemp = customEvent.detail?.temp;
      if (typeof nextTemp !== 'number') return;

      const now = Date.now();
      const lastSample = lastThermoSampleRef.current;
      if (lastSample && now - lastSample.time < 150 && Math.abs(lastSample.temp - nextTemp) < 0.05) {
        return;
      }

      const sample = { time: now, temp: nextTemp };
      lastThermoSampleRef.current = sample;
      setTemperatureHistory(prev => [...prev, sample].slice(-100));
    };

    window.addEventListener('tempSync', handleTempSync);
    return () => window.removeEventListener('tempSync', handleTempSync);
  }, []);

  // Function to clear all items from the workspace
  const clearWorkspace = () => {
    if (placedItems.length > 0 || brokenGlass.length > 0) {
      saveSnapshot();
      playSound('pour'); // Simple sound for clearing
      
      // Stop all continuous sounds
      Object.keys(continuousAudioRef.current).forEach(id => stopSound(id));

      setPlacedItems([]);
      placedItemsRef.current = [];
      setBrokenGlass([]);
      if (gameMode === 'challenge') {
        setActiveChallenge(null);
      }
      setMissionCompletionCard(null);
      setReactionSpotlight(null);
      setDiscoveryToast(null);
      setFocusedItemId(null); // Clear focus
      setTemperatureHistory([]);
      setEquations([]);
      setActiveDrop(null);
      setInlineContainerFeedback(null);
      setAgentMessages([]);
      setAgentRemoteHeadline('');
      setAgentRemoteSummary('');
      setAgentSuggestedPrompts([]);
      setAgentHasFreshUpdate(false);
      syncReadouts(null);
      
      // Dispatch an event to clear logs if needed or just log the cleanup
      const logEvent = new CustomEvent('reagentDrop', {
        detail: { name: '清理台面', reacted: '重置所有器材与试剂', isDrop: false }
      });
      window.dispatchEvent(logEvent);
    }
  };

  const launchQuickStart = (preset: MissionPreset) => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 900;
    const height = rect?.height ?? 620;
    const centerX = width / 2;
    const centerY = height / 2;

    const createWorkspaceItem = (
      type: PlacedItem['type'],
      name: string,
      x: number,
      y: number,
      extra: Partial<PlacedItem> = {}
    ): PlacedItem => ({
      id: createRuntimeId(type),
      name,
      type,
      x,
      y,
      chemState: createEmptyState(),
      isOn: false,
      ...extra,
    });

    let nextItems: PlacedItem[] = [];
    let nextFocusedId: string | null = null;
    const mission = MISSION_BRIEFS[preset];
    const beaker = createWorkspaceItem('beaker', '烧杯', centerX, centerY + 82);
    nextItems = [beaker];
    nextFocusedId = beaker.id;
    setGameMode('challenge');
    setMissionCompletionCard(null);
    setReactionSpotlight(null);
    setDiscoveryToast(null);
    setMissionProofAnswers(prev => {
      if (!prev[mission.challengeId]) return prev;
      const next = { ...prev };
      delete next[mission.challengeId];
      return next;
    });
    setActiveChallenge({
      id: mission.challengeId,
      title: mission.title,
      target: mission.target,
      completed: false
    });

    if (placedItems.length > 0 || brokenGlass.length > 0) {
      saveSnapshot();
      Object.keys(continuousAudioRef.current).forEach(id => stopSound(id));
    }

    setAgentMessages([]);
    setAgentRemoteHeadline('');
    setAgentRemoteSummary('');
    setAgentSuggestedPrompts([]);
    setAgentHasFreshUpdate(false);
    setAgentExpanded(false);
    setPlacedItems(nextItems);
    placedItemsRef.current = nextItems;
    setBrokenGlass([]);
    setFocusedItemId(nextFocusedId);
    setTemperatureHistory([]);
    setEquations([]);
    setActiveDrop(null);
    syncReadouts(nextItems.find(item => item.id === nextFocusedId)?.chemState);
    playSound('place');
  };

  const openChallengeMode = () => {
    if (gameMode === 'challenge' && (placedItems.length === 0 || activeChallenge)) {
      setGameMode('challenge');
      return;
    }

    if (placedItems.length > 0 || brokenGlass.length > 0) {
      saveSnapshot();
      Object.keys(continuousAudioRef.current).forEach(id => stopSound(id));
    }

    setPlacedItems([]);
    placedItemsRef.current = [];
    setBrokenGlass([]);
    setFocusedItemId(null);
    setTemperatureHistory([]);
    setEquations([]);
    setActiveDrop(null);
    setMissionCompletionCard(null);
    setReactionSpotlight(null);
    setDiscoveryToast(null);
    setActiveChallenge(null);
    setAgentMessages([]);
    setAgentRemoteHeadline('');
    setAgentRemoteSummary('');
    setAgentSuggestedPrompts([]);
    setAgentHasFreshUpdate(false);
    setAgentExpanded(false);
    syncReadouts(null);
    setGameMode('challenge');
  };

  const playSound = useCallback((type: 'place' | 'pour' | 'reaction' | 'break' | 'boil', _durationParam?: number, itemId?: string) => {
    try {
      const AudioContextClass = window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') {
        void audioCtx.resume().catch(() => {
          void 0;
        });
      }

      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      let cleanupNodes: AudioNode[] = [oscillator, gainNode];
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.onended = () => {
        cleanupNodes.forEach(node => {
          try {
            node.disconnect();
          } catch {
            void 0;
          }
        });
      };
      
      const now = audioCtx.currentTime;
      
      if (type === 'place') {
        // Deep "thud" for placing equipment (glass on desk)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(150, now);
        oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
        
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(10);
      } else if (type === 'pour') {
        // Higher pitched liquid sound
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(600, now);
        oscillator.frequency.linearRampToValueAtTime(800, now + 0.3);
        
        // Volume shaping (liquid flowing)
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
        
        // Add some noise/modulations for liquid texture
        const lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 15;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 50;
        cleanupNodes = [...cleanupNodes, lfo, lfoGain];
        lfo.connect(lfoGain);
        lfoGain.connect(oscillator.frequency);
        lfo.start(now);
        lfo.stop(now + 0.3);
        
        oscillator.start(now);
        oscillator.stop(now + 0.3);
        
        if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
      } else if (type === 'reaction') {
        // Hissing/bubbling sound for chemical reaction
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(200, now);
        oscillator.frequency.linearRampToValueAtTime(150, now + 1.0);
        
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
        
        // Rapid modulation for bubbling
        const bubbleMod = audioCtx.createOscillator();
        bubbleMod.type = 'sawtooth';
        bubbleMod.frequency.value = 8;
        const bubbleGain = audioCtx.createGain();
        bubbleGain.gain.value = 100;
        cleanupNodes = [...cleanupNodes, bubbleMod, bubbleGain];
        bubbleMod.connect(bubbleGain);
        bubbleGain.connect(oscillator.frequency);
        bubbleMod.start(now);
        bubbleMod.stop(now + 1.0);
        
        oscillator.start(now);
        oscillator.stop(now + 1.0);
        
        if (navigator.vibrate) navigator.vibrate([20, 20, 20, 20, 20]);
      } else if (type === 'boil' && itemId) {
        // Only start if not already boiling for this item
        if (continuousAudioRef.current[itemId]) return;
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(100, now);
        gainNode.gain.setValueAtTime(0.05, now); // Low volume boiling rumble
        
        const bubbleMod = audioCtx.createOscillator();
        bubbleMod.type = 'sine';
        bubbleMod.frequency.value = 4 + (((itemId?.length || 1) % 3) * 0.75);
        const bubbleGain = audioCtx.createGain();
        bubbleGain.gain.value = 50;
        bubbleMod.connect(bubbleGain);
        bubbleGain.connect(oscillator.frequency);
        
        bubbleMod.start(now);
        oscillator.start(now);
        
        continuousAudioRef.current[itemId] = { oscillator, gainNode, mod: bubbleMod };
      } else if (type === 'break') {
        // If it breaks, stop any boiling sound it might have had
        if (itemId && continuousAudioRef.current[itemId]) {
          const { oscillator, mod } = continuousAudioRef.current[itemId];
          try { oscillator.stop(); mod.stop(); } catch { void 0; }
          delete continuousAudioRef.current[itemId];
        }
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(1000, now);
        oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.5);
        gainNode.gain.setValueAtTime(0.8, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      }
    } catch {
      void 0;
    }
  }, []);

  const stopSound = useCallback((itemId: string) => {
    if (continuousAudioRef.current[itemId]) {
      const { oscillator, mod, gainNode } = continuousAudioRef.current[itemId];
      try { 
        // Fade out slightly to avoid popping
        const audioCtx = oscillator.context;
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.stop(audioCtx.currentTime + 0.1); 
        mod.stop(audioCtx.currentTime + 0.1); 
      } catch { void 0; }
      delete continuousAudioRef.current[itemId];
    }
  }, []);

  useEffect(() => {
    const activeContinuousAudio = continuousAudioRef.current;
    return () => {
      Object.keys(activeContinuousAudio).forEach(id => stopSound(id));
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => {
          void 0;
        });
        audioContextRef.current = null;
      }
    };
  }, [stopSound]);

  function recordDiscoveryUnlocks(chemState: ChemState) {
    const unlockedIds = DISCOVERY_LIBRARY
      .filter(discovery => discovery.isUnlocked(chemState))
      .map(discovery => discovery.id);
    if (unlockedIds.length === 0) return;

    setUnlockedDiscoveryIds(previousIds => {
      let changed = false;
      const nextIds = new Set(previousIds);
      unlockedIds.forEach(id => {
        if (!nextIds.has(id)) {
          nextIds.add(id);
          changed = true;
        }
      });
      if (!changed) return previousIds;
      writeStoredDiscoveryIds(nextIds);
      return nextIds;
    });
  }

  function emitReactionOutcome(reagentName: string, result: ReactionResult) {
    if (
      result.reactionType.includes('precipitate')
      || result.reactionType.includes('gas')
      || result.reactionType.includes('complex')
      || result.reactionType.includes('redox')
      || result.reactionType === 'neutralize'
    ) {
      playSound('reaction');
    } else {
      playSound('pour');
    }

    const equationText = result.equation;
    if (equationText) {
      const eqId = createRuntimeId('equation');
      setEquations(prev => [...prev, {
        id: eqId,
        text: equationText,
        x: window.innerWidth / 2,
        y: 120
      }]);
      setTimeout(() => {
        setEquations(prev => prev.filter(e => e.id !== eqId));
      }, 4500);
    }

    const spotlight = buildReactionSpotlight(reagentName, result);
    if (spotlight) {
      setReactionSpotlight(spotlight);
      window.setTimeout(() => {
        setReactionSpotlight(current => current?.id === spotlight.id ? null : current);
      }, 2600);
    }
    recordDiscoveryUnlocks(result.newState);

    const customEvent = new CustomEvent('reagentDrop', {
      detail: {
        name: reagentName,
        reacted: result.reactionType !== 'added' ? result.log : '',
        isDrop: false,
        ph: calculatePH(result.newState),
        temp: result.newState.temperature
      }
    });
    window.dispatchEvent(customEvent);
  }

  useEffect(() => {
    handleDragEndRef.current = handleDragEnd;
    emitReactionOutcomeRef.current = emitReactionOutcome;
  });

  // Screen resize handler
  useEffect(() => {
    const handleResize = () => {
      setIsTablet(window.innerWidth < 1180);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const handleReagentDrop = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { event: dragEvent, info, type, name, reacted } = customEvent.detail;
      if (reacted !== undefined) return;
      handleDragEndRef.current(dragEvent, info, type, name);
    };
    window.addEventListener('reagentDrop', handleReagentDrop);

    const handleWorkspaceDragState = (event: Event) => {
      const customEvent = event as CustomEvent<{ active?: boolean; kind?: 'equipment' | 'reagent'; type?: string; name?: string; point?: { x: number; y: number } }>;
      const isActive = customEvent.detail?.active;
      if (!isActive) {
        setDragGuide(null);
        return;
      }

      const rect = workspaceRef.current?.getBoundingClientRect();
      const point = customEvent.detail?.point;
      const kind = customEvent.detail?.kind;
      const type = customEvent.detail?.type;
      const name = customEvent.detail?.name;

      if (!rect || !point || !kind || !name) {
        return;
      }

      const inWorkspace = point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
      let targetId: string | null = null;
      let message: string | undefined;

      if (inWorkspace && kind === 'reagent') {
        const relativeX = point.x - rect.left;
        const relativeY = point.y - rect.top;
        const target = placedItemsRef.current.find(item => {
          if (item.type !== 'beaker' && item.type !== 'flask' && item.type !== 'burette' && item.type !== 'testtube') return false;
          const dx = item.x - relativeX;
          const dy = item.y - relativeY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          return distance < (item.type === 'testtube' ? 42 : 92);
        });
        targetId = target?.id || null;
        message = target ? `释放以加入容器：${target.name}` : '将试剂拖到烧杯、锥形瓶、试管或滴定管上';
      }

      if (inWorkspace && kind === 'equipment' && type === 'funnel') {
        const relativeX = point.x - rect.left;
        const relativeY = point.y - rect.top;
        const target = getClosestFunnelTarget(placedItemsRef.current, relativeX, relativeY);
        targetId = target?.id || null;
        message = target ? `释放以将漏斗挂载到：${target.name}` : '将漏斗拖到烧杯、锥形瓶或试管上方';
      }

      setDragGuide({ kind, type, name, inWorkspace, targetId, message });
    };
    window.addEventListener('workspaceDragState', handleWorkspaceDragState);

    const handleBuretteDrip = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { targetId, reagentName, amount, sourceId, transferState } = customEvent.detail;

      setPlacedItems(currentItems => {
        const targetItem = currentItems.find(i => i.id === targetId);
        if (!targetItem) return currentItems;

        if (transferState) {
          const incomingVolume = getTotalLiquidVolume(transferState);
          if (!canAcceptIncomingVolume(targetItem.type, targetItem.chemState, incomingVolume)) {
            showToast(`🚫 ${targetItem.name} 容量不足，无法继续转移 ${incomingVolume.toFixed(1)}mL`);
            return currentItems;
          }

          const previousState = targetItem.chemState;
          const transferResult = mergeChemStates(targetItem.chemState, transferState, reagentName);
          if (focusedItemIdRef.current === targetId) {
            syncReadouts(transferResult.newState);
          }

          setTimeout(() => {
            emitReactionOutcomeRef.current(reagentName, transferResult);
            const hint = computeReactionHint(targetItem, reagentName, previousState, transferResult);
            showInlineContainerHint({ ...hint, targetId });
          }, 0);

          return currentItems.map(item => {
            if (item.id === targetId) {
              return {
                ...item,
                chemState: transferResult.newState,
                state: transferResult.reactionType,
                lastReactionTime: transferResult.reactionType !== 'added' ? Date.now() : item.lastReactionTime,
              };
            }
            return item;
          });
        }

        if (sourceId) {
          const sourceItem = currentItems.find(i => i.id === sourceId);
          if (!sourceItem || sourceItem.id === targetItem.id) return currentItems;

          const { extractedState, remainingState, transferredVolume } = splitChemState(sourceItem.chemState, amount, {
            preferredPhase: sourceItem.type === 'burette' ? 'bottom' : 'mixed',
          });
          if (transferredVolume <= 0) return currentItems;
          if (!canAcceptIncomingVolume(targetItem.type, targetItem.chemState, transferredVolume)) {
            showToast(`🚫 ${targetItem.name} 容量不足，无法完成 ${transferredVolume.toFixed(1)}mL 转移`);
            return currentItems;
          }

          const previousState = targetItem.chemState;
          const transferResult = mergeChemStates(targetItem.chemState, extractedState, reagentName || sourceItem.name);

          if (focusedItemIdRef.current === targetId) {
            syncReadouts(transferResult.newState);
          } else if (focusedItemIdRef.current === sourceId) {
            syncReadouts(remainingState);
          }

          setTimeout(() => {
            emitReactionOutcomeRef.current(reagentName || sourceItem.name, transferResult);
            const hint = computeReactionHint(targetItem, reagentName || sourceItem.name, previousState, transferResult);
            showInlineContainerHint({ ...hint, targetId });
          }, 0);

          return currentItems.map(item => {
            if (item.id === targetId) {
              return {
                ...item,
                chemState: transferResult.newState,
                state: transferResult.reactionType,
                lastReactionTime: transferResult.reactionType !== 'added' ? Date.now() : item.lastReactionTime,
              };
            }

            if (item.id === sourceId) {
              return {
                ...item,
                chemState: remainingState,
                isOn: item.type === 'burette' ? getTotalLiquidVolume(remainingState) > 0 && (item.isOn || false) : item.isOn,
              };
            }

            return item;
          });
        }

        const incomingVolume = getReagentLiquidContributionML(reagentName, amount);
        if (!canAcceptIncomingVolume(targetItem.type, targetItem.chemState, incomingVolume)) {
          showToast(`🚫 ${targetItem.name} 容量不足，无法继续加入 ${incomingVolume.toFixed(1)}mL`);
          return currentItems;
        }

        const previousState = targetItem.chemState;
        const transferResult = mixReagent(targetItem.chemState, reagentName, amount);
        if (focusedItemIdRef.current === targetId) {
          syncReadouts(transferResult.newState);
        }

        setTimeout(() => {
          emitReactionOutcomeRef.current(reagentName, transferResult);
          const hint = computeReactionHint(targetItem, reagentName, previousState, transferResult);
          showInlineContainerHint({ ...hint, targetId });
        }, 0);

        return currentItems.map(item => {
          if (item.id === targetId) {
            return {
              ...item,
              chemState: transferResult.newState,
              state: transferResult.reactionType,
              lastReactionTime: Date.now()
            };
          }
          return item;
        });
      });
    };
    window.addEventListener('buretteDrip', handleBuretteDrip);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('reagentDrop', handleReagentDrop);
      window.removeEventListener('workspaceDragState', handleWorkspaceDragState);
      window.removeEventListener('buretteDrip', handleBuretteDrip);
    };
  }, [showInlineContainerHint, showToast, syncReadouts]);

  const agentState = useMemo(() => inferAgentState({
    items: placedItems,
    focusedId: focusedItemId,
    gameMode,
    activeChallenge,
    lastEvent: agentLastEvent,
  }), [activeChallenge, agentLastEvent, focusedItemId, gameMode, placedItems]);

  const lavoisierApiUrl = (import.meta.env.VITE_LAVOISIER_API_URL as string | undefined)?.trim() || '/api/lavoisier';
  const agentIntentMeta = useMemo(() => getAgentIntentMeta(agentState.intent), [agentState.intent]);
  const primaryAgentContainer = useMemo(() => {
    const active = placedItems.find(item => item.id === focusedItemId && LIQUID_CONTAINER_TYPES.has(item.type));
    if (active) return active;
    return placedItems.find(item => LIQUID_CONTAINER_TYPES.has(item.type) && getTotalLiquidVolume(item.chemState) > 0)
      || placedItems.find(item => LIQUID_CONTAINER_TYPES.has(item.type));
  }, [focusedItemId, placedItems]);
  const primaryAgentContainerId = primaryAgentContainer?.id || null;
  const challengeInsight = useMemo(() => computeChallengeInsight(activeChallenge, placedItems), [activeChallenge, placedItems]);
  const challengeProductReady = useMemo(() => computeChallengeCompleted(activeChallenge, placedItems), [activeChallenge, placedItems]);
  const activeMissionProof = activeChallenge ? MISSION_PROOFS[activeChallenge.id] : undefined;
  const activeProofAnswers = activeChallenge ? (missionProofAnswers[activeChallenge.id] || {}) : {};
  const activeProofSolvedCount = activeMissionProof?.checkpoints.filter(checkpoint => activeProofAnswers[checkpoint.id]?.correct).length ?? 0;
  const activeProofCurrent = activeMissionProof?.checkpoints.find(checkpoint => !activeProofAnswers[checkpoint.id]?.correct);
  const activeProofCurrentAnswer = activeProofCurrent ? activeProofAnswers[activeProofCurrent.id] : undefined;
  const activeProofSolved = Boolean(activeMissionProof && activeProofSolvedCount === activeMissionProof.checkpoints.length);
  const discoveryCards = useMemo(() => buildDiscoveryCards(placedItems, unlockedDiscoveryIds), [placedItems, unlockedDiscoveryIds]);
  const unlockedDiscoveryCount = useMemo(() => discoveryCards.filter(card => card.unlocked).length, [discoveryCards]);
  const completedMissionCount = useMemo(
    () => MISSION_SEQUENCE.filter(preset => completedMissionIds.has(MISSION_BRIEFS[preset].challengeId)).length,
    [completedMissionIds]
  );
  const activeMissionPreset = useMemo(
    () => activeChallenge ? MISSION_SEQUENCE.find(preset => MISSION_BRIEFS[preset].challengeId === activeChallenge.id) : undefined,
    [activeChallenge]
  );
  const activeMissionBrief = activeMissionPreset ? MISSION_BRIEFS[activeMissionPreset] : null;
  const challengeDoneCount = challengeInsight?.checklist.filter(item => item.done).length ?? 0;
  const challengeStepCount = challengeInsight?.checklist.length ?? 0;
  const challengeProofStepCount = activeMissionProof?.checkpoints.length ?? 0;
  const challengeDisplayDoneCount = challengeDoneCount + activeProofSolvedCount;
  const challengeDisplayStepCount = challengeStepCount + challengeProofStepCount;
  const challengeStepLabels = [
    ...(activeMissionBrief?.route || challengeInsight?.checklist.map(item => item.label) || []),
    ...(activeMissionProof?.checkpoints.map(checkpoint => checkpoint.label) || []),
  ];
  const challengeNextAction = challengeInsight?.checklist.find(item => !item.done)?.label || null;
  const challengeGuideTargetId = gameMode === 'challenge' && activeChallenge ? primaryAgentContainerId : null;
  const challengeQuickReagent = useMemo(() => {
    if (!challengeNextAction || !challengeInsight) return null;
    const actionPool = [...challengeInsight.primaryReagents, ...challengeInsight.secondaryReagents];
    const normalize = (name: string) => name.replace(/[（(].*?[）)]/g, '').replace('指示剂', '').trim();
    return actionPool.find(name => name === challengeNextAction)
      || actionPool.find(name => normalize(name) === challengeNextAction || name.includes(challengeNextAction) || challengeNextAction.includes(normalize(name)))
      || (challengeNextAction === '有机相' ? actionPool.find(name => name.includes('四氯化碳')) : undefined)
      || null;
  }, [challengeInsight, challengeNextAction]);
  const challengeActionOptions = useMemo(() => {
    if (!challengeInsight || !primaryAgentContainerId || activeChallenge?.completed) return [];
    const options: Array<{ name: string; label: string; tone: 'next' | 'main' | 'try'; volume: number }> = [];
    const pushOption = (name: string, label: string, tone: 'next' | 'main' | 'try', volume = 20) => {
      if (!name || options.some(option => option.name === name)) return;
      options.push({ name, label, tone, volume });
    };

    if (challengeQuickReagent) pushOption(challengeQuickReagent, '下一步', 'next');
    const completedLabels = new Set(challengeInsight.checklist.filter(item => item.done).map(item => item.label));
    const normalize = (name: string) => name.replace(/[（(].*?[）)]/g, '').replace('指示剂', '').trim();
    challengeInsight.primaryReagents
      .filter(name => !completedLabels.has(name) && !completedLabels.has(normalize(name)))
      .forEach(name => pushOption(name, '主线', 'main'));
    challengeInsight.secondaryReagents.slice(0, 2).forEach(name => pushOption(name, '可试', 'try', 10));
    return options.slice(0, 4);
  }, [activeChallenge?.completed, challengeInsight, challengeQuickReagent, primaryAgentContainerId]);

  /* eslint-disable react-hooks/preserve-manual-memoization -- React Compiler flags the stable toast callback here; dependencies remain explicit for hook correctness. */
  const handleAgentQuickAction = useCallback((actionId: 'focus' | 'logs' | 'reagents' | 'note') => {
    if (actionId === 'focus') {
      const target = primaryAgentContainerId
        ? placedItemsRef.current.find(item => item.id === primaryAgentContainerId)
        : null;
      if (!target) return;
      setFocusedItemId(target.id);
      syncReadouts(target.chemState);
      showToast(`🎯 已聚焦 ${target.name}`);
      return;
    }

    if (actionId === 'logs') {
      if (isTablet) setBottomSheetOpen(true);
      setActiveRightPanelTab('logs');
      setRightPanelPulse('logs');
      window.setTimeout(() => setRightPanelPulse(current => current === 'logs' ? null : current), 1200);
      showToast('已打开观察日志');
      return;
    }

    if (actionId === 'reagents') {
      if (isTablet) setBottomSheetOpen(true);
      setActiveRightPanelTab('reagents');
      setReagentFocusSignal(value => value + 1);
      setRightPanelPulse('reagents');
      window.setTimeout(() => setRightPanelPulse(current => current === 'reagents' ? null : current), 1200);
      showToast('已定位到推荐试剂');
      return;
    }

    const note = `拉瓦锡备忘：${agentRemoteSummary}`;
    lastAgentNoteRef.current = { at: Date.now(), message: note };
    window.dispatchEvent(new CustomEvent('agentNote', { detail: { message: note } }));
    showToast('📝 已把当前建议写入观察日志');
  }, [agentRemoteSummary, isTablet, primaryAgentContainerId, showToast, syncReadouts]);
  /* eslint-enable react-hooks/preserve-manual-memoization */

  const runAgentToolCalls = useCallback((toolCalls?: AgentToolCall[]) => {
    if (!toolCalls?.length) return;
    toolCalls.forEach((toolCall) => {
      switch (toolCall.type) {
        case 'focus_container': {
          const target = toolCall.targetId
            ? placedItemsRef.current.find(item => item.id === toolCall.targetId)
            : primaryAgentContainerId
            ? placedItemsRef.current.find(item => item.id === primaryAgentContainerId)
            : null;
          if (target && LIQUID_CONTAINER_TYPES.has(target.type)) {
            setFocusedItemId(target.id);
            syncReadouts(target.chemState);
          }
          break;
        }
        case 'open_logs':
          handleAgentQuickAction('logs');
          break;
        case 'open_reagents':
          handleAgentQuickAction('reagents');
          break;
        case 'save_note': {
          const note = toolCall.note?.trim() || `拉瓦锡备忘：${agentRemoteSummary}`;
          lastAgentNoteRef.current = { at: Date.now(), message: note };
          window.dispatchEvent(new CustomEvent('agentNote', { detail: { message: note } }));
          break;
        }
      }
    });
  }, [agentRemoteSummary, handleAgentQuickAction, primaryAgentContainerId, syncReadouts]);

  const agentSkillPrompts = useMemo(() => {
    const localPrompts = [
      ...(challengeInsight?.suggestedPrompts || []),
      ...(primaryAgentContainer ? ['分析当前容器'] : []),
      ...(dragGuide?.kind === 'reagent' && dragGuide.targetId && dragGuide.name ? [`${dragGuide.name}加到当前容器会怎样`] : []),
    ];
    return dedupePromptStrings([...localPrompts, ...agentSuggestedPrompts]).slice(0, 3);
  }, [agentSuggestedPrompts, challengeInsight, dragGuide, primaryAgentContainer]);
  const agentDockSide = useMemo(() => {
    return agentPosition.x + AGENT_ORB_WIDTH / 2 >= agentViewport.width / 2 ? 'right' : 'left';
  }, [agentPosition.x, agentViewport.width]);
  const agentVerticalPlacement = useMemo(() => {
    return agentPosition.y + AGENT_ORB_HEIGHT / 2 >= agentViewport.height / 2 ? 'up' : 'down';
  }, [agentPosition.y, agentViewport.height]);
  const showFloatingAgent = !(gameMode === 'challenge' && placedItems.length === 0 && brokenGlass.length === 0);

  const appendAgentMessage = useCallback((text: string) => {
    setAgentMessages(prev => [...prev, { id: createRuntimeId('agent-msg'), role: 'agent' as const, text }].slice(-8));
  }, []);

  const appendUserMessage = useCallback((text: string) => {
    setAgentMessages(prev => [...prev, { id: createRuntimeId('agent-msg'), role: 'user' as const, text }].slice(-8));
  }, []);

  const requestLavoisierApi = useCallback(async (query: string, options?: { silent?: boolean; includeUserMessage?: boolean }) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const shouldOpenPanel = options?.includeUserMessage !== false;
    const liveItems = placedItemsRef.current.length > 0 ? placedItemsRef.current : placedItems;
    const liveFocusedId = focusedItemIdRef.current;
    const primaryContainer = (primaryAgentContainerId
      ? liveItems.find(item => item.id === primaryAgentContainerId)
      : null)
      || (liveFocusedId ? liveItems.find(item => item.id === liveFocusedId && LIQUID_CONTAINER_TYPES.has(item.type)) : null)
      || liveItems.find(item => LIQUID_CONTAINER_TYPES.has(item.type) && getTotalLiquidVolume(item.chemState) > 0)
      || liveItems.find(item => LIQUID_CONTAINER_TYPES.has(item.type))
      || null;

	    agentAbortControllerRef.current?.abort();
	    const controller = new AbortController();
	    let didTimeout = false;
	    const timeoutId = window.setTimeout(() => {
	      didTimeout = true;
	      controller.abort();
	    }, AGENT_REQUEST_TIMEOUT_MS);
	    agentAbortControllerRef.current = controller;

    if (options?.includeUserMessage !== false) {
      appendUserMessage(trimmed);
    }

    if (shouldOpenPanel) {
      setAgentExpanded(true);
      setAgentDraft('');
    }
    setAgentIsLoading(true);
    setAgentError(null);

    try {
      const history = [
        ...agentMessages.slice(-5).map(message => ({ role: message.role, text: message.text })),
        ...(options?.includeUserMessage === false ? [] : [{ role: 'user' as const, text: trimmed }]),
      ];
      const containers = liveItems
        .filter(item => LIQUID_CONTAINER_TYPES.has(item.type))
        .slice(0, 8)
        .map(item => ({
          id: item.id,
          name: item.name,
          type: item.type,
          volume: getTotalLiquidVolume(item.chemState),
          temperature: item.chemState.temperature,
          ph: calculatePH(item.chemState),
          pressure: calculatePressureEstimate(item.chemState, getContainerCapacity(item.type)),
          state: item.state || 'idle',
          organicVolume: item.chemState.organicVolume || 0,
          organicColor: item.chemState.organicColor || null,
          species: summarizeAgentSpecies(item.chemState),
        }));

      const requestBody = JSON.stringify({
        message: trimmed,
        conversation: history,
        context: {
          mode: gameMode,
          challenge: activeChallenge,
          focusedContainer: primaryContainer ? {
            id: primaryContainer.id,
            name: primaryContainer.name,
            type: primaryContainer.type,
            volume: getTotalLiquidVolume(primaryContainer.chemState),
            temperature: primaryContainer.chemState.temperature,
            ph: calculatePH(primaryContainer.chemState),
            pressure: calculatePressureEstimate(primaryContainer.chemState, getContainerCapacity(primaryContainer.type)),
            state: primaryContainer.state || 'idle',
            organicVolume: primaryContainer.chemState.organicVolume || 0,
            organicColor: primaryContainer.chemState.organicColor || null,
            species: summarizeAgentSpecies(primaryContainer.chemState),
          } : null,
          containers,
          lastEvent: agentLastEvent || null,
          localSignals: {
            intent: agentState.intent,
            risks: agentState.risks,
            goal: agentState.goal || null,
          },
          availableSkills: ['focus_container', 'open_logs', 'open_reagents', 'save_note'],
        },
      });

      let payload: unknown = null;
      let lastApiError: unknown = null;
      for (const apiUrl of getLavoisierApiCandidates(lavoisierApiUrl)) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
              body: requestBody,
            });

            if (!response.ok) {
              throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
            }

            payload = await response.json();
            break;
          } catch (apiError) {
            lastApiError = apiError;
            if (apiError instanceof DOMException && apiError.name === 'AbortError') {
              throw apiError;
            }

            const status = apiError instanceof Error && 'status' in apiError
              ? Number((apiError as { status?: unknown }).status)
              : 0;
            const shouldRetrySameEndpoint = attempt === 0 && (!status || status >= 500);
            if (shouldRetrySameEndpoint) {
              await new Promise(resolve => window.setTimeout(resolve, 450));
              continue;
            }
            break;
          }
        }
        if (payload) {
          break;
        }
      }

      if (!payload) {
        throw lastApiError instanceof Error ? lastApiError : new Error('接口不可达');
      }

      const parsedText = extractLavoisierTextFromUnknown(payload);
      if (!parsedText) {
        throw new Error('接口返回为空');
      }

      const normalizedPayload = payload as Partial<LavoisierAgentApiResponse> & Record<string, unknown>;
      const normalized: LavoisierAgentApiResponse = {
        reply: parsedText,
        headline: typeof normalizedPayload.headline === 'string' ? normalizedPayload.headline : undefined,
        suggestedPrompts: Array.isArray(normalizedPayload.suggestedPrompts)
          ? normalizedPayload.suggestedPrompts.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          : Array.isArray(normalizedPayload.followUps)
          ? normalizedPayload.followUps.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          : undefined,
        toolCalls: Array.isArray(normalizedPayload.toolCalls)
          ? normalizedPayload.toolCalls as AgentToolCall[]
          : Array.isArray(normalizedPayload.actions)
          ? normalizedPayload.actions as AgentToolCall[]
          : undefined,
        statusLabel: typeof normalizedPayload.statusLabel === 'string'
          ? normalizedPayload.statusLabel
          : typeof normalizedPayload.model === 'string'
          ? `已连接 ${normalizedPayload.model}`
          : '远程对话已接线',
      };

      if (!options?.silent) {
        appendAgentMessage(normalized.reply);
      }
      setAgentRemoteHeadline(normalized.headline || '');
      setAgentRemoteSummary(normalized.reply);
      setAgentSuggestedPrompts(normalized.suggestedPrompts?.length ? normalized.suggestedPrompts.slice(0, 3) : ['下一步', '解释现象', '我做对了吗']);
      setAgentStatusLabel(normalized.statusLabel || '在线');
      runAgentToolCalls(normalized.toolCalls);
	    } catch (error) {
	      if (error instanceof DOMException && error.name === 'AbortError') {
	        if (didTimeout) {
	          setAgentStatusLabel('本地接口超时');
	        }
	        if (didTimeout && !options?.silent) {
	          appendAgentMessage('拉瓦锡暂时没有等到接口回复。请先聚焦容器或查看观察日志，我不会根据空上下文猜实验。');
	        }
	        return;
	      }
      const message = error instanceof Error ? error.message : '未知错误';
      const display = `拉瓦锡暂时没有从远程接口拿到回复：${message}`;
      setAgentError(display);
      if (!options?.silent) {
        appendAgentMessage(display);
      }
      setAgentStatusLabel('异常');
	    } finally {
	      window.clearTimeout(timeoutId);
	      setAgentIsLoading(false);
      if (agentAbortControllerRef.current === controller) {
        agentAbortControllerRef.current = null;
      }
    }
  }, [activeChallenge, agentLastEvent, agentMessages, agentState.goal, agentState.intent, agentState.risks, appendAgentMessage, appendUserMessage, gameMode, placedItems, primaryAgentContainerId, runAgentToolCalls, lavoisierApiUrl, setAgentDraft, setAgentExpanded]);

  const submitAgentQuery = useCallback((query: string) => {
    void requestLavoisierApi(query, { includeUserMessage: true });
  }, [requestLavoisierApi]);

  const handleAgentPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const coords = getPointerCoordinates(event.nativeEvent);
    if (!coords) return;

    agentDragStateRef.current = {
      pointerId: event.pointerId,
      startX: coords.x,
      startY: coords.y,
      originX: agentPosition.x,
      originY: agentPosition.y,
      dragging: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }, [agentPosition.x, agentPosition.y]);

  const handleAgentPointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = agentDragStateRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    const coords = getPointerCoordinates(event.nativeEvent);
    if (!coords) return;

    const deltaX = coords.x - dragState.startX;
    const deltaY = coords.y - dragState.startY;

    if (!dragState.dragging && Math.hypot(deltaX, deltaY) < 8) {
      return;
    }

    if (!dragState.dragging) {
      dragState.dragging = true;
      setAgentIsDragging(true);
    }

    setAgentPosition(clampAgentPosition({
      x: dragState.originX + deltaX,
      y: dragState.originY + deltaY,
    }, agentViewport.width, agentViewport.height));
  }, [agentViewport.height, agentViewport.width]);

  const resetAgentDragState = useCallback(() => {
    agentDragStateRef.current = { pointerId: null, startX: 0, startY: 0, originX: 0, originY: 0, dragging: false };
    setAgentIsDragging(false);
  }, []);

  const handleAgentPointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = agentDragStateRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragState.dragging) {
      setAgentPosition(current => clampAgentPosition(current, agentViewport.width, agentViewport.height));
      resetAgentDragState();
      return;
    }

    resetAgentDragState();
    setAgentExpanded(v => !v);
  }, [agentViewport.height, agentViewport.width, resetAgentDragState, setAgentExpanded]);

  const handleAgentPointerCancel = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = agentDragStateRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragState.dragging) {
      setAgentPosition(current => clampAgentPosition(current, agentViewport.width, agentViewport.height));
    }

    resetAgentDragState();
  }, [agentViewport.height, agentViewport.width, resetAgentDragState]);

  useEffect(() => {
    const digest = `${agentState.intent}|${agentState.suggestion}|${agentState.risks.slice(0, 2).join('|')}|${agentState.goal?.progress || ''}`;
    if (!lastAgentDigestRef.current) {
      lastAgentDigestRef.current = digest;
      return;
    }
    if (lastAgentDigestRef.current === digest) {
      return;
    }

    lastAgentDigestRef.current = digest;
    setAgentOrbPulse(true);
    setAgentHasFreshUpdate(true);

    const pulseTimer = window.setTimeout(() => setAgentOrbPulse(false), 2200);
    return () => window.clearTimeout(pulseTimer);
  }, [agentLastEvent?.kind, agentState.goal?.progress, agentState.intent, agentState.risks, agentState.suggestion, placedItems.length]);

  useEffect(() => {
    const unlockedCards = discoveryCards.filter(card => card.unlocked);
    const previousIds = lastUnlockedDiscoveryIdsRef.current;
    const newlyUnlocked = unlockedCards.find(card => !previousIds.has(card.id));
    lastUnlockedDiscoveryIdsRef.current = new Set(unlockedCards.map(card => card.id));

    if (!newlyUnlocked) return;
    setDiscoveryToast(newlyUnlocked);
    const timer = window.setTimeout(() => {
      setDiscoveryToast(current => current?.id === newlyUnlocked.id ? null : current);
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [discoveryCards]);

  useEffect(() => {
    if (!agentExpanded) return;
    const timer = window.setTimeout(() => setAgentHasFreshUpdate(false), 0);
    return () => window.clearTimeout(timer);
  }, [agentExpanded]);

  useEffect(() => {
    if (!atlasOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAtlasOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [atlasOpen]);

  useEffect(() => {
    if (!agentExpanded) return;
    const timer = window.setTimeout(() => {
      agentInputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [agentExpanded]);

  useEffect(() => {
    if (!agentExpanded) return;
    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (agentShellRef.current?.contains(target)) return;
      if (agentDockButtonRef.current?.contains(target)) return;
      setAgentExpanded(false);
    };

    window.addEventListener('pointerdown', handlePointerDownOutside);
    return () => window.removeEventListener('pointerdown', handlePointerDownOutside);
  }, [agentExpanded]);

  useEffect(() => {
    if (!agentExpanded) return;
    const timer = window.setTimeout(() => {
      agentMessagesEndRef.current?.scrollIntoView({ block: 'end' });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [agentExpanded, agentIsLoading, agentMessages]);

  useEffect(() => {
    if (!agentLastEvent) return;
    if (agentLastEvent.kind === 'readout' && agentState.risks.length === 0) return;
    const digest = `${agentLastEvent.kind}|${agentState.headline}|${agentState.risks.join('|')}`;
    if (lastAgentConversationDigestRef.current === digest) return;
    lastAgentConversationDigestRef.current = digest;
    const reacted = agentLastEvent.kind === 'reaction' ? (agentLastEvent.reacted || '').trim() : '';
    setAgentRemoteHeadline(agentState.headline);
    setAgentRemoteSummary(reacted || agentState.suggestion);
  }, [agentLastEvent, agentState.headline, agentState.risks, agentState.suggestion]);

  useEffect(() => {
    const handleAgentReaction = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { name, reacted, isDrop, temp, ph } = customEvent.detail || {};
      if (isDrop) return;

      const eventPayload = { kind: 'reaction' as const, name, reacted, temp, ph };
      setAgentLastEvent(eventPayload);
    };

    const handleAgentTempSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { temp, ph } = customEvent.detail || {};
      if (typeof temp !== 'number' || typeof ph !== 'number') return;
      setAgentLastEvent({ kind: 'readout', temp, ph });
    };

    window.addEventListener('reagentDrop', handleAgentReaction);
    window.addEventListener('tempSync', handleAgentTempSync);
    return () => {
      window.removeEventListener('reagentDrop', handleAgentReaction);
      window.removeEventListener('tempSync', handleAgentTempSync);
    };
  }, []);

  // Challenge Completion Checker
  useEffect(() => {
    if (gameMode !== 'challenge' || !activeChallenge || activeChallenge.completed) return;

    const proof = MISSION_PROOFS[activeChallenge.id];
    const answers = missionProofAnswers[activeChallenge.id] || {};
    const proofSolved = proof ? proof.checkpoints.every(checkpoint => answers[checkpoint.id]?.correct) : true;
    const success = computeChallengeCompleted(activeChallenge, placedItems) && proofSolved;
    if (!success || pendingChallengeCompletionRef.current === activeChallenge.id) return;

    pendingChallengeCompletionRef.current = activeChallenge.id;
    playSound('reaction');
    const meta = getMissionSuccessMeta(activeChallenge.id);
    setMissionCompletionCard({
      id: createRuntimeId('mission-complete'),
      challengeId: activeChallenge.id,
      title: activeChallenge.title,
      product: meta.product,
      formula: meta.formula,
      accent: meta.accent,
    });
    setCompletedMissionIds(previousIds => {
      if (previousIds.has(activeChallenge.id)) return previousIds;
      const nextIds = new Set(previousIds);
      nextIds.add(activeChallenge.id);
      writeStoredMissionCompletionIds(nextIds);
      return nextIds;
    });
    setTimeout(() => {
      setActiveChallenge(c => c?.id === activeChallenge.id ? { ...c, completed: true } : c);
    }, 0);
  }, [activeChallenge, gameMode, missionProofAnswers, placedItems, playSound]);

  usePhysicsEngine(
    placedItems, 
    setPlacedItems, 
    setBrokenGlass, 
    focusedItemId, 
    setFocusedItemId, 
    playSound, 
    stopSound, 
    showToast
  );

  function addReagentToContainer(targetId: string, reagentName: string, volumeML = 20) {
    setPlacedItems(currentItems => {
      const target = currentItems.find(i => i.id === targetId);
      if (!target || !LIQUID_CONTAINER_TYPES.has(target.type)) {
        showToast('先选择一个容器');
        return currentItems;
      }

      const capacity = getContainerCapacity(target.type);
      const currentVolume = getTotalLiquidVolume(target.chemState);
      if (currentVolume + volumeML > capacity) {
        showToast(`🚫 ${target.name} 容量不足，无法加入 ${volumeML}mL`);
        return currentItems;
      }

      saveSnapshot(currentItems, brokenGlass);
      const previousState = target.chemState;
      const result = mixReagent(previousState, reagentName, volumeML);

      setTimeout(() => {
        emitReactionOutcome(reagentName, result);
        const hint = computeReactionHint(target, reagentName, previousState, result);
        showInlineContainerHint({ ...hint, targetId: target.id });
      }, 0);

      const nextItems = currentItems.map(item => {
        if (item.id !== target.id) return item;
        return {
          ...item,
          chemState: result.newState,
          state: result.reactionType,
          lastReactionTime: result.reactionType !== 'added' ? Date.now() : item.lastReactionTime,
        };
      });
      placedItemsRef.current = nextItems;
      if (focusedItemIdRef.current === target.id) {
        syncReadouts(result.newState);
      }
      return nextItems;
    });
  }

  const handleConfirmDrop = () => {
    if (!activeDrop) return;

    setPlacedItems(currentItems => {
      const collisionItem = currentItems.find(i => i.id === activeDrop.targetId);
      if (!collisionItem) return currentItems;

      const absoluteMax = getContainerCapacity(collisionItem.type);
      const currentTotalVolume = getTotalLiquidVolume(collisionItem.chemState);
      if (currentTotalVolume + dropVolume > absoluteMax) {
        showToast(`🚫 该容器已装入 ${currentTotalVolume.toFixed(1)}mL，无法再加入 ${dropVolume}mL (最大容量 ${absoluteMax}mL)`);
        return currentItems;
      }

      // Thermal shock logic
      const targetGlassTemp = collisionItem.chemState.glassTemp ?? collisionItem.chemState.temperature;
      const existingLiquidVolume = getTotalLiquidVolume(collisionItem.chemState);
      const incomingThermalShockRatio = dropVolume / Math.max(5, existingLiquidVolume || dropVolume);
      const incomingTemp = ROOM_TEMPERATURE;
      const thermalShockDelta = targetGlassTemp - incomingTemp;

      if (thermalShockDelta > 55 && incomingThermalShockRatio > 0.45 && dropVolume > 10) {
         saveSnapshot(currentItems, brokenGlass); // adding >20ml of cold liquid to hot >80C glass
         playSound('break', 0, collisionItem.id);
         showToast("⚠️ 高温玻璃遭遇大体积冷液冲击，容器破裂！");
         setBrokenGlass(prev => [...prev, { id: collisionItem.id, x: collisionItem.x, y: collisionItem.y, color: getChemColor(collisionItem.chemState) }]);
         setActiveDrop(null);
         stopSound(collisionItem.id);
         return currentItems.filter(i => i.id !== collisionItem.id);
      }

      // Mix using the stoich engine
      saveSnapshot(currentItems, brokenGlass);
      const previousState = collisionItem.chemState;
      const { newState, log, reactionType, equation } = mixReagent(
        previousState,
        activeDrop.reagentName, 
        dropVolume
      );

      setTimeout(() => {
        emitReactionOutcome(activeDrop.reagentName, { newState, log, reactionType, equation });
        const hint = computeReactionHint(collisionItem, activeDrop.reagentName, previousState, { newState, log, reactionType, equation });
        showInlineContainerHint({ ...hint, targetId: collisionItem.id });
      }, 0);

      const nextItems = currentItems.map(item => {
        if (item.id === collisionItem.id) {
              return { 
                ...item, 
                chemState: newState,
                state: reactionType,
                lastReactionTime: Date.now() // Record time for physics
              };
        }
        return item;
      });
      placedItemsRef.current = nextItems;
      return nextItems;
    });

    setActiveDrop(null);
  };

  const handleCancelDrop = () => {
    setActiveDrop(null);
  };

  const focusedContainer = placedItems.find(item => (
    item.id === focusedItemId && (item.type === 'beaker' || item.type === 'flask' || item.type === 'testtube')
  ));
  const focusedContainerLabel = focusedContainer?.name || '未选择容器';
  const focusedBoilingPoint = focusedContainer?.chemState.boilingPoint ?? 100;
  const focusedPressure = focusedContainer ? calculatePressureEstimate(focusedContainer.chemState, getContainerCapacity(focusedContainer.type)) : 1;
  const focusedPhaseLabel = focusedContainer
    ? (() => {
        const aqueousVolume = focusedContainer.chemState.volume || 0;
        const organicVolume = focusedContainer.chemState.organicVolume || 0;
        if (aqueousVolume > 0 && organicVolume > 0) return '水/有机双相';
        if (organicVolume > 0) return '有机液相';
        if (aqueousVolume > 0) return '水相溶液';
        return '无明显液相';
      })()
    : '未选择';
  const highlightedTargetId = dragGuide?.targetId || null;
  const dragTargetHint = useMemo(() => {
    if (dragGuide?.kind !== 'reagent' || !dragGuide.targetId || !dragGuide.name) return null;
    const target = placedItems.find(item => item.id === dragGuide.targetId);
    if (!target || (!LIQUID_CONTAINER_TYPES.has(target.type) && target.type !== 'burette')) return null;
    return {
      targetId: target.id,
      ...computeDragProximityHint(activeChallenge, target, dragGuide.name),
    } satisfies ContainerHintCard;
  }, [activeChallenge, dragGuide, placedItems]);

  const renderPlacedIcon = (item: PlacedItem) => {
    // 检查反应是否还在进行中 (仅中和反应等短效特效会在 2.5 秒后清除)
    let isReacting = item.state?.includes('precipitate') || item.state?.includes('gas') || item.state === 'neutralize' || item.state?.includes('gas_boil') || item.state?.includes('gas_i2') || item.state?.includes('redox');
    
    const timeSinceReaction = item.lastReactionTime && renderNow ? renderNow - item.lastReactionTime : 0;
    
    // 短暂特效：中和反应、银镜反应的强烈光斑 (结束后留下实际颜色)
    if ((item.state === 'neutralize' || item.state === 'redox_silver_mirror' || item.state === 'complex_cu_nh3') && timeSinceReaction > 2500) {
       isReacting = false;
    }
    
    const volume = item.type === 'pipette' || item.type === 'burette'
      ? getTotalLiquidVolume(item.chemState)
      : item.chemState.volume;
    const contentColor = getChemColor(item.chemState);
    
    // Choose particle colors based on reaction type
    let particleColor = '#10b981'; // default green
    if (item.state?.includes('precipitate_ag') || item.state?.includes('precipitate_ba')) particleColor = '#f8fafc'; // white
    if (item.state?.includes('precipitate_cu')) particleColor = '#059669'; // emerald
    if (item.state?.includes('precipitate_fe3')) particleColor = '#991b1b'; // red-brown
    if (item.state?.includes('precipitate_fe2')) particleColor = '#65a30d'; // light-green
    if (item.state?.includes('gas_cl2')) particleColor = '#facc15'; // yellow-green gas
    if (item.state?.includes('gas_co2') || item.state?.includes('gas_boil')) particleColor = '#ffffff'; // colorless/white bubbles
    if (item.state?.includes('gas_i2')) particleColor = '#9333ea'; // Purple gas (Sublimation)
    if (item.state === 'neutralize') particleColor = '#ef4444'; // red (heat)
    if (item.state === 'complex_fe_scn') particleColor = '#991b1b'; // blood red (though no solid particles, just in case)
    if (item.state === 'complex_cu_nh3') particleColor = '#1e3a8a'; // deep blue
    if (item.state === 'redox_kmno4') particleColor = '#ffffff'; // CO2 bubbles
    if (item.state === 'redox_silver_mirror') particleColor = '#cbd5e1'; // Silver

    // Check specifically for gas boil, to force rendering logic
    const isGasBoil = item.state?.includes('gas_boil') || false;
    // If it's a boiling state, override reacting flag to ensure particles generate
    if (isGasBoil) isReacting = true;

    // Generate an array of random particles for the precipitate effect
    // We memoize this slightly per item state so Framer Motion doesn't restart animations constantly on re-render
    const particlesCount = isGasBoil ? 35 : (item.state?.includes('gas') ? 25 : 15);
    
    // We use a deterministic seed based on item.id so particles don't jitter wildly on every 100ms temp update
    const randomSeed = parseInt(item.id.replace(/\D/g, '')) || 12345;
    const seededRandom = (seedOffset: number) => {
      const x = Math.sin(randomSeed + seedOffset) * 10000;
      return x - Math.floor(x);
    };

    const particles = isReacting ? Array.from({ length: particlesCount }).map((_, i) => ({
      id: `${item.state}-${i}`, // Stable ID based on current state so React/Framer doesn't remount them continuously
      left: `${20 + seededRandom(i) * 60}%`,
      duration: isGasBoil ? 0.5 + seededRandom(i+100) * 0.8 : (item.state?.includes('gas') ? 1 + seededRandom(i+100) : 1.5 + seededRandom(i+100) * 2), // Boiling gas escapes very fast
      delay: seededRandom(i+200) * 2,
      size: 3 + seededRandom(i+300) * 5
    })) : [];

    // !! 核心修复：只有当反应真正生成了沉淀，或者正处于沉淀的后续状态中，才允许其展示浑浊滤网 !!
    // const isCloudyPrecipitate = item.state?.includes('precipitate') || false;

    switch(item.type) {
      case 'beaker': 
        return <RealisticBeaker volume={volume} color={contentColor} isReacting={isReacting} reactionType={item.state} particles={particles} particleColor={particleColor} width={100} timeSinceReaction={timeSinceReaction} velocity={item.velocity} organicVolume={item.chemState.organicVolume} organicColor={item.chemState.organicColor} organicDensity={item.chemState.organicDensity} temperature={item.chemState.temperature} />;
      case 'pipette': 
        return (
          <div className="relative group flex items-center justify-center h-[90px] w-[30px]">
             <Pipette size={56} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.6)] transform rotate-180 transition-transform duration-300 group-hover:scale-110 group-hover:text-emerald-300" strokeWidth={1.5} />
             {/* Liquid indicator inside pipette */}
             <div className="absolute bottom-[4px] left-1/2 -translate-x-1/2 w-[8px] rounded-b-sm bg-black/40 overflow-hidden backdrop-blur-md shadow-[inset_0_0_5px_rgba(0,0,0,0.5)]" style={{ height: '38px' }}>
                <div className="absolute bottom-0 w-full transition-all duration-300" style={{ height: `${(volume / 10) * 100}%`, backgroundColor: contentColor, boxShadow: `inset 0 2px 5px rgba(255,255,255,0.5)` }} />
             </div>
             {volume > 0 && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="absolute top-2 right-[-45px] text-[12px] font-mono font-bold text-white bg-[#0a0e1a]/90 border border-white/20 px-2 py-0.5 rounded shadow-[0_0_15px_rgba(255,255,255,0.2)] backdrop-blur-md whitespace-nowrap"
                >
                  {volume.toFixed(1)}mL
                </motion.div>
             )}
          </div>
        );
      case 'phmeter': 
        return (
          <div className="relative group flex flex-col items-center">
            <Gauge size={48} className="text-[#3b82f6] drop-shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-transform duration-300 group-hover:scale-110" />
            <div className="absolute top-[40px] left-1/2 -translate-x-1/2 w-1.5 h-[60px] bg-gradient-to-b from-gray-200 to-gray-400 rounded-b-full shadow-[inset_0_0_5px_rgba(0,0,0,0.5),_0_2px_5px_rgba(0,0,0,0.5)] z-[-1]" />
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 text-[12px] font-mono font-bold text-[#3b82f6] bg-[#0a0e1a]/90 border border-[#3b82f6]/50 px-2 py-0.5 rounded shadow-[0_0_15px_rgba(59,130,246,0.3)] backdrop-blur-md whitespace-nowrap"
            >
               pH {calculatePH(item.chemState).toFixed(2)}
            </motion.div>
          </div>
        );
      case 'flask': 
        return <RealisticFlask volume={volume} color={contentColor} isReacting={isReacting} reactionType={item.state} particles={particles} particleColor={particleColor} width={100} timeSinceReaction={timeSinceReaction} velocity={item.velocity} organicVolume={item.chemState.organicVolume} organicColor={item.chemState.organicColor} organicDensity={item.chemState.organicDensity} temperature={item.chemState.temperature} />;
      case 'testtube':
        return (
          <div className="relative">
            <RealisticTestTube volume={volume} color={contentColor} isReacting={isReacting} reactionType={item.state} particles={particles} particleColor={particleColor} width={24} timeSinceReaction={timeSinceReaction} velocity={item.velocity} organicVolume={item.chemState.organicVolume} organicColor={item.chemState.organicColor} organicDensity={item.chemState.organicDensity} temperature={item.chemState.temperature} boilingPoint={item.chemState.boilingPoint} />
            {item.rackId && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[15px] bg-black/60 text-white/80 text-[8px] px-1 rounded backdrop-blur-sm pointer-events-none border border-white/20 shadow-[0_0_5px_rgba(0,0,0,0.5)]">
                #{item.rackSlot !== undefined ? item.rackSlot + 1 : ''}
              </div>
            )}
          </div>
        );
      case 'funnel': {
        const targetLabel = item.linkedTargetId ? placedItems.find(placed => placed.id === item.linkedTargetId)?.name : undefined;
        return (
          <div className="relative flex flex-col items-center">
            <div className="relative w-[56px] h-[88px] flex items-center justify-center">
              <FlaskConical size={54} className="rotate-180 text-[#f8fafc] opacity-90 drop-shadow-[0_0_12px_rgba(248,250,252,0.25)]" strokeWidth={1.7} />
              <div className="absolute bottom-[10px] w-[6px] h-[26px] rounded-full bg-gradient-to-b from-white/70 to-white/20 border border-white/20 shadow-[0_0_8px_rgba(255,255,255,0.16)]" />
            </div>
            <div className="mt-1 text-[10px] px-2 py-0.5 rounded-full bg-[#0a0e1a]/80 border border-white/10 text-[#cbd5e1] whitespace-nowrap">
              {targetLabel ? `过滤 → ${targetLabel}` : '漏斗待接收'}
            </div>
          </div>
        );
      }
      case 'flame': 
        return (
          <div className="relative">
            <AlcoholLamp 
                 isOn={item.isOn || false} 
                 onToggle={() => {
                   setPlacedItems(currentItems => currentItems.map(i => i.id === item.id ? { ...i, isOn: !i.isOn } : i));
                 }} 
                 width={50} 
            />
          </div>
        );
      case 'burette': 
        return (
          <div className="relative">
            <Burette 
              volume={volume} 
              contentColor={contentColor} 
              isOpen={item.isOn || false} 
              onToggle={() => {
                setPlacedItems(currentItems => currentItems.map(i => i.id === item.id ? { ...i, isOn: !i.isOn } : i));
              }}
              width={35}
            />
          </div>
        );
      case 'thermometer': 
        return (
          <div className="relative flex flex-col items-center">
            <Thermometer size={60} className="text-[#f43f5e] drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
            <div className="mt-1 bg-black/60 px-2 py-1 rounded text-xs text-[#f43f5e] font-mono border border-[rgba(244,63,94,0.3)]">
              {item.chemState.temperature.toFixed(1)}°C
            </div>
          </div>
        );
      case 'tube':
        return (
          <div className="relative text-gray-400 opacity-50 flex flex-col items-center">
             <Cable size={30} />
             <span className="text-[10px] mt-1">请放置在两容器间</span>
          </div>
        );
      case 'glassrod': {
        const isStirring = placedItems.some(c => 
          (c.type === 'beaker' || c.type === 'flask') && 
          Math.abs(c.x - item.x) < 40 && 
          Math.abs(c.y - item.y) < 60
        );
        return (
          <div className="relative pointer-events-none">
            <motion.div 
              animate={{ 
                rotate: isStirring ? [0, 15, -15, 0] : 0,
                x: isStirring ? [0, 5, -5, 0] : 0 
              }} 
              transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
              className="origin-bottom"
            >
              <div className="w-[8px] h-[120px] rounded-full bg-gradient-to-b from-white/40 to-white/10 border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.2)] backdrop-blur-sm" />
            </motion.div>
            {isStirring && (
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/60 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap">
                搅拌中...
              </div>
            )}
          </div>
        );
      }
      case 'testtubes': 
        return (
          <TestTubeRack 
            id={item.id} 
            slots={[{tubeId: null}, {tubeId: null}, {tubeId: null}, {tubeId: null}, {tubeId: null}, {tubeId: null}]} 
            onSlotClick={(i) => {
              // When clicking an empty slot on the rack, we auto-create a testtube
              const hasTube = placedItems.some(p => p.rackId === item.id && p.rackSlot === i);
              if (!hasTube) {
                const slotXOffset = (i - 2.5) * (180 / 6);
                const newTestTubeId = createRuntimeId('testtube');
                saveSnapshot(placedItems, brokenGlass);
                setPlacedItems(current => [...current, {
                  id: newTestTubeId,
                  name: '试管',
                  type: 'testtube',
                  x: item.x + slotXOffset,
                  y: item.y - 20,
                  chemState: createEmptyState(),
                  isOn: false,
                  rackId: item.id,
                  rackSlot: i
                }]);
                setFocusedItemId(newTestTubeId);
                syncReadouts(createEmptyState());
                playSound('place');
              }
            }}
          />
        );
      default: return <RealisticBeaker volume={volume} color={contentColor} width={100} />;
    }
  };

  return (
    <>
      {/* Main App Container */}
      <div className="flex w-full max-w-[1440px] min-h-screen md:h-screen mx-auto text-[var(--text-primary)] font-sans flex-col relative overflow-hidden" style={{ background: 'var(--bg-base)' }}>
        {/* TOP BAR */}
        <header className="min-h-[56px] w-[calc(100%-24px)] flex items-center justify-between flex-wrap gap-3 px-6 py-3 shrink-0 glass-panel mx-auto mt-3">
          <div className="flex items-center gap-4">
            <div className="font-bold text-[18px] text-white">ChemLab Pro</div>
            <div className="h-4 w-[1px] bg-[rgba(255,255,255,0.15)]"></div>
            <div className="flex bg-[rgba(255,255,255,0.05)] rounded-lg p-0.5 border border-white/10">
            <button 
              onClick={() => {
                setGameMode('sandbox');
                setActiveChallenge(null);
              }}
              className={`px-3 py-1 rounded-md text-[13px] transition-all ${gameMode === 'sandbox' ? 'bg-[#22d3ee]/20 text-[#22d3ee] shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'hover:text-white text-[#94a3b8]'}`}
            >
              自由实验
            </button>
            <button 
              onClick={openChallengeMode}
              className={`px-3 py-1 rounded-md text-[13px] transition-all ${gameMode === 'challenge' ? 'bg-[#f43f5e]/20 text-[#f43f5e] shadow-[0_0_10px_rgba(244,63,94,0.2)]' : 'hover:text-white text-[#94a3b8]'}`}
            >
              任务挑战
            </button>
          </div>
          <button
            type="button"
            onClick={() => setAtlasOpen(true)}
            className="flex h-8 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-[13px] text-[#cbd5e1] transition-colors hover:border-[#22d3ee]/30 hover:bg-[#22d3ee]/10 hover:text-[#67e8f9]"
          >
            <BookOpen size={14} />
            <span>图鉴</span>
            <span className="font-mono text-[11px] text-[#67e8f9]">{unlockedDiscoveryCount}/{discoveryCards.length}</span>
          </button>
          </div>
          <div className="flex items-center gap-6 text-[14px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-[9999px] bg-[#10b981]"></span>
              <span>安全</span>
            </div>
            <div className="font-mono text-[14px]">温度: 22°C</div>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex gap-3 min-h-0 w-full mt-3 px-3 relative">
          
          {/* LEFT SIDEBAR - Desktop (Fixed) & Tablet (Collapsed/Overlay) */}
          <aside className={`h-full flex flex-col shrink-0 transition-all duration-250 ease-out z-30 ${isTablet ? (sidebarOpen ? 'absolute left-3 top-0 bottom-0 w-[260px] glass-panel shadow-2xl p-4 pointer-events-auto' : 'absolute left-3 top-0 bottom-0 w-0 overflow-hidden p-0 pointer-events-none') : 'w-[260px] glass-panel p-4'}`}>
            <div className={`flex items-center justify-between mb-4 ${isTablet && !sidebarOpen ? 'opacity-0' : 'opacity-100'}`}>
              <h2 className="text-[#e2e8f0] text-[16px] font-semibold">{gameMode === 'challenge' ? '可用器材' : '器材库'}</h2>
              <button 
                className={`text-[#94a3b8] hover:text-[#e2e8f0] transition-colors ${!isTablet && 'hidden'}`}
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
            
            <div className={`flex-1 overflow-y-auto space-y-0 pb-4 -mx-4 px-4 ${isTablet && !sidebarOpen ? 'opacity-0' : 'opacity-100'}`}>
              <EquipmentCard onDragEnd={(e, i) => handleDragEnd(e, i, 'beaker', '烧杯')} icon={<Beaker size={20} />} name="烧杯" subtitle="250ml" collapsed={isTablet && !sidebarOpen} />
              <EquipmentCard onDragEnd={(e, i) => handleDragEnd(e, i, 'glassrod', '玻璃棒')} icon={<PenTool size={20} />} name="玻璃棒" subtitle="搅拌" collapsed={isTablet && !sidebarOpen} />
              <EquipmentCard onDragEnd={(e, i) => handleDragEnd(e, i, 'testtube', '试管')} icon={<TestTube size={20} />} name="试管" subtitle="20mL" collapsed={isTablet && !sidebarOpen} />
              {gameMode !== 'challenge' && (
                <>
                  <EquipmentCard onDragEnd={(e, i) => handleDragEnd(e, i, 'flask', '锥形瓶')} icon={<FlaskConical size={20} />} name="锥形瓶" subtitle="500ml" state="hover" collapsed={isTablet && !sidebarOpen} />
                  <EquipmentCard onDragEnd={(e, i) => handleDragEnd(e, i, 'flame', '酒精灯')} icon={<Flame size={20} />} name="酒精灯" subtitle="加热装备" collapsed={isTablet && !sidebarOpen} />
                  <EquipmentCard onDragEnd={(e, i) => handleDragEnd(e, i, 'burette', '滴定管')} icon={<Blend size={20} />} name="滴定管" subtitle="50mL 精密" collapsed={isTablet && !sidebarOpen} />
                  <EquipmentCard dragType="funnel" onDragEnd={(e, i) => handleDragEnd(e, i, 'funnel', '过滤漏斗')} icon={<FlaskConical size={20} className="rotate-180" />} name="过滤漏斗" subtitle="固液分离" collapsed={isTablet && !sidebarOpen} />
                  <EquipmentCard onDragEnd={(e, i) => handleDragEnd(e, i, 'tube', '蒸馏管')} icon={<Cable size={20} />} name="蒸馏导管" subtitle="连接容器" collapsed={isTablet && !sidebarOpen} />
                  <EquipmentCard onDragEnd={(e, i) => handleDragEnd(e, i, 'testtubes', '试管架')} icon={<TestTubes size={20} />} name="试管架" subtitle="6 孔" collapsed={isTablet && !sidebarOpen} />
                  <EquipmentCard onDragEnd={(e, i) => handleDragEnd(e, i, 'pipette', '移液管')} icon={<Pipette size={20} />} name="移液管" subtitle="10ml 刻度" collapsed={isTablet && !sidebarOpen} />
                </>
              )}
            </div>
          </aside>

          {/* Overlay backdrop when sidebar is open on tablet */}
          {isTablet && sidebarOpen && (
            <div 
              className="absolute inset-0 bg-black/50 z-20 backdrop-blur-[4px] rounded-[16px]"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* CENTER WORKSPACE */}
          <section
            ref={workspaceRef}
            className="flex-1 h-full relative rounded-[16px] overflow-hidden flex flex-col items-center justify-center z-0 workspace-canvas shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.05)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[rgba(30,41,59,0.3)] to-transparent">
            
            {/* Grid Background Overlay for scientific feel */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPHBhdGggZD0iTTAgNDBoNDBNNDAgMHY0MCIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz4KPC9zdmc+')] opacity-50 pointer-events-none" />
            
            {/* Ambient Lighting */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

            {dragGuide && (
              <div className="absolute inset-0 z-[25] pointer-events-none flex items-center justify-center">
                <div
                  className={`absolute inset-3 rounded-[18px] border-2 transition-all duration-150 ${dragGuide.inWorkspace ? 'border-[#22d3ee]/70 shadow-[inset_0_0_40px_rgba(34,211,238,0.12),0_0_25px_rgba(34,211,238,0.12)]' : 'border-white/8'}`}
                />
                <div className={`px-4 py-2 rounded-full border backdrop-blur-md text-[13px] font-medium transition-all duration-150 ${dragGuide.inWorkspace ? 'border-[#22d3ee]/40 bg-[#0a0e1a]/75 text-[#22d3ee]' : 'border-white/10 bg-[#0a0e1a]/70 text-[#94a3b8]'}`}>
                  {dragGuide.message ?? (dragGuide.kind === 'equipment'
                    ? (dragGuide.inWorkspace ? `释放以放置器材：${dragGuide.name}` : `将器材拖入中央实验台：${dragGuide.name}`)
                    : dragGuide.targetId
                    ? `释放以加入容器：${placedItems.find(item => item.id === dragGuide.targetId)?.name || dragGuide.name}`
                    : '将试剂拖到烧杯、锥形瓶、试管或滴定管上')}
                </div>
              </div>
            )}
            
            {/* Global Undo Button and Thermo Chart */}
            <div className="absolute bottom-4 left-4 z-[9999] flex flex-col items-start gap-2 pointer-events-none max-w-[220px]">
              {isTablet && !sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="glass-panel px-3 py-1.5 flex items-center gap-1.5 text-[12px] text-[#94a3b8] hover:text-[#22d3ee] transition-all hover:shadow-[0_0_10px_rgba(34,211,238,0.2)] pointer-events-auto"
                >
                  <Menu size={14} />
                  <span>器材库</span>
                </button>
              )}

              <button 
                onClick={undo}
                className="glass-panel px-3 py-1.5 flex items-center gap-1.5 text-[12px] text-[#94a3b8] hover:text-[#22d3ee] transition-all hover:shadow-[0_0_10px_rgba(34,211,238,0.2)] disabled:opacity-30 disabled:hover:shadow-none pointer-events-auto"
                disabled={history.length === 0}
              >
                <RotateCcw size={14} />
                  <span>撤销</span>
              </button>
              
              <ThermoChart 
                temperatureHistory={temperatureHistory}
                isOpen={isThermoChartOpen}
                setIsOpen={setIsThermoChartOpen}
                onExport={handleExportData}
              />

              {(placedItems.length > 0 || brokenGlass.length > 0) && (
                <button
                  onClick={clearWorkspace}
                  className="glass-panel px-3 py-1.5 flex items-center gap-1.5 text-[12px] text-[#f43f5e] hover:text-[#fb7185] transition-all hover:shadow-[0_0_10px_rgba(244,63,94,0.18)] pointer-events-auto"
                >
                  <X size={14} />
                  <span>清空</span>
                </button>
              )}
            </div>

            <DashboardReadouts focusedLabel={focusedContainerLabel} boilingPoint={focusedBoilingPoint} phaseLabel={focusedPhaseLabel} pressure={focusedPressure} />

            {/* Challenge HUD */}
            {gameMode === 'challenge' && activeChallenge && challengeInsight && (
              <div className="absolute left-1/2 top-[210px] z-[55] w-[min(840px,calc(100%-32px))] -translate-x-1/2 overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(7,11,23,0.84)] shadow-[0_22px_70px_rgba(2,6,23,0.46)] backdrop-blur-2xl xl:top-[146px]">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#22d3ee]/55 to-transparent" />
                <div className="grid gap-3 p-3 md:grid-cols-[1.15fr_1fr]">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                          <span>{activeMissionBrief?.family || '任务'}</span>
                          <span className="rounded-full border border-[#22d3ee]/22 bg-[#22d3ee]/10 px-2 py-0.5 tracking-normal text-[#67e8f9]">
                            {challengeDisplayDoneCount}/{Math.max(1, challengeDisplayStepCount)}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-[16px] font-semibold text-white">{activeChallenge.title}</div>
                      </div>
                      <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[11px] text-[#cbd5e1]">
                        {activeMissionBrief?.signal || challengeInsight.progressLabel}
                      </div>
                    </div>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] via-[#f43f5e] to-[#a855f7] transition-all duration-500" style={{ width: `${(challengeDisplayDoneCount / Math.max(1, challengeDisplayStepCount)) * 100}%` }} />
                    </div>

                    <div
                      className="mt-3 grid gap-1.5 overflow-x-auto pb-1"
                      style={{ gridTemplateColumns: `repeat(${Math.max(1, challengeStepLabels.length)}, minmax(58px, 1fr))` }}
                    >
                      {challengeStepLabels.map((label, index) => {
                        const stepDone = index < challengeStepCount
                          ? (challengeInsight.checklist[index]?.done || activeChallenge.completed)
                          : (activeMissionProof?.checkpoints[index - challengeStepCount]
                              ? Boolean(activeProofAnswers[activeMissionProof.checkpoints[index - challengeStepCount].id]?.correct)
                              : false) || activeChallenge.completed;
                        return (
                          <div
                            key={`${label}-${index}`}
                            className={`rounded-2xl border px-2.5 py-2 transition-colors ${stepDone ? 'border-[#10b981]/24 bg-[#10b981]/10 text-[#bbf7d0]' : index === challengeDisplayDoneCount ? 'border-[#22d3ee]/26 bg-[#22d3ee]/10 text-[#a5f3fc]' : 'border-white/8 bg-white/[0.025] text-[#94a3b8]'}`}
                          >
                            <div className="text-[10px] font-semibold">{stepDone ? '✓' : String(index + 1).padStart(2, '0')}</div>
                            <div className="mt-0.5 truncate text-[11px] font-semibold">{label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-white/8 bg-black/16 p-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#f43f5e] shadow-[0_0_18px_rgba(244,63,94,0.75)]" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] leading-snug text-[#fce7f3]">
                          {challengeProductReady && activeMissionProof && !activeProofSolved && !activeChallenge.completed ? '现象已出现，完成证据链。' : challengeInsight.nextHint}
                        </div>
                        {activeMissionBrief?.branch && (
                          <div className="mt-1 truncate text-[11px] text-[#64748b]">{activeMissionBrief.branch}</div>
                        )}
                      </div>
                    </div>

                    {!activeChallenge.completed ? (
                      challengeProductReady && activeMissionProof && activeProofCurrent && !activeProofSolved ? (
                        <div className="mt-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[11px] font-semibold text-[#e2e8f0]">
                              {activeProofCurrent.question}
                            </div>
                            <div className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-0.5 text-[10px] font-semibold text-[#94a3b8]">
                              证据 {activeProofSolvedCount + 1}/{activeMissionProof.checkpoints.length}
                            </div>
                          </div>
                          <div className="mb-2 flex flex-wrap gap-1">
                            {activeMissionProof.checkpoints.map((checkpoint, checkpointIndex) => {
                              const checkpointDone = Boolean(activeProofAnswers[checkpoint.id]?.correct);
                              const checkpointCurrent = checkpoint.id === activeProofCurrent.id;
                              return (
                                <span
                                  key={checkpoint.id}
                                  className={`rounded-full border px-2 py-0.5 text-[10px] ${checkpointDone ? 'border-[#10b981]/25 bg-[#10b981]/10 text-[#bbf7d0]' : checkpointCurrent ? 'border-[#22d3ee]/28 bg-[#22d3ee]/10 text-[#a5f3fc]' : 'border-white/8 bg-white/[0.025] text-[#64748b]'}`}
                                >
                                  {checkpointDone ? '✓' : checkpointIndex + 1} {checkpoint.label}
                                </span>
                              );
                            })}
                          </div>
                          <div className="grid gap-1.5">
                            {activeProofCurrent.options.map(option => {
                              const isSelected = activeProofCurrentAnswer?.selectedId === option.id;
                              const isWrong = isSelected && activeProofCurrentAnswer?.correct === false;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => setMissionProofAnswers(prev => ({
                                    ...prev,
                                    [activeChallenge.id]: {
                                      ...(prev[activeChallenge.id] || {}),
                                      [activeProofCurrent.id]: { selectedId: option.id, correct: option.id === activeProofCurrent.answerId },
                                    },
                                  }))}
                                  className={`rounded-2xl border px-3 py-2 text-left transition-colors ${isWrong ? 'border-[#f43f5e]/35 bg-[#f43f5e]/10' : isSelected ? 'border-[#10b981]/35 bg-[#10b981]/10' : 'border-white/8 bg-white/[0.035] hover:border-[#22d3ee]/30 hover:bg-[#22d3ee]/8'}`}
                                >
                                  <div className="text-[12px] font-semibold text-[#f8fafc]">{option.label}</div>
                                  <div className="mt-0.5 text-[10px] text-[#94a3b8]">{option.detail}</div>
                                </button>
                              );
                            })}
                          </div>
                          {activeProofCurrentAnswer?.correct === false && (
                            <div className="mt-2 text-[11px] text-[#fda4af]">证据不匹配，再看现象。</div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {challengeActionOptions.map(option => (
                            <button
                              key={option.name}
                              type="button"
                              onClick={() => {
                                addReagentToContainer(primaryAgentContainerId || '', option.name, option.volume);
                              }}
                              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all hover:-translate-y-0.5 ${option.tone === 'next' ? 'border-[#22d3ee]/42 bg-[#22d3ee]/14 text-[#a5f3fc] shadow-[0_0_20px_rgba(34,211,238,0.14)]' : option.tone === 'main' ? 'border-white/12 bg-white/[0.055] text-[#e2e8f0] hover:border-white/20' : 'border-[#f59e0b]/26 bg-[#f59e0b]/8 text-[#fde68a] hover:bg-[#f59e0b]/14'}`}
                            >
                              <span className="mr-1 opacity-70">{option.label}</span>
                              {option.name.replace('指示剂', '')}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              if (primaryAgentContainerId) {
                                showInlineContainerHint({
                                  targetId: primaryAgentContainerId,
                                  title: '观察',
                                  detail: challengeInsight.nextHint,
                                  tone: 'info',
                                });
                              }
                              showToast('已观察当前状态');
                            }}
                            className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[11px] font-semibold text-[#cbd5e1] transition-all hover:-translate-y-0.5 hover:border-white/20"
                          >
                            观察
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setAtlasOpen(true)}
                          className="rounded-full border border-[#22d3ee]/35 bg-[#22d3ee]/12 px-3 py-1.5 text-[11px] font-semibold text-[#a5f3fc] hover:bg-[#22d3ee]/20 transition-colors"
                        >
                          查看图鉴
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextPreset = getNextMissionPreset(activeChallenge.id);
                            launchQuickStart(nextPreset);
                            showToast(`下一关：${MISSION_BRIEFS[nextPreset].title}`);
                          }}
                          className="rounded-full border border-[#f43f5e]/35 bg-[#f43f5e]/12 px-3 py-1.5 text-[11px] font-semibold text-[#fda4af] hover:bg-[#f43f5e]/20 transition-colors"
                        >
                          下一关
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <AnimatePresence>
              {reactionSpotlight && (
                <motion.div
                  key={reactionSpotlight.id}
                  initial={{ opacity: 0, scale: 0.86, y: 24 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -18 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="pointer-events-none absolute left-1/2 top-[45%] z-[120] w-[min(360px,calc(100%-40px))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/14 bg-[rgba(7,11,23,0.86)] px-5 py-4 text-center shadow-[0_28px_70px_rgba(2,6,23,0.55)] backdrop-blur-2xl"
                >
                  <div className="mx-auto mb-3 h-3 w-16 rounded-full" style={{ backgroundColor: reactionSpotlight.accent, boxShadow: `0 0 34px ${reactionSpotlight.accent}` }} />
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#67e8f9]">发现现象</div>
                  <div className="mt-1 text-[18px] font-semibold text-white">{reactionSpotlight.title}</div>
                  <div className="mt-2 truncate font-mono text-[12px] text-[#94a3b8]">{reactionSpotlight.detail}</div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {missionCompletionCard && (
                <motion.div
                  key={missionCompletionCard.id}
                  initial={{ opacity: 0, y: 30, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 18, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                  className="absolute bottom-6 left-1/2 z-[130] w-[min(420px,calc(100%-40px))] -translate-x-1/2 rounded-[28px] border border-white/14 bg-[rgba(8,13,24,0.92)] p-4 shadow-[0_28px_70px_rgba(2,6,23,0.56)] backdrop-blur-2xl"
                >
                  <button
                    type="button"
                    aria-label="关闭完成卡片"
                    onClick={() => setMissionCompletionCard(null)}
                    className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#94a3b8] hover:text-white"
                  >
                    <X size={14} />
                  </button>
                  <div className="pr-8">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#67e8f9]">关卡完成</div>
                    <div className="mt-1 text-[17px] font-semibold text-white">{missionCompletionCard.title}</div>
                  </div>
                  <div className="mt-4 flex items-center gap-3 rounded-[22px] border border-white/8 bg-white/[0.035] px-3 py-3">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06] font-mono text-[13px] font-bold text-white"
                      style={{ boxShadow: `0 0 30px ${missionCompletionCard.accent}` }}
                    >
                      {missionCompletionCard.formula}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[#f8fafc]">{missionCompletionCard.product}</div>
                      <div className="mt-1 text-[12px] text-[#94a3b8]">已解锁图鉴，可继续下一关。</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setAtlasOpen(true)}
                      className="rounded-2xl border border-[#22d3ee]/30 bg-[#22d3ee]/10 px-3 py-2 text-[12px] font-semibold text-[#a5f3fc] hover:bg-[#22d3ee]/16 transition-colors"
                    >
                      查看图鉴
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMissionCompletionCard(null);
                        submitAgentQuery('请用三行解释刚才的现象：现象、原因、下一步。');
                      }}
                      className="rounded-2xl border border-[#10b981]/30 bg-[#10b981]/10 px-3 py-2 text-[12px] font-semibold text-[#bbf7d0] hover:bg-[#10b981]/16 transition-colors"
                    >
                      问拉瓦锡
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextPreset = getNextMissionPreset(missionCompletionCard.challengeId);
                        launchQuickStart(nextPreset);
                        showToast(`下一关：${MISSION_BRIEFS[nextPreset].title}`);
                      }}
                      className="rounded-2xl border border-[#f43f5e]/30 bg-[#f43f5e]/10 px-3 py-2 text-[12px] font-semibold text-[#fda4af] hover:bg-[#f43f5e]/16 transition-colors"
                    >
                      下一关
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Smart Toasts */}
            <AnimatePresence>
              {toast && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`absolute left-1/2 -translate-x-1/2 px-6 py-3 rounded-full glass-panel shadow-lg border border-[#f59e0b]/30 z-[300] flex items-center justify-center pointer-events-none ${gameMode === 'challenge' ? (isTablet ? 'top-[240px]' : 'top-[212px] xl:top-[168px]') : 'top-[158px] md:top-[118px] xl:top-[80px]'}`}
                >
                  <span className="text-[#f59e0b] font-medium text-[14px] drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">
                    {toast.message}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {discoveryToast && (
                <motion.div
                  key={discoveryToast.id}
                  initial={{ opacity: 0, y: 22, scale: 0.86 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                  className="absolute left-1/2 top-[72px] z-[310] w-[260px] -translate-x-1/2 rounded-[24px] border border-white/12 bg-[rgba(7,11,23,0.9)] px-4 py-3 text-center shadow-[0_24px_60px_rgba(2,6,23,0.48)] backdrop-blur-2xl pointer-events-none"
                >
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] font-mono text-[13px] font-bold text-white" style={{ boxShadow: `0 0 28px ${discoveryToast.accent}` }}>
                    {discoveryToast.formula}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#67e8f9]">发现新现象</div>
                  <div className="mt-1 text-[14px] font-semibold text-[#f8fafc]">{discoveryToast.title}</div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">已加入反应图鉴</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Floating Holographic Equations */}
            <AnimatePresence>
              {equations.map(eq => (
                <motion.div
                  key={eq.id}
                  initial={{ opacity: 0, y: eq.y + 40, x: "-50%", scale: 0.8 }}
                  animate={{ opacity: 1, y: eq.y, x: "-50%", scale: 1 }}
                  exit={{ opacity: 0, y: eq.y - 20, x: "-50%", scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="fixed flex items-center justify-center pointer-events-none z-[9999]"
                  style={{ left: '50%', top: 0 }}
                >
                  <div className="px-6 py-3 glass-panel border-[#22d3ee]/60 bg-[#0a0e1a]/80 shadow-[0_0_40px_rgba(34,211,238,0.4)] flex items-center">
                    <span 
                      className="text-[#22d3ee] text-[18px] drop-shadow-[0_0_12px_rgba(34,211,238,1)] font-bold tracking-wider whitespace-nowrap"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {eq.text}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Volume Control Modal Overlay */}
            <AnimatePresence>
              {activeDrop && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-[16px]"
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="glass-panel p-6 w-[320px] flex flex-col items-center shadow-2xl border border-[rgba(34,211,238,0.3)] bg-[#0a0e1a]/80"
                  >
                    <Droplets size={32} className="text-[#22d3ee] mb-4" />
                    <h3 className="text-[#e2e8f0] text-[18px] font-medium mb-1">加入 {activeDrop.reagentName}</h3>
                    <p className="text-[#94a3b8] text-[13px] mb-6">请调节倒入的毫升数 (mL)</p>
                    
                    <div className="w-full flex items-center justify-between mb-2">
                      <span className="text-[#475569] text-[12px] font-mono">1mL</span>
                      <span className="text-[#22d3ee] text-[24px] font-mono font-bold drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">{dropVolume}mL</span>
                      <span className="text-[#475569] text-[12px] font-mono">{activeDrop.maxAdd}mL</span>
                    </div>
                    
                    <input 
                      type="range" 
                      min="1" 
                      max={activeDrop.maxAdd}
                      value={dropVolume}
                      onChange={(e) => setDropVolume(Number(e.target.value))}
                      className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#22d3ee] mb-8"
                    />
                    
                    <div className="flex w-full gap-3">
                      <button 
                        onClick={handleCancelDrop}
                        className="flex-1 py-2.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[#94a3b8] hover:bg-white/5 transition-colors"
                      >
                        取消
                      </button>
                      <button 
                        onClick={handleConfirmDrop}
                        className="flex-1 py-2.5 rounded-lg bg-[#22d3ee] text-[#0a0e1a] font-medium hover:bg-[#22d3ee]/90 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all"
                      >
                        倒入
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {placedItems.length === 0 && brokenGlass.length === 0 && gameMode === 'challenge' ? (
              <div className="absolute inset-0 z-[20] flex w-full flex-col items-center overflow-y-auto px-4 pb-6 pt-[216px] xl:pt-[156px]">
                <div className={`mb-4 min-h-[224px] w-full overflow-hidden rounded-[28px] border border-white/8 bg-[rgba(7,11,23,0.62)] backdrop-blur-2xl ${isTablet ? 'pl-24' : ''}`}>
                  <div className="grid gap-0 md:grid-cols-[0.95fr_1.35fr]">
                    <div className="relative min-h-[158px] border-b border-white/8 p-5 md:border-b-0 md:border-r">
                      <div className="absolute -left-16 -top-16 h-44 w-44 rounded-full bg-[#22d3ee]/12 blur-3xl" />
                      <div className="relative">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#64748b]">样品线索</div>
                        <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-white">未知样品库</div>
                        <div className="mt-3 flex items-end gap-3">
                          <div className="font-mono text-[34px] font-bold leading-none text-[#67e8f9]">{completedMissionCount}/{MISSION_SEQUENCE.length}</div>
                          <div className="pb-1 text-[12px] text-[#94a3b8]">已完成</div>
                        </div>
                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] via-[#f43f5e] to-[#a855f7] transition-all duration-500" style={{ width: `${(completedMissionCount / MISSION_SEQUENCE.length) * 100}%` }} />
                        </div>
                        <button
                          type="button"
                          onClick={() => launchQuickStart('prepCu')}
                          className="mt-5 rounded-full border border-[#22d3ee]/35 bg-[#22d3ee]/12 px-4 py-2 text-[12px] font-semibold text-[#a5f3fc] transition-all hover:-translate-y-0.5 hover:bg-[#22d3ee]/20"
                        >
                          开始推荐演示
                        </button>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="grid grid-cols-6 gap-2">
                        {MISSION_SEQUENCE.map((preset, index) => {
                          const mission = MISSION_BRIEFS[preset];
                          const isMissionDone = completedMissionIds.has(mission.challengeId);
                          return (
                            <button
                              key={`rail-${mission.challengeId}`}
                              type="button"
                              onClick={() => launchQuickStart(mission.preset)}
                              className={`group flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-2xl border transition-all hover:-translate-y-0.5 ${isMissionDone ? 'border-[#10b981]/26 bg-[#10b981]/10 text-[#bbf7d0]' : 'border-white/8 bg-white/[0.025] text-[#94a3b8] hover:border-[#22d3ee]/28 hover:text-[#a5f3fc]'}`}
                            >
                              <span className="font-mono text-[12px] font-semibold">{isMissionDone ? '✓' : String(index + 1).padStart(2, '0')}</span>
                              <span className="max-w-full truncate px-1 text-[10px]">{mission.signal}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-[#64748b]">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-2">沉淀</div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-2">显色</div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-2">分层/褪色</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`grid w-full grid-cols-1 gap-3 md:grid-cols-3 ${isTablet ? 'pl-24' : ''}`}>
                  {MISSION_SEQUENCE.map((preset, index) => {
                    const mission = MISSION_BRIEFS[preset];
                    const accent = getMissionAccentClasses(mission.accent);
                    const isMissionDone = completedMissionIds.has(mission.challengeId);
                    return (
                      <motion.button
                        key={mission.title}
                        type="button"
                        onClick={() => mission.preset && launchQuickStart(mission.preset)}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.985 }}
                        className={`group relative min-h-[176px] overflow-hidden rounded-[26px] border bg-[rgba(7,11,23,0.66)] p-4 text-left backdrop-blur-xl transition-colors duration-200 hover:bg-[rgba(15,23,42,0.76)] ${isMissionDone ? 'border-[#10b981]/28 shadow-[0_0_24px_rgba(16,185,129,0.10)]' : accent.ring}`}
                      >
                        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-50 blur-2xl transition-opacity group-hover:opacity-80" style={{ backgroundColor: isMissionDone ? '#10b981' : MISSION_SUCCESS_META[mission.challengeId]?.accent }} />
                        <div className={`absolute right-4 top-4 flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-bold ${isMissionDone ? 'border border-[#10b981]/30 bg-[#10b981]/12 text-[#86efac]' : accent.dot}`}>
                          {isMissionDone ? '✓' : String(index + 1).padStart(2, '0')}
                        </div>
                        <div className="relative pr-9">
                          <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                            <span>{mission.family}</span>
                            <span className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-0.5 tracking-normal text-[#94a3b8]">
                              证据链 {MISSION_PROOFS[mission.challengeId]?.checkpoints.length || 0}
                            </span>
                            {index === 0 && (
                              <span className="rounded-full border border-[#22d3ee]/22 bg-[#22d3ee]/10 px-2 py-0.5 tracking-normal text-[#67e8f9]">推荐</span>
                            )}
                            {isMissionDone && (
                              <span className="rounded-full border border-[#10b981]/22 bg-[#10b981]/10 px-2 py-0.5 tracking-normal text-[#86efac]">已完成</span>
                            )}
                          </div>
                          <div className="text-[16px] font-semibold text-[#f8fafc]">{mission.title}</div>
                          <div className="mt-2 text-[13px] font-medium text-[#cbd5e1]">{mission.signal}</div>

                          <div className="mt-4 flex items-center gap-1.5">
                            {mission.route.map((step, stepIndex) => (
                              <div key={step} className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate rounded-full border border-white/8 bg-white/[0.035] px-2 py-1 text-[10px] text-[#cbd5e1]">{step}</span>
                                {stepIndex < mission.route.length - 1 && <span className="text-[#475569]">→</span>}
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {mission.reagents.slice(0, 4).map(reagent => (
                              <span key={reagent} className="rounded-full border border-white/8 bg-black/14 px-2 py-1 text-[10px] text-[#94a3b8]">
                                {reagent.replace('指示剂', '')}
                              </span>
                            ))}
                          </div>

                          <div className="mt-5 flex items-center justify-between gap-3">
                            <span className="truncate text-[11px] text-[#64748b]">{mission.branch}</span>
                            <span className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${isMissionDone ? 'border-[#10b981]/30 bg-[#10b981]/10 text-[#bbf7d0] hover:bg-[#10b981]/16' : accent.button}`}>{isMissionDone ? '再试' : '开始'}</span>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ) : placedItems.length === 0 && brokenGlass.length === 0 ? (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.03] bg-white/[0.015]" />
                <div className="absolute left-1/2 top-1/2 h-px w-44 -translate-x-1/2 bg-white/[0.035]" />
                <div className="absolute left-1/2 top-1/2 h-44 w-px -translate-y-1/2 bg-white/[0.035]" />
              </div>
            ) : (
              <>
                {brokenGlass.map(bg => (
                  <BrokenGlass key={bg.id} x={bg.x} y={bg.y} color={bg.color} width={120} />
                ))}
                
                {placedItems.filter(i => i.type === 'tube').map(tube => {
                  // Find nearest boiling container
                  const sources = placedItems.filter(i => i.type === 'flask' || i.type === 'beaker');
                  if (sources.length < 2) return null;
                  
                  // Simple heuristic: Source is the left-most container, target is the right-most, or based on distance
                  // Let's just find the closest 2 containers to the tube's center
                  const sorted = [...sources].sort((a, b) => {
                     const distA = Math.pow(a.x - tube.x, 2) + Math.pow(a.y - tube.y, 2);
                     const distB = Math.pow(b.x - tube.x, 2) + Math.pow(b.y - tube.y, 2);
                     return distA - distB;
                  });
                  
                  const source = sorted[0];
                  const target = sorted[1];
                  
                  const isBoiling = source?.state?.includes('gas_boil') || false;
                  
                  return (
                    <DistillationSetup 
                      key={`setup-${tube.id}`}
                      startX={source.x} 
                      startY={source.y - 70} 
                      endX={target.x} 
                      endY={target.y - 40} 
                      isBoiling={isBoiling} 
                      activeColor={getChemColor(source.chemState)}
                    />
                  );
                })}

                {placedItems.map(item => (
              <motion.div
                key={item.id}
                onPointerEnter={() => setHoveredItemId(item.id)}
                onPointerLeave={() => setHoveredItemId(null)}
                onPointerDown={(e) => {
                  const interactiveTarget = (e.target as HTMLElement | null)?.closest('[data-interactive="true"], button, input, textarea, select, label');
                  if (interactiveTarget) {
                    return;
                  }

                  e.stopPropagation();
                  
                  // Move item to front
                  setPlacedItems(current => {
                    const idx = current.findIndex(i => i.id === item.id);
                    if (idx < 0) return current;
                    const newArr = [...current];
                    const [removed] = newArr.splice(idx, 1);
                    newArr.push(removed);
                    return newArr;
                  });

                  if (item.type === 'beaker' || item.type === 'flask' || item.type === 'testtube') {
                    setFocusedItemId(item.id);
                    syncReadouts(item.chemState);
                  }

                  const targetElement = e.currentTarget as HTMLDivElement;
                  targetElement.setPointerCapture(e.pointerId);

                  const startX = e.clientX;
                  const startY = e.clientY;
                  const initialX = item.x;
                  const initialY = item.y;
                  let lastX = startX;
                  let lastY = startY;
                  let lastTime = Date.now();
                  let velocity = { x: 0, y: 0 };
                  
                  // Visual feedback
                  targetElement.style.zIndex = '100';
                  targetElement.style.cursor = 'grabbing';
                  targetElement.style.filter = 'brightness(1.1) drop-shadow(0 15px 20px rgba(0,0,0,0.3))';
                  targetElement.style.transform = 'scale(1.05)';

                  // Add boundary constraints for dragging so items don't get lost off-screen
                  const workspaceRect = workspaceRef.current?.getBoundingClientRect();

                    const onPointerMove = (moveEvent: React.PointerEvent<HTMLDivElement> | PointerEvent) => {
                    moveEvent.preventDefault();
                    const dx = moveEvent.clientX - startX;
                    const dy = moveEvent.clientY - startY;
                    
                    let newX = initialX + dx;
                    let newY = initialY + dy;
                    
                    // Simple boundary clamping
                    if (workspaceRect) {
                      newX = Math.max(0, Math.min(workspaceRect.width - 50, newX));
                      newY = Math.max(0, Math.min(workspaceRect.height - 50, newY));
                    }
                    
                    const currentTime = Date.now();
                    const dt = currentTime - lastTime;
                    if (dt > 0) {
                      velocity = {
                        x: ((moveEvent.clientX - lastX) / dt) * 1000,
                        y: ((moveEvent.clientY - lastY) / dt) * 1000
                      };
                    }
                    lastX = moveEvent.clientX;
                    lastY = moveEvent.clientY;
                    lastTime = currentTime;
                    
                    setPlacedItems(current => {
                       // Calculate if pipettes or phmeters are dipped into something
                       let updatedChemState = item.chemState;
                       const movingItem = current.find(i => i.id === item.id) || item;
                       if (movingItem.type === 'funnel') {
                         const target = getClosestFunnelTarget(current.filter(i => i.id !== movingItem.id), newX, newY);
                         setDragGuide({
                           kind: 'equipment',
                           type: 'funnel',
                           name: movingItem.name,
                           inWorkspace: true,
                           targetId: target?.id || null,
                           message: target ? `释放以将漏斗挂载到：${target.name}` : '将漏斗拖到烧杯、锥形瓶或试管上方',
                         });
                       } else if (LIQUID_CONTAINER_TYPES.has(movingItem.type)) {
                         const guide = getContainerDragGuide(current, { ...movingItem, x: newX, y: newY });
                         setDragGuide({
                           kind: 'equipment',
                           type: movingItem.type,
                           name: movingItem.name,
                           inWorkspace: true,
                           targetId: guide.targetId,
                           message: guide.message,
                         });
                       } else {
                         setDragGuide(null);
                       }
                       if (item.type === 'phmeter') {
                         const container = current.find(c => (c.type === 'beaker' || c.type === 'flask' || c.type === 'testtube') && Math.sqrt(Math.pow(c.x - newX, 2) + Math.pow(c.y - (newY + 60), 2)) < 50);
                         if (container) {
                           updatedChemState = container.chemState;
                         } else {
                           updatedChemState = createEmptyState(); // Air / clean
                         }
                       }

                       // If moving a rack, move all its attached test tubes
                       if (item.type === 'testtubes') {
                         return current.map(i => {
                           if (i.id === item.id) return { ...i, x: newX, y: newY, velocity };
                           if (i.type === 'testtube' && i.rackId === item.id && i.rackSlot !== undefined) {
                             const slotXOffset = (i.rackSlot - 2.5) * (180 / 6);
                             return { ...i, x: newX + slotXOffset, y: newY - 20, velocity };
                           }
                           return i;
                         });
                       } else {
                         return current.map(i => {
                           if (i.id === item.id) {
                             // If moving a testtube, detach it from rack
                             return { ...i, x: newX, y: newY, velocity, rackId: undefined, rackSlot: undefined, chemState: item.type === 'phmeter' ? updatedChemState : i.chemState };
                           }
                           return i;
                         });
                       }
                    });
                  };
                  
                  const onPointerUp = (upEvent: React.PointerEvent<HTMLDivElement> | PointerEvent) => {
                    targetElement.releasePointerCapture(upEvent.pointerId);
                    targetElement.removeEventListener('pointermove', onPointerMove);
                    targetElement.removeEventListener('pointerup', onPointerUp);
                    
                    targetElement.style.zIndex = '';
                    targetElement.style.cursor = 'grab';
                    targetElement.style.filter = '';
                    targetElement.style.transform = 'scale(1)';
                    setDragGuide(null);

                    const speed = Math.sqrt(velocity.x**2 + velocity.y**2);

                    if (speed > 5000 && (item.type === 'beaker' || item.type === 'flask' || item.type === 'testtube')) {
                      playSound('break', 0, item.id);
                      showToast("⚠️ 操作过于剧烈，容器破裂！");
                      
                      setPlacedItems(current => {
                        saveSnapshot(current, brokenGlass);
                        const currentItem = current.find(i => i.id === item.id);
                        if (currentItem) {
                          setBrokenGlass(prev => [...prev, { id: currentItem.id, x: currentItem.x, y: currentItem.y, color: getChemColor(currentItem.chemState) }]);
                        }
                        stopSound(item.id);
                        return current.filter(i => i.id !== item.id);
                      });
                      return;
                    }
                    
                    setPlacedItems(current => {
                      // Pipette drop interaction logic
                      if (item.type === 'pipette') {
                        const currentPipette = current.find(i => i.id === item.id);
                        if (currentPipette) {
                           // Find target container
                           const container = current.find(c => (c.type === 'beaker' || c.type === 'flask' || c.type === 'testtube') && Math.sqrt(Math.pow(c.x - currentPipette.x, 2) + Math.pow(c.y - (currentPipette.y + 40), 2)) < 50);
                           
                          if (container) {
                            if (getTotalLiquidVolume(currentPipette.chemState) > 0) {
                              // Empty pipette into container
                              const pipetteState = currentPipette.chemState;
                              const transferVol = getTotalLiquidVolume(pipetteState);
                              const capacity = getContainerCapacity(container.type);
                              if (getTotalLiquidVolume(container.chemState) + transferVol > capacity) {
                                showToast(`🚫 ${container.name} 容量不足，无法完成移液`);
                                return current;
                              }

                              saveSnapshot(current, brokenGlass);
                              playSound('pour');
                              const transferResult = mergeChemStates(container.chemState, pipetteState, currentPipette.name);
                              setTimeout(() => emitReactionOutcome(currentPipette.name, transferResult), 0);
                              return current.map(i => {
                                if (i.id === item.id) return { ...i, chemState: createEmptyState() };
                                if (i.id === container.id) {
                                  return {
                                    ...i,
                                    chemState: transferResult.newState,
                                    state: transferResult.reactionType,
                                    lastReactionTime: transferResult.reactionType !== 'added' ? Date.now() : i.lastReactionTime,
                                  };
                                }
                                return i;
                              });
                            } else if (getTotalLiquidVolume(container.chemState) > 0) {
                              // Fill pipette from container
                              const takeVol = Math.min(getContainerCapacity('pipette'), getTotalLiquidVolume(container.chemState));
                              const transferOptions = getPickupTransferOptions(container, currentPipette.y);
                              const { extractedState, remainingState, transferredVolume } = splitChemState(container.chemState, takeVol, transferOptions);
                              if (transferredVolume <= 0) return current;

                              saveSnapshot(current, brokenGlass);
                              playSound('pour');
                              return current.map(i => {
                                if (i.id === item.id) return { ...i, chemState: extractedState };
                                if (i.id === container.id) return { ...i, chemState: remainingState };
                                return i;
                              });
                            }
                          }
                        }
                      }

                      if (item.type === 'funnel') {
                        const currentFunnel = current.find(i => i.id === item.id);
                        if (!currentFunnel) return current;

                        const targetContainer = getClosestFunnelTarget(current.filter(i => i.id !== item.id), currentFunnel.x, currentFunnel.y);
                        if (!targetContainer) {
                          return current.map(i => i.id === item.id ? { ...i, linkedTargetId: undefined, velocity: { x: 0, y: 0 } } : i);
                        }

                        playSound('place');
                        return current.map(i => i.id === item.id ? {
                          ...i,
                          x: targetContainer.x,
                          y: targetContainer.y - (targetContainer.type === 'testtube' ? 84 : 102),
                          linkedTargetId: targetContainer.id,
                          velocity: { x: 0, y: 0 },
                        } : i);
                      }

                      if (LIQUID_CONTAINER_TYPES.has(item.type)) {
                        const sourceContainer = current.find(i => i.id === item.id);
                        if (sourceContainer) {
                          const activeFunnel = current.find(i => i.type === 'funnel' && i.linkedTargetId && i.linkedTargetId !== sourceContainer.id && Math.abs(i.x - sourceContainer.x) < 75 && sourceContainer.y < i.y + 42 && sourceContainer.y > i.y - 120);
                          const filterTarget = activeFunnel ? current.find(i => i.id === activeFunnel.linkedTargetId) : undefined;

                          if (activeFunnel && filterTarget) {
                            const remainingCapacity = getContainerCapacity(filterTarget.type) - getTotalLiquidVolume(filterTarget.chemState);
                            const requestedVolume = Math.min(
                              getTotalLiquidVolume(sourceContainer.chemState),
                              sourceContainer.type === 'testtube' ? 10 : 40,
                              Math.max(0, remainingCapacity),
                            );

                            if (requestedVolume > 0.05) {
                              const { extractedState, remainingState, transferredVolume } = splitChemState(sourceContainer.chemState, requestedVolume, {
                                preferredPhase: 'mixed',
                                solidMode: 'blocked',
                              });

                              if (transferredVolume > 0) {
                                saveSnapshot(current, brokenGlass);
                                playSound('pour');
                                showToast(`🧻 漏斗过滤：滤液流入 ${filterTarget.name}`);
                                const transferResult = mergeChemStates(filterTarget.chemState, extractedState, '过滤滤液');

                                if (focusedItemIdRef.current === filterTarget.id) {
                                  syncReadouts(transferResult.newState);
                                } else if (focusedItemIdRef.current === sourceContainer.id) {
                                  syncReadouts(remainingState);
                                }

                                setTimeout(() => emitReactionOutcome('过滤滤液', transferResult), 0);
                                return current.map(i => {
                                  if (i.id === sourceContainer.id) {
                                    return { ...i, chemState: remainingState, velocity: { x: 0, y: 0 } };
                                  }
                                  if (i.id === filterTarget.id) {
                                    return {
                                      ...i,
                                      chemState: transferResult.newState,
                                      state: transferResult.reactionType,
                                      lastReactionTime: transferResult.reactionType !== 'added' ? Date.now() : i.lastReactionTime,
                                    };
                                  }
                                  return i;
                                });
                              }
                            }
                          }

                          const directTarget = getClosestPourTarget(current, sourceContainer);
                          if (directTarget) {
                            const remainingCapacity = getContainerCapacity(directTarget.type) - getTotalLiquidVolume(directTarget.chemState);
                            const requestedVolume = Math.min(
                              getTotalLiquidVolume(sourceContainer.chemState),
                              sourceContainer.type === 'testtube' ? 12 : 60,
                              Math.max(0, remainingCapacity),
                            );

                            if (requestedVolume > 0.05) {
                              const transferOptions = getPourTransferOptions(sourceContainer);
                              const { extractedState, remainingState, transferredVolume } = splitChemState(sourceContainer.chemState, requestedVolume, transferOptions);

                              if (transferredVolume > 0) {
                                saveSnapshot(current, brokenGlass);
                                playSound('pour');
                                const transferLabel = transferOptions.solidMode === 'supernatant'
                                  ? '倾析上清液'
                                  : transferOptions.preferredPhase === 'top' && (sourceContainer.chemState.organicVolume || 0) > 1e-6 && (sourceContainer.chemState.volume || 0) > 1e-6
                                  ? '转移上层液相'
                                  : `${sourceContainer.name} 倾倒液体`;
                                showToast(`🫗 ${transferLabel} → ${directTarget.name}`);
                                const transferResult = mergeChemStates(directTarget.chemState, extractedState, transferLabel);

                                if (focusedItemIdRef.current === directTarget.id) {
                                  syncReadouts(transferResult.newState);
                                } else if (focusedItemIdRef.current === sourceContainer.id) {
                                  syncReadouts(remainingState);
                                }

                                setTimeout(() => emitReactionOutcome(transferLabel, transferResult), 0);
                                return current.map(i => {
                                  if (i.id === sourceContainer.id) {
                                    return { ...i, chemState: remainingState, velocity: { x: 0, y: 0 } };
                                  }
                                  if (i.id === directTarget.id) {
                                    return {
                                      ...i,
                                      chemState: transferResult.newState,
                                      state: transferResult.reactionType,
                                      lastReactionTime: transferResult.reactionType !== 'added' ? Date.now() : i.lastReactionTime,
                                    };
                                  }
                                  return i;
                                });
                              }
                            }
                          }
                        }
                      }

                      // Check if we dropped a test tube near a rack to lock it in
                      if (item.type === 'testtube') {
                         const currentItem = current.find(i => i.id === item.id);
                         if (currentItem) {
                           const rack = current.find(r => r.type === 'testtubes' && Math.sqrt(Math.pow(r.x - currentItem.x, 2) + Math.pow(r.y - currentItem.y, 2)) < 100);
                           if (rack) {
                              const slotIndex = Math.max(0, Math.min(5, Math.floor((currentItem.x - rack.x + 90) / (180 / 6))));
                              const slotXOffset = (slotIndex - 2.5) * (180 / 6);
                              playSound('place');
                              return current.map(i => {
                                if (i.id === item.id) return { ...i, velocity: { x: 0, y: 0 }, rackId: rack.id, rackSlot: slotIndex, x: rack.x + slotXOffset, y: rack.y - 20 };
                                return i;
                              });
                           }
                         }
                      }

                      return current.map(i => {
                        if (i.id === item.id) {
                          let newLastReactionTime = i.lastReactionTime;
                          if (speed > 200 && i.state?.includes('precipitate') && i.lastReactionTime) {
                            const timeSinceReaction = Date.now() - i.lastReactionTime;
                            if (timeSinceReaction > 2000) { 
                              newLastReactionTime = Date.now(); 
                            }
                          }
                          return { ...i, lastReactionTime: newLastReactionTime, velocity: { x: 0, y: 0 } };
                        }
                        return i;
                      });
                    });
                  };
                  
                  targetElement.addEventListener('pointermove', onPointerMove);
                  targetElement.addEventListener('pointerup', onPointerUp);
                }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }} 
                transition={{ type: "spring", stiffness: 800, damping: 50 }}
                className={`absolute flex flex-col items-center justify-center cursor-grab active:cursor-grabbing interactive-item ${item.type === 'testtube' && item.rackId ? 'z-[15]' : ''} ${item.type === 'testtubes' ? 'z-[10]' : ''} ${highlightedTargetId === item.id ? 'drop-shadow-[0_0_18px_rgba(34,211,238,0.6)]' : ''}`}
                style={{ 
                  left: item.x,
                  top: item.y,
                  marginLeft: item.type === 'testtubes' ? -90 : (item.type === 'testtube' ? -12 : (item.type === 'pipette' || item.type === 'phmeter' ? -16 : -45)), 
                  marginTop: item.type === 'testtubes' ? -40 : (item.type === 'testtube' ? -66 : (item.type === 'pipette' || item.type === 'phmeter' ? -80 : -60))
                }}
              >
                {highlightedTargetId === item.id && (
                  <div className="absolute -inset-3 rounded-[24px] border-2 border-[#22d3ee]/70 shadow-[0_0_24px_rgba(34,211,238,0.25)] pointer-events-none" />
                )}

                {/* Overlay an invisible drag handle that leaves child components clickable if needed */}
                <div className="absolute inset-0 z-0" />
                
                <div className="relative z-10 pointer-events-auto">
                  {renderPlacedIcon(item)}
                </div>
                
                {/* Holographic Trace Tooltip */}
                {(item.type === 'beaker' || item.type === 'flask' || item.type === 'testtube') && hoveredItemId === item.id && (
                   <HolographicTooltip x={item.type === 'testtube' ? 30 : 0} y={item.type === 'testtube' ? -60 : 0} chemState={item.chemState} visible={true} />
                )}

                {(() => {
                  const activeHint = inlineContainerFeedback?.targetId === item.id
                    ? inlineContainerFeedback
                    : dragTargetHint?.targetId === item.id
                    ? dragTargetHint
                    : null;

                  if (!activeHint || (item.type !== 'beaker' && item.type !== 'flask' && item.type !== 'testtube' && item.type !== 'burette')) {
                    return null;
                  }

                  const toneClass = activeHint.tone === 'success'
                    ? 'border-emerald-400/35 bg-[rgba(16,185,129,0.14)] text-emerald-100'
                    : activeHint.tone === 'warning'
                    ? 'border-amber-400/35 bg-[rgba(245,158,11,0.14)] text-amber-100'
                    : 'border-[#22d3ee]/35 bg-[rgba(34,211,238,0.14)] text-slate-100';
                  const titleClass = activeHint.tone === 'success'
                    ? 'text-emerald-300'
                    : activeHint.tone === 'warning'
                    ? 'text-amber-300'
                    : 'text-[#67e8f9]';

                  return (
                    <motion.div
                      key={`${item.id}-${activeHint.title}-${activeHint.detail}`}
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      className={`absolute left-1/2 -translate-x-1/2 pointer-events-none w-[190px] rounded-2xl border px-3 py-2 shadow-[0_18px_40px_rgba(2,6,23,0.35)] backdrop-blur-xl ${item.type === 'testtube' ? '-top-[118px]' : '-top-[96px]'} ${toneClass}`}
                    >
                      <div className={`text-[10px] uppercase tracking-[1px] font-semibold ${titleClass}`}>{activeHint.title}</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-white/90">{activeHint.detail}</div>
                    </motion.div>
                  );
                })()}

                {challengeGuideTargetId === item.id && challengeNextAction && item.type !== 'burette' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: [0, -4, 0], scale: 1 }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    className={`absolute left-1/2 -translate-x-1/2 pointer-events-none w-[168px] rounded-full border border-[#22d3ee]/30 bg-[rgba(7,11,23,0.82)] px-3 py-2 text-center text-[11px] font-semibold text-[#a5f3fc] shadow-[0_14px_34px_rgba(2,6,23,0.38),0_0_24px_rgba(34,211,238,0.12)] backdrop-blur-xl ${item.type === 'testtube' ? '-top-[74px]' : '-top-[54px]'}`}
                  >
                    {(challengeNextAction.includes('沉淀') || challengeNextAction.includes('气泡') || challengeNextAction.includes('色') || challengeNextAction.includes('层')) ? '观察' : '拖入'} → {challengeNextAction}
                  </motion.div>
                )}

                {/* Focus indicator / label */}
                <div className={`mt-2 flex flex-col items-center z-10 transition-all duration-300 ${focusedItemId === item.id ? 'scale-110 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : ''}`}>
                  {item.type !== 'testtube' && (
                    <span className={`text-[12px] bg-[rgba(10,14,26,0.8)] px-2 py-0.5 rounded border ${focusedItemId === item.id ? 'border-[#22d3ee] text-[#22d3ee]' : 'border-[rgba(255,255,255,0.05)] text-[#94a3b8]'}`}>
                      {item.name}
                    </span>
                  )}
                  {focusedItemId === item.id && (
                    <motion.div 
                      layoutId="focus-indicator"
                      className="w-1.5 h-1.5 mt-1 rounded-full bg-[#22d3ee] shadow-[0_0_5px_#22d3ee]"
                    />
                  )}
                </div>
              </motion.div>
                ))}
              </>
            )}
          </section>

          {/* RIGHT PANEL - Desktop (Fixed) & Tablet (Bottom Sheet) */}
          <aside className={
            isTablet
              ? bottomSheetOpen
                ? 'absolute bottom-3 left-3 right-3 z-20 flex h-[60vh] min-h-0 shrink-0 flex-col gap-3 overflow-hidden rounded-[22px] bg-[#0a0e1a]/90 transition-all duration-250 ease-out'
                : 'absolute bottom-3 left-1/2 z-20 flex h-[48px] w-[184px] -translate-x-1/2 shrink-0 flex-col overflow-hidden rounded-full transition-all duration-250 ease-out'
              : 'relative z-20 flex h-full min-h-0 w-[320px] shrink-0 flex-col gap-3 overflow-hidden'
          }>
            {/* Tablet drag handle */}
            <button 
              className={`${isTablet ? 'flex' : 'hidden'} w-full h-[48px] glass-panel items-center justify-center shrink-0 text-[#94a3b8]`}
              onClick={() => setBottomSheetOpen(!bottomSheetOpen)}
            >
              <div className="flex items-center gap-2">
                {bottomSheetOpen ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                <span className="text-[14px] font-medium">试剂 / 日志</span>
              </div>
            </button>
            
            <div className={`flex-1 min-h-0 gap-3 overflow-hidden ${isTablet ? 'flex flex-col' : 'grid grid-rows-[minmax(0,1.25fr)_minmax(0,0.75fr)]'} ${!isTablet || bottomSheetOpen ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200 delay-100`}>
              {isTablet && (
                <div className="glass-panel p-1 flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveRightPanelTab('reagents')}
                    className={`flex-1 h-9 rounded-[12px] text-[13px] transition-colors ${activeRightPanelTab === 'reagents' ? 'bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/25' : 'text-[#94a3b8] hover:text-white'}`}
                  >
                    试剂架
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRightPanelTab('logs')}
                    className={`flex-1 h-9 rounded-[12px] text-[13px] transition-colors ${activeRightPanelTab === 'logs' ? 'bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/25' : 'text-[#94a3b8] hover:text-white'}`}
                  >
                    观察日志
                  </button>
                </div>
              )}

              <div className={`${isTablet && activeRightPanelTab !== 'reagents' ? 'hidden' : 'flex'} min-h-0 flex-col overflow-hidden rounded-[18px] transition-all duration-300 ${isTablet ? 'flex-1' : ''} ${rightPanelPulse === 'reagents' ? 'ring-2 ring-[#10b981]/45 shadow-[0_0_28px_rgba(16,185,129,0.18)]' : ''}`}>
                <ReagentShelf
                  className="h-full"
                  focusSignal={reagentFocusSignal}
                  focusOnly={gameMode === 'challenge' && Boolean(activeChallenge)}
                  highlightedReagents={challengeInsight?.primaryReagents || []}
                  suggestedReagents={challengeInsight?.secondaryReagents || []}
                  dimIrrelevant={gameMode === 'challenge'}
                  showUnknownSamples={gameMode === 'challenge'}
                />
              </div>
              <div className={`${isTablet && activeRightPanelTab !== 'logs' ? 'hidden' : 'flex'} min-h-0 flex-col overflow-hidden rounded-[18px] transition-all duration-300 ${isTablet ? 'flex-1' : ''} ${rightPanelPulse === 'logs' ? 'ring-2 ring-[#22d3ee]/45 shadow-[0_0_28px_rgba(34,211,238,0.18)]' : ''}`}>
                <ObservationLog className="h-full" />
              </div>
            </div>
          </aside>

          {showFloatingAgent && (
            <motion.div
              className="fixed z-40"
              style={{ left: agentPosition.x, top: agentPosition.y }}
              animate={{ y: agentIsDragging ? 0 : agentOrbPulse ? [0, -4, 0] : 0 }}
              transition={{ duration: agentIsDragging ? 0 : agentOrbPulse ? 1.4 : 0.18, repeat: agentIsDragging || !agentOrbPulse ? 0 : 2, ease: 'easeInOut' }}
            >
            <AnimatePresence>
              {agentExpanded && (
                <motion.div
                  ref={agentShellRef}
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className={`absolute w-[min(392px,calc(100vw-24px))] ${agentDockSide === 'right' ? 'right-[calc(100%+14px)]' : 'left-[calc(100%+14px)]'} ${agentVerticalPlacement === 'up' ? 'bottom-0' : 'top-0'} ${agentVerticalPlacement === 'up' ? (agentDockSide === 'right' ? 'origin-bottom-right' : 'origin-bottom-left') : (agentDockSide === 'right' ? 'origin-top-right' : 'origin-top-left')}`}
                >
                  <div className="rounded-[30px] border border-white/10 bg-[rgba(7,11,23,0.96)] backdrop-blur-2xl px-4 py-4 shadow-[0_26px_80px_rgba(2,6,23,0.52)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-3 text-[#e2e8f0]">
                        <div className="relative h-12 w-12 shrink-0 rounded-full border border-white/12 bg-[rgba(15,23,42,0.82)] p-1 shadow-[inset_0_1px_12px_rgba(255,255,255,0.12),0_0_24px_rgba(34,211,238,0.12)]">
                          <img src="/lavoisier-avatar.svg" alt="拉瓦锡助手头像" draggable={false} className="h-full w-full rounded-full object-cover" />
                          <span className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#07101f] ${agentIsLoading ? 'bg-[#f59e0b]' : agentError ? 'bg-[#f97316]' : 'bg-[#10b981]'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-[15px] font-semibold">拉瓦锡 Agent</div>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${agentIntentMeta.badge}`}>{agentIntentMeta.label}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-[#94a3b8]">
                            {agentIsLoading ? '思考中' : agentStatusLabel}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAgentExpanded(false)}
                        className="w-8 h-8 rounded-[12px] border border-white/8 bg-white/5 text-[#94a3b8] hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                        aria-label="关闭拉瓦锡面板"
                        title={agentIsLoading ? '拉瓦锡正在思考…' : agentStatusLabel}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => submitAgentQuery('结合当前实验目标，下一步该怎么做？')} className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-left text-[11px] text-[#dbeafe] hover:border-[#22d3ee]/30 hover:bg-[#22d3ee]/10 transition-colors">下一步</button>
                      <button type="button" onClick={() => submitAgentQuery('请解释当前实验现象和背后的化学原因。')} className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-left text-[11px] text-[#dbeafe] hover:border-[#22d3ee]/30 hover:bg-[#22d3ee]/10 transition-colors">解释现象</button>
                      <button type="button" onClick={() => submitAgentQuery('我现在这一步做对了吗？')} className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-left text-[11px] text-[#dbeafe] hover:border-[#f59e0b]/30 hover:bg-[#f59e0b]/10 transition-colors">我做对了吗</button>
                      <button type="button" onClick={() => handleAgentQuickAction('reagents')} className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-left text-[11px] text-[#dbeafe] hover:border-[#10b981]/30 hover:bg-[#10b981]/10 transition-colors">打开试剂</button>
                    </div>

                    {agentError && (
                      <div className="mt-3 rounded-[16px] border border-[#f97316]/20 bg-[rgba(249,115,22,0.08)] px-3 py-2 text-[12px] text-[#fdba74]">
                        {agentError}
                      </div>
                    )}

                    {agentExpanded && (
                      <div className="mt-3 rounded-[22px] border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scroll-smooth">
                          {agentMessages.length === 0 && !agentIsLoading && (
                            <div className="rounded-[18px] px-3 py-3 text-[12px] leading-relaxed text-[#94a3b8] border border-dashed border-white/10 bg-white/[0.02]">
                              输入问题。
                            </div>
                          )}
                          {agentMessages.map(message => (
                            <div
                              key={message.id}
                              className={`whitespace-pre-line rounded-[16px] px-3 py-2 text-[12px] leading-relaxed ${message.role === 'agent' ? 'bg-[rgba(34,211,238,0.08)] border border-[#22d3ee]/14 text-[#dbeafe]' : 'bg-white/5 border border-white/8 text-[#e2e8f0]'}`}
                            >
                              {message.text}
                            </div>
                          ))}
                          {agentIsLoading && (
                            <div className="flex items-center gap-2 rounded-[16px] px-3 py-2 text-[12px] leading-relaxed bg-[rgba(34,211,238,0.08)] border border-[#22d3ee]/14 text-[#dbeafe]">
                              <span className="h-2 w-2 rounded-full bg-[#22d3ee] animate-pulse" />
                              拉瓦锡正在整理实验建议…
                            </div>
                          )}
                          <div ref={agentMessagesEndRef} />
                        </div>
                        {!!agentSkillPrompts.length && (
                          <div className="mt-3 border-t border-white/8 pt-3">
                            <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[#64748b]">快捷</div>
                            <div className="flex flex-wrap gap-2">
                              {agentSkillPrompts.map(prompt => (
                                <button
                                  key={prompt}
                                  type="button"
                                  onClick={() => submitAgentQuery(prompt)}
                                  className="px-2.5 py-1 rounded-full border border-white/8 bg-white/5 text-[11px] text-[#cbd5e1] hover:text-white hover:bg-white/8 transition-colors"
                                >
                                  {prompt}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="mt-3 flex items-end gap-2">
                          <textarea
                            ref={agentInputRef}
                            value={agentDraft}
                            onChange={(e) => setAgentDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                setAgentExpanded(false);
                                return;
                              }
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                submitAgentQuery(agentDraft);
                              }
                            }}
                            placeholder="问拉瓦锡：下一步、现象、风险…"
                            rows={2}
                            className="flex-1 resize-none rounded-[16px] border border-white/8 bg-white/5 px-3 py-2 text-[12px] text-[#e2e8f0] placeholder:text-[#64748b] outline-none focus:border-[#22d3ee]/35"
                          />
                          <button
                            type="button"
                            onClick={() => submitAgentQuery(agentDraft)}
                            disabled={agentIsLoading || !agentDraft.trim()}
                            className="h-[42px] px-4 rounded-[14px] border border-[#22d3ee]/25 bg-[#22d3ee]/12 text-[12px] text-[#67e8f9] hover:bg-[#22d3ee]/18 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Enter 发送，Esc 收起"
                          >
                            {agentIsLoading ? '思考' : '发送'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              ref={agentDockButtonRef}
              type="button"
              onPointerDown={handleAgentPointerDown}
              onPointerMove={handleAgentPointerMove}
              onPointerUp={handleAgentPointerUp}
              onPointerCancel={handleAgentPointerCancel}
              onLostPointerCapture={handleAgentPointerCancel}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setAgentExpanded(v => !v);
                }
              }}
              aria-label="拖动或展开拉瓦锡助手"
              title={agentHasFreshUpdate ? (agentRemoteHeadline || '实验有变化') : '问拉瓦锡'}
              className={`group relative h-[84px] w-[84px] rounded-full border border-white/12 bg-[rgba(8,12,24,0.84)] backdrop-blur-xl overflow-visible shadow-[0_18px_42px_rgba(2,6,23,0.38)] select-none touch-none transition-transform hover:scale-[1.03] ${agentIsDragging ? 'cursor-grabbing scale-[1.04]' : 'cursor-grab'}`}
              style={{ boxShadow: `${agentIntentMeta.orbGlow}, 0 18px 42px rgba(2,6,23,0.38)` }}
            >
              <motion.span
                animate={agentOrbPulse ? { opacity: [0.38, 0.68, 0.38], scale: [1, 1.06, 1] } : { opacity: 0.42, scale: 1 }}
                transition={{ duration: 1.5, ease: 'easeInOut', repeat: agentOrbPulse ? Infinity : 0 }}
                className={`absolute -inset-2 rounded-full bg-gradient-to-br ${agentIntentMeta.orbGradient} blur-md`}
              />
              <span className="absolute inset-0 rounded-full border border-white/20 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.28),rgba(255,255,255,0.05)_42%,rgba(2,6,23,0.34)_78%)]" />
              <span className={`absolute inset-[5px] rounded-full bg-gradient-to-br ${agentIntentMeta.orbGradient} opacity-55`} />
              <span className="absolute inset-[8px] overflow-hidden rounded-full border border-white/16 bg-[rgba(15,23,42,0.74)]">
                <img src="/lavoisier-avatar.svg" alt="拉瓦锡助手头像" draggable={false} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </span>
              <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/14 bg-[rgba(7,11,23,0.88)] text-white shadow-[0_8px_22px_rgba(2,6,23,0.38)]">
                {renderAgentIntentGlyph(agentState.intent)}
              </span>
              <span className={`absolute right-1 bottom-2 h-3.5 w-3.5 rounded-full border-2 border-[#07101f] ${agentIsLoading ? 'bg-[#f59e0b]' : agentError ? 'bg-[#f97316]' : 'bg-[#10b981]'}`} />
              <span className="absolute left-1/2 top-[calc(100%+8px)] -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[rgba(7,11,23,0.88)] px-2.5 py-1 text-[10px] font-semibold text-[#e2e8f0] shadow-[0_10px_24px_rgba(2,6,23,0.34)] backdrop-blur-xl">
                {agentExpanded ? '收起' : '问拉瓦锡'}
              </span>
              {!agentExpanded && !agentError && (
                <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${agentDockSide === 'right' ? 'right-[calc(100%+12px)]' : 'left-[calc(100%+12px)]'} rounded-[16px] border border-white/8 bg-[rgba(7,11,23,0.9)] px-3 py-2 text-[12px] text-[#cbd5e1] shadow-[0_12px_30px_rgba(2,6,23,0.32)] backdrop-blur-xl opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap`}>
                  {agentHasFreshUpdate ? '实验有变化' : '问拉瓦锡'}
                </span>
              )}
              {agentHasFreshUpdate && !agentExpanded && (
                <motion.span
                  animate={{ scale: [1, 1.18, 1], opacity: [0.88, 1, 0.88] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-0 top-0 w-3 h-3 rounded-full bg-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.8)]"
                />
              )}
            </button>
            </motion.div>
          )}

        </main>

        {/* BOTTOM STATUS BAR */}
        <footer className="min-h-[36px] w-[calc(100%-24px)] mt-3 mb-3 flex items-center justify-between flex-wrap gap-x-4 gap-y-1.5 px-6 py-2 shrink-0 z-10 text-[12px] text-[#94a3b8] glass-panel mx-auto relative">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></div>
              实验室状态: 运行中
            </span>
            <span className="hidden xl:inline text-[#64748b]">当前聚焦: {focusedContainerLabel}</span>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            <div>台上物品数量: {placedItems.length + brokenGlass.length}</div>
            <div className="text-[#64748b] hidden 2xl:block">拖拽器材到实验台，拖拽试剂到容器中</div>
          </div>
        </footer>

        <AnimatePresence>
          {atlasOpen && (
            <DiscoveryAtlasModal cards={discoveryCards} onClose={() => setAtlasOpen(false)} />
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

export default App
