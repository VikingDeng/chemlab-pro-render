// A mathematically grounded, scalable chemical engine using a data-driven stoichiometry matrix.
export interface ChemState {
  volume: number; // in mL
  temperature: number; // in Celsius
  glassTemp?: number; // temperature of the glass container itself
  pressure?: number; // approximate internal pressure for readouts
  ph?: number;
  color?: string; // override color
  boilingPoint?: number; // based on Raoult's law
  moles: { [reagent: string]: number };
  
  // Phase separation
  organicVolume?: number; // Non-polar phase volume (mL)
  organicColor?: string; // e.g. pink for iodine in CCl4
  organicDensity?: number; // g/mL, used to determine layer order
}

export interface ReagentDef {
  formula: string;
  molarity: number; // For liquids. If 0, it's a solid/gas
  baseColor: {r: number, g: number, b: number, a: number}; // Visual rendering property
  state: 'aq' | 's' | 'g' | 'l'; // Aqueous, Solid, Gas, Liquid
  isOrganic?: boolean;
  density?: number; // g/mL
  enthalpy?: number; // kJ/mol of heat released (positive) or absorbed (negative) upon mixing
  defaultTemperature?: number; // Celsius, used when a fresh reagent is added from the shelf
  heatCapacity?: number; // J/(g·°C), coarse effective heat capacity for thermal mixing
  normalBoilingPoint?: number; // Celsius, used for non-aqueous boiling heuristics
}

export interface MixResult {
  newState: ChemState;
  log: string;
  reactionType: string;
  equation: string | null;
}

interface ReactionEvent {
  type: string;
  equation: string;
  log: string;
}

interface StrongAcidProfile {
  formula: string;
  protonCount: number;
  sodiumSaltFormula: string;
  label: string;
  equationString: string;
}

export interface SplitChemStateResult {
  extractedState: ChemState;
  remainingState: ChemState;
  transferredVolume: number;
}

export interface SplitChemStateOptions {
  preferredPhase?: 'mixed' | 'aqueous' | 'organic' | 'top' | 'bottom';
  mode?: 'transfer' | 'distill';
  solidMode?: 'follow' | 'supernatant' | 'sediment' | 'blocked';
  settlingProgress?: number;
}

const ROOM_TEMPERATURE = 22.4;
const EPSILON = 1e-6;
const AQUEOUS_SPECIFIC_HEAT = 4.184;
const ORGANIC_SPECIFIC_HEAT = 1.9;
const GLASS_RELAXATION_FACTOR = 0.32;

// 1. Database of all known chemical species
export const REAGENTS: Record<string, ReagentDef> = {
  // Endothermic / Exothermic Salts
  '硝酸铵 (NH₄NO₃)': { formula: 'NH4NO3', molarity: 5.0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq', enthalpy: -25.7, defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 3.9 }, // kJ/mol (Absorbs heat, very cold)
  '氢氧化钠 (固体)': { formula: 'NaOH_s', molarity: 10.0, baseColor: {r:255, g:255, b:255, a:0.1}, state: 's', enthalpy: 44.5, defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 1.5 }, // Exothermic dissolution
  // Organics
  '蒸馏水': { formula: 'H2O', molarity: 55.5, baseColor: {r:255, g:255, b:255, a:0}, state: 'l', defaultTemperature: ROOM_TEMPERATURE, heatCapacity: AQUEOUS_SPECIFIC_HEAT, normalBoilingPoint: 100 },

  '四氯化碳 (CCl₄)': { formula: 'CCl4', molarity: 10.3, baseColor: {r:255, g:255, b:255, a:0}, state: 'l', isOrganic: true, density: 1.59, defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 0.86, normalBoilingPoint: 76.7 },
  '碘水 (I₂ aq)': { formula: 'I2', molarity: 0.05, baseColor: {r:180, g:120, b:40, a:0.5}, state: 'aq', defaultTemperature: ROOM_TEMPERATURE, heatCapacity: AQUEOUS_SPECIFIC_HEAT },
  '碘单质 (I₂ 固体)': { formula: 'I2_s', molarity: 0, baseColor: {r:40, g:0, b:40, a:1}, state: 's', enthalpy: 0, defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 0.21, normalBoilingPoint: 184 }, // purple-black solid
  '碘单质 (I₂ 有机相)': { formula: 'I2_org', molarity: 0, baseColor: {r:128, g:0, b:128, a:0.7}, state: 'l', isOrganic: true, defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 0.8, normalBoilingPoint: 184 },

  '正己烷 (Hexane)': { formula: 'Hexane', molarity: 7.6, baseColor: {r:255, g:255, b:255, a:0}, state: 'l', isOrganic: true, density: 0.66, defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 2.3, normalBoilingPoint: 68.7 },

  // Acids
  'HCl': { formula: 'HCl', molarity: 1.0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq', defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 3.95 },
  '盐酸': { formula: 'HCl', molarity: 1.0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq', defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 3.95 },
  'H₂SO₄': { formula: 'H2SO4', molarity: 0.5, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq', defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 3.8 }, // Sulfuric acid is colorless
  '硫酸': { formula: 'H2SO4', molarity: 0.5, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq', defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 3.8 },
  'HNO₃': { formula: 'HNO3', molarity: 1.0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq', defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 3.9 },
  '硝酸': { formula: 'HNO3', molarity: 1.0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq', defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 3.9 },
  
  // Bases
  'NaOH': { formula: 'NaOH', molarity: 1.0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq', defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 4.0 },
  '氢氧化钠': { formula: 'NaOH', molarity: 1.0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq', defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 4.0 },
  'NH₃·H₂O': { formula: 'NH3H2O', molarity: 1.0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq', defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 4.1 },
  '氨水': { formula: 'NH3H2O', molarity: 1.0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq', defaultTemperature: ROOM_TEMPERATURE, heatCapacity: 4.1 },
  
  // Salts & Transition Metals
  'CuSO₄': { formula: 'CuSO4', molarity: 0.5, baseColor: {r:34, g:211, b:238, a:0.6}, state: 'aq' }, // Blue
  '硫酸铜': { formula: 'CuSO4', molarity: 0.5, baseColor: {r:34, g:211, b:238, a:0.6}, state: 'aq' },
  'AgNO₃': { formula: 'AgNO3', molarity: 0.1, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' }, // Clear
  '硝酸银': { formula: 'AgNO3', molarity: 0.1, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },
  'FeCl₃': { formula: 'FeCl3', molarity: 0.5, baseColor: {r:234, g:179, b:8, a:0.7}, state: 'aq' }, // Yellow-brown
  '氯化铁': { formula: 'FeCl3', molarity: 0.5, baseColor: {r:234, g:179, b:8, a:0.7}, state: 'aq' },
  'FeSO₄': { formula: 'FeSO4', molarity: 0.5, baseColor: {r:163, g:230, b:53, a:0.5}, state: 'aq' }, // Light green
  '硫酸亚铁': { formula: 'FeSO4', molarity: 0.5, baseColor: {r:163, g:230, b:53, a:0.5}, state: 'aq' },
  'BaCl₂': { formula: 'BaCl2', molarity: 0.5, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },
  '氯化钡': { formula: 'BaCl2', molarity: 0.5, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },
  'Na₂CO₃': { formula: 'Na2CO3', molarity: 1.0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },
  '碳酸钠': { formula: 'Na2CO3', molarity: 1.0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },
  'KSCN': { formula: 'KSCN', molarity: 0.5, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },
  '硫氰化钾': { formula: 'KSCN', molarity: 0.5, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },
  
  // Redox
  'KMnO₄': { formula: 'KMnO4', molarity: 0.01, baseColor: {r:168, g:85, b:247, a:0.8}, state: 'aq' }, // Purple
  '高锰酸钾': { formula: 'KMnO4', molarity: 0.01, baseColor: {r:168, g:85, b:247, a:0.8}, state: 'aq' },
  'H₂O₂': { formula: 'H2O2', molarity: 1.0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },
  '双氧水': { formula: 'H2O2', molarity: 1.0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },
  '草酸 (H₂C₂O₄)': { formula: 'H2C2O4', molarity: 0.5, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },
  '葡萄糖 (Glucose)': { formula: 'Glucose', molarity: 0.5, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },

  // Indicators
  '酚酞指示剂': { formula: 'Phenolphthalein', molarity: 0.01, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },
  '甲基橙指示剂': { formula: 'MethylOrange', molarity: 0.01, baseColor: {r:255, g:165, b:0, a:0.5}, state: 'aq' },

  // Products (Auto-registered rendering types)
  'Cu(OH)2': { formula: 'Cu(OH)2', molarity: 0, baseColor: {r:16, g:185, b:129, a:0.9}, state: 's' }, // Blue-green
  'AgCl': { formula: 'AgCl', molarity: 0, baseColor: {r:248, g:250, b:252, a:0.9}, state: 's' }, // White
  'BaSO4': { formula: 'BaSO4', molarity: 0, baseColor: {r:255, g:255, b:255, a:0.95}, state: 's' }, // White
  'NaCl': { formula: 'NaCl', molarity: 0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },
  'NaNO3': { formula: 'NaNO3', molarity: 0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },
  'Na2SO4': { formula: 'Na2SO4', molarity: 0, baseColor: {r:255, g:255, b:255, a:0}, state: 'aq' },
  'Fe(OH)3': { formula: 'Fe(OH)3', molarity: 0, baseColor: {r:185, g:28, b:28, a:0.95}, state: 's' }, // Red-brown
  'Fe(OH)2': { formula: 'Fe(OH)2', molarity: 0, baseColor: {r:163, g:230, b:53, a:0.8}, state: 's' }, // White/Light-green
  'Fe(SCN)3': { formula: 'Fe(SCN)3', molarity: 0, baseColor: {r:153, g:27, b:27, a:0.9}, state: 'aq' }, // Blood red
  'Cl2': { formula: 'Cl2', molarity: 0, baseColor: {r:250, g:204, b:21, a:0.6}, state: 'g' }, // Yellow-green
  'CO2': { formula: 'CO2', molarity: 0, baseColor: {r:255, g:255, b:255, a:0.3}, state: 'g' }, // Colorless
  'O2': { formula: 'O2', molarity: 0, baseColor: {r:255, g:255, b:255, a:0.3}, state: 'g' } // Colorless
};

// 2. Data-Driven Reaction Matrix
// This allows infinitely complex future expansions without changing the core engine logic.
export interface ReactionRule {
  id: string;
  type: 'neutralize' | 'precipitate_cu' | 'precipitate_ag' | 'gas_cl2' | string;
  reactants: Record<string, number>; // formula -> stoichiometric coefficient
  products: Record<string, number>;  // formula -> stoichiometric coefficient
  enthalpy: number; // Heat release (J/mol of reaction)
  equationString: string;
  logMessage: string;
}

export const REACTION_RULES: ReactionRule[] = [
  // ===================== 沉淀反应 (Precipitation) =====================
  {
    id: 'cu_precipitation',
    type: 'precipitate_cu',
    reactants: { 'CuSO4': 1, 'NaOH': 2 },
    products: { 'Cu(OH)2': 1, 'Na2SO4': 1 },
    enthalpy: 0, 
    equationString: 'CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄',
    logMessage: '生成蓝绿色 Cu(OH)₂ 絮状沉淀'
  },
  {
    id: 'ag_precipitation',
    type: 'precipitate_ag',
    reactants: { 'AgNO3': 1, 'HCl': 1 },
    products: { 'AgCl': 1, 'HNO3': 1 },
    enthalpy: 0,
    equationString: 'AgNO₃ + HCl → AgCl↓ + HNO₃',
    logMessage: '生成白色 AgCl 凝乳状沉淀'
  },
  {
    id: 'ba_precipitation',
    type: 'precipitate_ba',
    reactants: { 'BaCl2': 1, 'H2SO4': 1 },
    products: { 'BaSO4': 1, 'HCl': 2 },
    enthalpy: 0,
    equationString: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl',
    logMessage: '生成致密的白色 BaSO₄ 沉淀'
  },
  {
    id: 'fe3_precipitation',
    type: 'precipitate_fe3',
    reactants: { 'FeCl3': 1, 'NaOH': 3 },
    products: { 'Fe(OH)3': 1, 'NaCl': 3 },
    enthalpy: 0,
    equationString: 'FeCl₃ + 3NaOH → Fe(OH)₃↓ + 3NaCl',
    logMessage: '生成红褐色 Fe(OH)₃ 沉淀'
  },
  {
    id: 'fe2_precipitation',
    type: 'precipitate_fe2',
    reactants: { 'FeSO4': 1, 'NaOH': 2 },
    products: { 'Fe(OH)2': 1, 'Na2SO4': 1 },
    enthalpy: 0,
    equationString: 'FeSO₄ + 2NaOH → Fe(OH)₂↓ + Na₂SO₄',
    logMessage: '生成白色 Fe(OH)₂ 沉淀（易被氧化）'
  },

  // ===================== 络合反应 (Complexation) =====================
  {
    id: 'fe_scn_complex',
    type: 'complex_fe_scn',
    reactants: { 'FeCl3': 1, 'KSCN': 3 },
    products: { 'Fe(SCN)3': 1, 'KCl': 3 },
    enthalpy: 0,
    equationString: 'Fe³⁺ + 3SCN⁻ ⇌ Fe(SCN)₃',
    logMessage: '溶液瞬间变为血红色'
  },

  // ===================== 氧化还原与气体生成 (Redox & Gas) =====================
  {
    id: 'redox_kmno4_hcl',
    type: 'gas_cl2',
    reactants: { 'KMnO4': 2, 'HCl': 16 }, 
    products: { 'KCl': 2, 'MnCl2': 2, 'H2O': 8, 'Cl2': 5 },
    enthalpy: 20000, 
    equationString: '2KMnO₄ + 16HCl → 2KCl + 2MnCl₂ + 8H₂O + 5Cl₂↑',
    logMessage: '高锰酸钾紫红色褪去，生成黄绿色 Cl₂ 气体'
  },
  {
    id: 'gas_co2',
    type: 'gas_co2',
    reactants: { 'Na2CO3': 1, 'HCl': 2 },
    products: { 'NaCl': 2, 'H2O': 1, 'CO2': 1 },
    enthalpy: 0,
    equationString: 'Na₂CO₃ + 2HCl → 2NaCl + H₂O + CO₂↑',
    logMessage: '剧烈冒泡，产生无色 CO₂ 气体'
  },
  
  // ===================== 络合反应 (Complexation) =====================
  {
    id: 'cu_nh3_complex',
    type: 'complex_cu_nh3',
    reactants: { 'CuSO4': 1, 'NH3H2O': 4 },
    products: { 'Cu(NH3)4SO4': 1 },
    enthalpy: -22000,
    equationString: 'Cu²⁺ + 4NH₃ ⇌ [Cu(NH₃)₄]²⁺',
    logMessage: '生成深蓝色铜氨络合物'
  },

  // ===================== 氧化还原反应 (Redox) =====================
  {
    id: 'kmno4_decolorization',
    type: 'redox_kmno4',
    // 2KMnO4 + 5H2C2O4 + 3H2SO4 -> K2SO4 + 2MnSO4 + 10CO2 + 8H2O
    reactants: { 'KMnO4': 2, 'H2C2O4': 5, 'H2SO4': 3 },
    products: { 'MnSO4': 2, 'K2SO4': 1, 'CO2': 10, 'H2O': 8 },
    enthalpy: 250000, // Highly exothermic
    equationString: '2KMnO₄ + 5H₂C₂O₄ + 3H₂SO₄ → 2Mn²⁺ + 10CO₂↑ + 8H₂O',
    logMessage: '高锰酸钾被草酸还原褪色，产生气泡'
  },
  {
    id: 'silver_mirror',
    type: 'redox_silver_mirror',
    // Simplified Tollens' reagent reaction with glucose
    reactants: { 'AgNO3': 2, 'NH3H2O': 4, 'Glucose': 1 },
    products: { 'Ag_mirror': 2, 'GluconicAcid': 1, 'NH4NO3': 2, 'NH3H2O': 2 },
    enthalpy: 15000,
    equationString: 'CH₂OH(CHOH)₄CHO + 2[Ag(NH₃)₂]OH → 2Ag↓ + CH₂OH(CHOH)₄COONH₄ + H₂O + 3NH₃',
    logMessage: '发生银镜反应！容器内壁析出光亮银层'
  }
];

const STRONG_ACID_PROFILES: StrongAcidProfile[] = [
  {
    formula: 'HCl',
    protonCount: 1,
    sodiumSaltFormula: 'NaCl',
    label: '盐酸',
    equationString: 'HCl + NaOH → NaCl + H₂O',
  },
  {
    formula: 'HNO3',
    protonCount: 1,
    sodiumSaltFormula: 'NaNO3',
    label: '硝酸',
    equationString: 'HNO₃ + NaOH → NaNO₃ + H₂O',
  },
  {
    formula: 'H2SO4',
    protonCount: 2,
    sodiumSaltFormula: 'Na2SO4',
    label: '硫酸',
    equationString: 'H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O',
  },
];

const NON_HYDROXIDE_REACTION_RULES = REACTION_RULES.filter(rule => !('NaOH' in rule.reactants));
const HYDROXIDE_REACTION_RULES = REACTION_RULES.filter(rule => 'NaOH' in rule.reactants);

export function createEmptyState(): ChemState {
  return { volume: 0, temperature: ROOM_TEMPERATURE, glassTemp: ROOM_TEMPERATURE, moles: {}, boilingPoint: 100 };
}

function cloneState(state: ChemState): ChemState {
  return {
    ...state,
    moles: { ...state.moles },
    temperature: state.temperature ?? ROOM_TEMPERATURE,
    glassTemp: state.glassTemp ?? state.temperature ?? ROOM_TEMPERATURE,
    volume: state.volume ?? 0,
    boilingPoint: state.boilingPoint ?? 100,
    organicVolume: state.organicVolume ?? 0,
    organicColor: state.organicColor,
    organicDensity: state.organicDensity,
  };
}

function normalizeState(state: ChemState): ChemState {
  const normalizedMoles: Record<string, number> = {};
  for (const [formula, amount] of Object.entries(state.moles)) {
    if (amount > 1e-10) {
      normalizedMoles[formula] = amount;
    }
  }

  return {
    ...state,
    volume: Math.max(0, state.volume),
    temperature: Number.isFinite(state.temperature) ? state.temperature : ROOM_TEMPERATURE,
    glassTemp: Number.isFinite(state.glassTemp) ? state.glassTemp : state.temperature,
    pressure: Number.isFinite(state.pressure) ? state.pressure : 1,
    boilingPoint: Number.isFinite(state.boilingPoint) ? state.boilingPoint : 100,
    moles: normalizedMoles,
    organicVolume: Math.max(0, state.organicVolume || 0),
    organicColor: (state.organicVolume || 0) > 0 ? state.organicColor : undefined,
    organicDensity: (state.organicVolume || 0) > 0 ? state.organicDensity : undefined,
  };
}

function getOrganicTint(def?: ReagentDef) {
  if (!def?.baseColor) return 'rgba(255,255,255,0.1)';
  return `rgba(${def.baseColor.r},${def.baseColor.g},${def.baseColor.b},0.3)`;
}

function resolveReagentDef(reagentName: string) {
  const aliasName = UNKNOWN_SAMPLE_ALIASES[reagentName] || reagentName;
  return REAGENTS[aliasName] || Object.values(REAGENTS).find(d => aliasName.includes(d.formula));
}

const UNKNOWN_SAMPLE_ALIASES: Record<string, string> = {
  '未知样品 A': '硫酸铜',
  '未知样品 B': '硝酸银',
  '未知样品 C': '氯化铁',
  '未知样品 D': '碳酸钠',
  '未知样品 E': '碘水 (I₂ aq)',
  '未知样品 F': '高锰酸钾',
}

const REAGENT_FORMULA_MAP = Object.values(REAGENTS).reduce<Record<string, ReagentDef>>((acc, def) => {
  if (!acc[def.formula]) {
    acc[def.formula] = def;
  }
  return acc;
}, {});

function resolveReagentFormulaDef(formula: string) {
  return REAGENT_FORMULA_MAP[formula];
}

function getReagentDefaultTemperature(def?: ReagentDef) {
  return def?.defaultTemperature ?? ROOM_TEMPERATURE;
}

function getReagentSpecificHeat(def?: ReagentDef) {
  if (!def) return AQUEOUS_SPECIFIC_HEAT;
  if (def.heatCapacity) return def.heatCapacity;
  if (def.state === 'l' && def.isOrganic) return ORGANIC_SPECIFIC_HEAT;
  if (def.state === 's') return 1.4;
  if (def.state === 'g') return 1.0;
  return AQUEOUS_SPECIFIC_HEAT;
}

function getFluidThermalCapacity(state: ChemState) {
  const aqueousMass = Math.max(0, state.volume);
  const organicMass = Math.max(0, state.organicVolume || 0) * Math.max(0.5, state.organicDensity ?? 0.8);
  return Math.max(0, (aqueousMass * AQUEOUS_SPECIFIC_HEAT) + (organicMass * ORGANIC_SPECIFIC_HEAT));
}

function blendTemperature(entries: Array<{ temperature: number; thermalCapacity: number }>, fallback = ROOM_TEMPERATURE) {
  const totalThermalCapacity = entries.reduce((sum, entry) => sum + Math.max(0, entry.thermalCapacity), 0);
  if (totalThermalCapacity <= EPSILON) return fallback;

  const weightedTemperature = entries.reduce(
    (sum, entry) => sum + (entry.temperature * Math.max(0, entry.thermalCapacity)),
    0
  );

  return weightedTemperature / totalThermalCapacity;
}

function relaxGlassTemperature(previousGlassTemp: number, nextLiquidTemp: number, influence: number) {
  const clampedInfluence = Math.max(0.08, Math.min(0.75, influence * GLASS_RELAXATION_FACTOR));
  return previousGlassTemp + ((nextLiquidTemp - previousGlassTemp) * clampedInfluence);
}

function getIncomingReagentThermalCapacity(def: ReagentDef, addedLiquidVolume: number, addedMoles: number) {
  if (addedLiquidVolume > EPSILON) {
    const density = def.isOrganic ? Math.max(0.5, def.density ?? 0.8) : 1;
    const mass = addedLiquidVolume * density;
    return mass * getReagentSpecificHeat(def);
  }

  if (def.state === 's') {
    const estimatedSolidMass = Math.max(1, addedMoles * 40);
    return estimatedSolidMass * getReagentSpecificHeat(def);
  }

  return 0;
}

function isVolatileAqueousFormula(formula: string) {
  return formula === 'H2O' || formula === 'HCl' || formula === 'HNO3' || formula === 'NH3H2O';
}

function estimateAqueousBoilingPoint(state: ChemState) {
  if (state.volume <= EPSILON) return null;

  const solventMassKg = Math.max(0.01, state.volume / 1000);
  let dissolvedSoluteMoles = 0;

  for (const [formula, amount] of Object.entries(state.moles)) {
    if (amount <= EPSILON || ORGANIC_FORMULA_SET.has(formula) || isVolatileAqueousFormula(formula)) continue;

    const def = resolveReagentFormulaDef(formula);
    if (def?.state === 'g' || def?.state === 's') continue;
    dissolvedSoluteMoles += amount;
  }

  const molality = dissolvedSoluteMoles / solventMassKg;
  return 100 + Math.min(12, 0.512 * molality);
}

function estimateOrganicBoilingPoint(state: ChemState) {
  const organicVolume = state.organicVolume || 0;
  if (organicVolume <= EPSILON) return null;

  const organicCandidates = Object.entries(state.moles)
    .filter(([formula, amount]) => amount > EPSILON && ORGANIC_FORMULA_SET.has(formula))
    .map(([formula, amount]) => ({ formula, amount, def: resolveReagentFormulaDef(formula) }))
    .filter(entry => entry.def?.normalBoilingPoint !== undefined);

  if (organicCandidates.length === 0) {
    return (state.organicDensity ?? 0.8) > 1 ? 76.7 : 68.7;
  }

  const totalMoles = organicCandidates.reduce((sum, entry) => sum + entry.amount, 0);
  if (totalMoles <= EPSILON) {
    return organicCandidates[0].def?.normalBoilingPoint ?? 76.7;
  }

  const weightedBoilingPoint = organicCandidates.reduce(
    (sum, entry) => sum + ((entry.def?.normalBoilingPoint ?? 76.7) * entry.amount),
    0
  );

  return weightedBoilingPoint / totalMoles;
}

export function estimateBoilingPoint(state: ChemState) {
  const aqueousBoilingPoint = estimateAqueousBoilingPoint(state);
  const organicBoilingPoint = estimateOrganicBoilingPoint(state);

  if (aqueousBoilingPoint !== null && organicBoilingPoint !== null) {
    return Math.min(aqueousBoilingPoint, organicBoilingPoint);
  }

  return aqueousBoilingPoint ?? organicBoilingPoint ?? 100;
}

export function calculatePressureEstimate(state: ChemState, containerCapacityML?: number) {
  const totalGasMoles = [...GAS_FORMULA_SET].reduce((sum, formula) => sum + Math.max(0, state.moles[formula] || 0), 0);
  const totalLiquidVolume = getTotalLiquidVolume(state);
  const estimatedCapacity = containerCapacityML ?? Math.max(80, totalLiquidVolume + 120);
  const headspaceML = Math.max(20, estimatedCapacity - totalLiquidVolume);
  const headspaceL = headspaceML / 1000;
  const temperatureK = Math.max(260, state.temperature + 273.15);
  const rawPressure = totalGasMoles > EPSILON ? (totalGasMoles * 0.082057 * temperatureK) / headspaceL : 1;
  const thermalVaporBoost = state.temperature >= (state.boilingPoint ?? 100) - 3 ? 0.05 : 0;
  const openContainerPressure = 1 + Math.max(0, rawPressure - 1) * 0.18 + thermalVaporBoost;
  return Math.max(1, Math.min(2.6, openContainerPressure));
}

export function ventGasSpecies(state: ChemState, seconds = 0.1) {
  const nextState = cloneState(state);
  const temperatureBoost = Math.max(0, nextState.temperature - ROOM_TEMPERATURE) / 120;
  let changed = false;

  for (const formula of GAS_FORMULA_SET) {
    const amount = nextState.moles[formula] || 0;
    if (amount <= EPSILON) continue;

    const baseRate = formula === 'Cl2' ? 0.75 : formula === 'CO2' ? 0.55 : 0.4;
    const decayFraction = Math.min(0.85, seconds * (baseRate + temperatureBoost));
    const remaining = amount * (1 - decayFraction);
    nextState.moles[formula] = remaining <= 1e-8 ? 0 : remaining;
    changed = changed || Math.abs(remaining - amount) > 1e-8;
  }

  if (changed) {
    nextState.pressure = calculatePressureEstimate(nextState);
  }

  return normalizeState(nextState);
}

export function oxidizeFerrousHydroxide(
  state: ChemState,
  seconds = 0.1,
  options: { airExposure?: number; agitation?: number } = {},
) {
  const nextState = cloneState(state);
  const ferrousHydroxide = nextState.moles['Fe(OH)2'] || 0;
  if (ferrousHydroxide <= EPSILON || seconds <= 0) {
    return normalizeState(nextState);
  }

  const airExposure = Math.max(0.15, Math.min(1.6, options.airExposure ?? 1));
  const agitation = Math.max(0, Math.min(1.5, options.agitation ?? 0));
  const thermalFactor = Math.max(0.7, Math.min(2.2, 1 + Math.max(0, nextState.temperature - ROOM_TEMPERATURE) / 70));
  const oxidationRate = 0.04 * airExposure * (1 + agitation * 0.85) * thermalFactor;
  const convertedFraction = Math.max(0, Math.min(0.22, seconds * oxidationRate));
  const convertedMoles = ferrousHydroxide * convertedFraction;

  if (convertedMoles <= 1e-8) {
    return normalizeState(nextState);
  }

  nextState.moles['Fe(OH)2'] = Math.max(0, ferrousHydroxide - convertedMoles);
  nextState.moles['Fe(OH)3'] = (nextState.moles['Fe(OH)3'] || 0) + convertedMoles;
  return normalizeState(nextState);
}

export function getPreferredBoilingPhase(state: ChemState): 'aqueous' | 'organic' {
  const aqueousBoilingPoint = estimateAqueousBoilingPoint(state);
  const organicBoilingPoint = estimateOrganicBoilingPoint(state);

  if (organicBoilingPoint !== null && (aqueousBoilingPoint === null || organicBoilingPoint + 0.5 < aqueousBoilingPoint)) {
    return 'organic';
  }

  return 'aqueous';
}

const ORGANIC_FORMULA_SET = new Set(
  Object.values(REAGENTS)
    .filter(def => def.isOrganic)
    .map(def => def.formula)
);

const IODINE_AQUEOUS_FORMULA = 'I2';
const IODINE_ORGANIC_FORMULA = 'I2_org';
const GAS_FORMULA_SET = new Set(
  Object.values(REAGENTS)
    .filter(def => def.state === 'g')
    .map(def => def.formula)
);
const SOLID_FORMULA_SET = new Set(
  Object.values(REAGENTS)
    .filter(def => def.state === 's')
    .map(def => def.formula)
);

export function isOrganicTopLayer(state: ChemState) {
  const density = state.organicDensity ?? 0.7;
  return density < 1;
}

function resolveSplitPhase(state: ChemState, preferredPhase: SplitChemStateOptions['preferredPhase'] = 'mixed') {
  const hasAqueous = state.volume > EPSILON;
  const hasOrganic = (state.organicVolume || 0) > EPSILON;

  if (preferredPhase === 'mixed') return 'mixed' as const;
  if (preferredPhase === 'aqueous') return hasAqueous ? 'aqueous' as const : (hasOrganic ? 'organic' as const : 'mixed' as const);
  if (preferredPhase === 'organic') return hasOrganic ? 'organic' as const : (hasAqueous ? 'aqueous' as const : 'mixed' as const);
  if (preferredPhase === 'top') {
    if (hasAqueous && hasOrganic) return isOrganicTopLayer(state) ? 'organic' as const : 'aqueous' as const;
    return hasOrganic ? 'organic' as const : (hasAqueous ? 'aqueous' as const : 'mixed' as const);
  }
  if (preferredPhase === 'bottom') {
    if (hasAqueous && hasOrganic) return isOrganicTopLayer(state) ? 'aqueous' as const : 'organic' as const;
    return hasAqueous ? 'aqueous' as const : (hasOrganic ? 'organic' as const : 'mixed' as const);
  }
  return 'mixed' as const;
}

function transferMolesByRatio(sourceMoles: Record<string, number>, ratio: number, shouldTransfer: (formula: string) => boolean, getFactor?: (formula: string) => number) {
  const moved: Record<string, number> = {};
  for (const [formula, amount] of Object.entries(sourceMoles)) {
    if (!shouldTransfer(formula)) continue;
    const factor = Math.max(0, Math.min(1, getFactor ? getFactor(formula) : 1));
    const movedAmount = amount * ratio * factor;
    if (movedAmount <= EPSILON) continue;
    moved[formula] = movedAmount;
  }
  return moved;
}

function getSolidTransferFactor(
  phase: 'mixed' | 'aqueous' | 'organic',
  solidMode: SplitChemStateOptions['solidMode'] = 'follow',
  settlingProgress = 0,
) {
  const clampedSettling = Math.max(0, Math.min(1, settlingProgress || 0));
  const baseFactor = phase === 'mixed' ? 0.35 : 0.12;

  if (solidMode === 'blocked') {
    return 0;
  }

  if (solidMode === 'supernatant') {
    const floorFactor = phase === 'mixed' ? 0.04 : 0.01;
    return baseFactor - (baseFactor - floorFactor) * clampedSettling;
  }

  if (solidMode === 'sediment') {
    const ceilingFactor = phase === 'mixed' ? 0.88 : 0.96;
    return baseFactor + (ceilingFactor - baseFactor) * clampedSettling;
  }

  return baseFactor;
}

function getStandardTransferFactor(
  formula: string,
  phase: 'mixed' | 'aqueous' | 'organic',
  solidMode: SplitChemStateOptions['solidMode'] = 'follow',
  settlingProgress = 0,
) {
  if (GAS_FORMULA_SET.has(formula)) return phase === 'mixed' ? 0.05 : 0;
  if (SOLID_FORMULA_SET.has(formula)) return getSolidTransferFactor(phase, solidMode, settlingProgress);
  return 1;
}

function getDistillationFactor(formula: string, phase: 'aqueous' | 'organic') {
  if (phase === 'organic') {
    if (formula === 'Hexane') return 1;
    if (formula === 'CCl4') return 0.92;
    if (formula === IODINE_ORGANIC_FORMULA) return 0.18;
    return ORGANIC_FORMULA_SET.has(formula) ? 0.35 : 0;
  }

  if (formula === 'H2O') return 1;
  if (formula === 'HCl') return 0.35;
  if (formula === 'HNO3') return 0.16;
  if (formula === 'NH3H2O') return 0.3;
  if (formula === IODINE_AQUEOUS_FORMULA) return 0.05;
  return 0;
}

function getTransferSelector(phase: 'mixed' | 'aqueous' | 'organic', options: SplitChemStateOptions = {}) {
  const mode = options.mode || 'transfer';
  const solidMode = options.solidMode || 'follow';
  const settlingProgress = options.settlingProgress || 0;

  if (mode === 'distill' && phase !== 'mixed') {
    return {
      shouldTransfer: (formula: string) => phase === 'organic' ? ORGANIC_FORMULA_SET.has(formula) : !ORGANIC_FORMULA_SET.has(formula),
      getFactor: (formula: string) => getDistillationFactor(formula, phase),
    };
  }

  if (phase === 'organic') {
    return {
      shouldTransfer: (formula: string) => ORGANIC_FORMULA_SET.has(formula),
      getFactor: (formula: string) => getStandardTransferFactor(formula, 'organic', solidMode, settlingProgress),
    };
  }

  if (phase === 'aqueous') {
    return {
      shouldTransfer: (formula: string) => !ORGANIC_FORMULA_SET.has(formula),
      getFactor: (formula: string) => getStandardTransferFactor(formula, 'aqueous', solidMode, settlingProgress),
    };
  }

  return {
    shouldTransfer: () => true,
    getFactor: (formula: string) => getStandardTransferFactor(formula, 'mixed', solidMode, settlingProgress),
  };
}

function getIodinePartitionCoefficient(state: ChemState) {
  const ccl4Weight = state.moles['CCl4'] || 0;
  const hexaneWeight = state.moles['Hexane'] || 0;
  const totalWeight = ccl4Weight + hexaneWeight;

  if (totalWeight <= EPSILON) return 35;

  return ((ccl4Weight * 85) + (hexaneWeight * 30)) / totalWeight;
}

function applyIodinePartition(state: ChemState) {
  const aqueousIodine = state.moles[IODINE_AQUEOUS_FORMULA] || 0;
  const organicIodine = state.moles[IODINE_ORGANIC_FORMULA] || 0;
  const totalIodine = aqueousIodine + organicIodine;

  if (totalIodine <= EPSILON) {
    state.moles[IODINE_AQUEOUS_FORMULA] = 0;
    state.moles[IODINE_ORGANIC_FORMULA] = 0;
    return;
  }

  if ((state.organicVolume || 0) <= EPSILON) {
    state.moles[IODINE_AQUEOUS_FORMULA] = totalIodine;
    state.moles[IODINE_ORGANIC_FORMULA] = 0;
    return;
  }

  if (state.volume <= EPSILON) {
    state.moles[IODINE_AQUEOUS_FORMULA] = 0;
    state.moles[IODINE_ORGANIC_FORMULA] = totalIodine;
    return;
  }

  const aqueousVolumeL = Math.max(EPSILON, state.volume / 1000);
  const organicVolumeL = Math.max(EPSILON, (state.organicVolume || 0) / 1000);
  const partitionCoefficient = getIodinePartitionCoefficient(state);
  const aqueousShare = aqueousVolumeL / (aqueousVolumeL + partitionCoefficient * organicVolumeL);
  const nextAqueousIodine = totalIodine * aqueousShare;

  state.moles[IODINE_AQUEOUS_FORMULA] = nextAqueousIodine;
  state.moles[IODINE_ORGANIC_FORMULA] = Math.max(0, totalIodine - nextAqueousIodine);
}

export function getReagentLiquidContributionML(reagentName: string, addVolumeML: number): number {
  const def = resolveReagentDef(reagentName);
  if (!def) return addVolumeML;
  if (def.state === 's' || def.state === 'g') return 0;
  return Math.max(0, addVolumeML);
}

function applyOrganicLayerEffects(state: ChemState, latestDef?: ReagentDef) {
  if ((state.organicVolume || 0) <= 0) {
    state.organicColor = undefined;
    state.organicDensity = undefined;
    return;
  }

  const organicIodine = state.moles[IODINE_ORGANIC_FORMULA] || 0;
  if (organicIodine > EPSILON) {
    const organicVolumeL = Math.max(EPSILON, (state.organicVolume || 0) / 1000);
    const iodineMolarity = organicIodine / organicVolumeL;
    const opacity = Math.min(0.85, 0.22 + iodineMolarity * 8);
    state.organicColor = `rgba(128,0,128,${opacity})`;
    return;
  }

  state.organicColor = getOrganicTint(latestDef);
}

function applyReactionHeat(state: ChemState, heatJoules: number) {
  const thermalCapacity = getFluidThermalCapacity(state);
  if (heatJoules === 0 || thermalCapacity <= EPSILON) return;
  const deltaTemp = heatJoules / thermalCapacity;
  state.temperature += deltaTemp;
}

function applyReactionRuleSet(state: ChemState, rules: ReactionRule[], events: ReactionEvent[]): boolean {
  let changed = false;

  for (const rule of rules) {
    let maxReactionsPossible = Infinity;
    let canReact = true;

    for (const [reactantFormula, coefficient] of Object.entries(rule.reactants)) {
      const availableMoles = state.moles[reactantFormula] || 0;
      if (availableMoles <= EPSILON) {
        canReact = false;
        break;
      }

      const possibleReactions = availableMoles / coefficient;
      if (possibleReactions < maxReactionsPossible) {
        maxReactionsPossible = possibleReactions;
      }
    }

    if (!canReact || maxReactionsPossible <= EPSILON) {
      continue;
    }

    for (const [reactantFormula, coefficient] of Object.entries(rule.reactants)) {
      state.moles[reactantFormula] -= maxReactionsPossible * coefficient;
      if (state.moles[reactantFormula] < 1e-10) state.moles[reactantFormula] = 0;
    }

    for (const [productFormula, coefficient] of Object.entries(rule.products)) {
      state.moles[productFormula] = (state.moles[productFormula] || 0) + maxReactionsPossible * coefficient;
    }

    applyReactionHeat(state, maxReactionsPossible * rule.enthalpy);
    events.push({ type: rule.type, equation: rule.equationString, log: rule.logMessage });
    changed = true;
  }

  return changed;
}

function getStrongAcidEquivalentMoles(state: ChemState): number {
  return STRONG_ACID_PROFILES.reduce(
    (total, profile) => total + (state.moles[profile.formula] || 0) * profile.protonCount,
    0
  );
}

function getStrongBaseEquivalentMoles(state: ChemState): number {
  return state.moles['NaOH'] || 0;
}

function applyStrongAcidNeutralization(state: ChemState, events: ReactionEvent[]): boolean {
  const baseEquivalentMoles = getStrongBaseEquivalentMoles(state);
  if (baseEquivalentMoles <= EPSILON) return false;

  const acidEntries = STRONG_ACID_PROFILES
    .map(profile => ({
      profile,
      availableMoles: state.moles[profile.formula] || 0,
      acidEquivalentMoles: (state.moles[profile.formula] || 0) * profile.protonCount,
    }))
    .filter(entry => entry.acidEquivalentMoles > EPSILON);

  if (acidEntries.length === 0) return false;

  const totalAcidEquivalentMoles = acidEntries.reduce((sum, entry) => sum + entry.acidEquivalentMoles, 0);
  const neutralizedEquivalentMoles = Math.min(totalAcidEquivalentMoles, baseEquivalentMoles);
  if (neutralizedEquivalentMoles <= EPSILON) return false;

  const equations: string[] = [];
  const acidLabels: string[] = [];
  const saltFormulas = new Set<string>();

  for (const entry of acidEntries) {
    const share = entry.acidEquivalentMoles / totalAcidEquivalentMoles;
    const neutralizedShare = neutralizedEquivalentMoles * share;
    const consumedAcidMoles = neutralizedShare / entry.profile.protonCount;

    if (consumedAcidMoles <= 1e-10) continue;

    state.moles[entry.profile.formula] = Math.max(0, entry.availableMoles - consumedAcidMoles);
    state.moles[entry.profile.sodiumSaltFormula] = (state.moles[entry.profile.sodiumSaltFormula] || 0) + consumedAcidMoles;
    state.moles['H2O'] = (state.moles['H2O'] || 0) + neutralizedShare;

    equations.push(entry.profile.equationString);
    acidLabels.push(entry.profile.label);
    saltFormulas.add(entry.profile.sodiumSaltFormula);
  }

  state.moles['NaOH'] = Math.max(0, baseEquivalentMoles - neutralizedEquivalentMoles);
  applyReactionHeat(state, neutralizedEquivalentMoles * 56000);

  const acidSummary = [...new Set(acidLabels)].join('、');
  const saltSummary = [...saltFormulas].join('、');
  events.push({
    type: 'neutralize',
    equation: [...new Set(equations)].join('；'),
    log: `${acidSummary}与氢氧化钠发生中和，生成 ${saltSummary}`,
  });

  return true;
}

function getReactionPriority(type: string): number {
  if (type.startsWith('redox')) return 5;
  if (type.includes('gas')) return 4;
  if (type.includes('precipitate')) return 3;
  if (type.includes('complex')) return 2;
  if (type === 'neutralize') return 1;
  return 0;
}

function summarizeReactionEvents(initialLog: string, events: ReactionEvent[]) {
  if (events.length === 0) {
    return { log: initialLog, reactionType: 'added', equation: null as string | null };
  }

  const uniqueLogs = [...new Set(events.map(event => event.log))];
  const uniqueEquations = [...new Set(events.map(event => event.equation).filter(Boolean))];
  const dominantEvent = events.reduce((best, current) =>
    getReactionPriority(current.type) > getReactionPriority(best.type) ? current : best
  );

  return {
    log: uniqueLogs.join('；'),
    reactionType: dominantEvent.type,
    equation: uniqueEquations.length > 0 ? uniqueEquations.join('；') : null,
  };
}

function finalizeMixedState(state: ChemState, initialLog: string, latestDef?: ReagentDef): MixResult {
  const newState = cloneState(state);
  const events: ReactionEvent[] = [];

  for (let iteration = 0; iteration < 12; iteration++) {
    let changed = false;

    changed = applyReactionRuleSet(newState, NON_HYDROXIDE_REACTION_RULES, events) || changed;
    changed = applyStrongAcidNeutralization(newState, events) || changed;
    changed = applyReactionRuleSet(newState, HYDROXIDE_REACTION_RULES, events) || changed;

    if (!changed) break;
  }

  newState.boilingPoint = estimateBoilingPoint(newState);

  applyIodinePartition(newState);
  applyOrganicLayerEffects(newState, latestDef);
  newState.pressure = calculatePressureEstimate(newState);
  const summary = summarizeReactionEvents(initialLog, events);
  return { newState: normalizeState(newState), ...summary };
}

export function getTotalLiquidVolume(state: ChemState): number {
  return Math.max(0, state.volume) + Math.max(0, state.organicVolume || 0);
}

export function splitChemState(state: ChemState, desiredVolumeML: number, options: SplitChemStateOptions = {}): SplitChemStateResult {
  const source = cloneState(state);
  const totalVolume = getTotalLiquidVolume(source);
  const transferredVolume = Math.max(0, Math.min(desiredVolumeML, totalVolume));

  if (transferredVolume <= 0 || totalVolume <= 0) {
    return {
      extractedState: createEmptyState(),
      remainingState: normalizeState(source),
      transferredVolume: 0,
    };
  }

  const extractedState = createEmptyState();
  extractedState.temperature = source.temperature;
  extractedState.glassTemp = source.glassTemp;
  extractedState.boilingPoint = source.boilingPoint;

  const remainingState = cloneState(source);

  const phase = resolveSplitPhase(source, options.preferredPhase);

  if (phase === 'organic') {
    const availableOrganic = source.organicVolume || 0;
    const actualTransferred = Math.min(transferredVolume, availableOrganic);
    const ratio = availableOrganic > EPSILON ? actualTransferred / availableOrganic : 0;
    extractedState.volume = 0;
    extractedState.organicVolume = actualTransferred;
    extractedState.organicColor = actualTransferred > 0 ? source.organicColor : undefined;
    extractedState.organicDensity = actualTransferred > 0 ? source.organicDensity : undefined;
    const selector = getTransferSelector('organic', options);
    extractedState.moles = transferMolesByRatio(source.moles, ratio, selector.shouldTransfer, selector.getFactor);

    remainingState.organicVolume = Math.max(0, availableOrganic - actualTransferred);
    remainingState.organicColor = remainingState.organicVolume > EPSILON ? source.organicColor : undefined;
    remainingState.organicDensity = remainingState.organicVolume > EPSILON ? source.organicDensity : undefined;
    for (const [formula, amount] of Object.entries(extractedState.moles)) {
      remainingState.moles[formula] = (remainingState.moles[formula] || 0) - amount;
    }

    if (remainingState.organicVolume <= EPSILON) {
      remainingState.organicColor = undefined;
      remainingState.organicDensity = undefined;
    }

    return {
      extractedState: normalizeState(extractedState),
      remainingState: normalizeState(remainingState),
      transferredVolume: actualTransferred,
    };
  }

  if (phase === 'aqueous') {
    const availableAqueous = source.volume;
    const actualTransferred = Math.min(transferredVolume, availableAqueous);
    const ratio = availableAqueous > EPSILON ? actualTransferred / availableAqueous : 0;
    extractedState.volume = actualTransferred;
    extractedState.organicVolume = 0;
    const selector = getTransferSelector('aqueous', options);
    extractedState.moles = transferMolesByRatio(source.moles, ratio, selector.shouldTransfer, selector.getFactor);

    remainingState.volume = Math.max(0, availableAqueous - actualTransferred);
    for (const [formula, amount] of Object.entries(extractedState.moles)) {
      remainingState.moles[formula] = (remainingState.moles[formula] || 0) - amount;
    }

    return {
      extractedState: normalizeState(extractedState),
      remainingState: normalizeState(remainingState),
      transferredVolume: actualTransferred,
    };
  }

  const ratio = transferredVolume / totalVolume;
  extractedState.volume = source.volume * ratio;
  extractedState.organicVolume = (source.organicVolume || 0) * ratio;
  extractedState.organicColor = extractedState.organicVolume > 0 ? source.organicColor : undefined;
  extractedState.organicDensity = extractedState.organicVolume > 0 ? source.organicDensity : undefined;
  const selector = getTransferSelector('mixed', options);
  extractedState.moles = transferMolesByRatio(source.moles, ratio, selector.shouldTransfer, selector.getFactor);

  remainingState.volume = Math.max(0, source.volume - extractedState.volume);
  remainingState.organicVolume = Math.max(0, (source.organicVolume || 0) - (extractedState.organicVolume || 0));
  remainingState.organicDensity = remainingState.organicVolume > EPSILON ? source.organicDensity : undefined;
  remainingState.organicColor = remainingState.organicVolume > EPSILON ? source.organicColor : undefined;
  for (const [formula, amount] of Object.entries(extractedState.moles)) {
    remainingState.moles[formula] = (remainingState.moles[formula] || 0) - amount;
  }

  return {
    extractedState: normalizeState(extractedState),
    remainingState: normalizeState(remainingState),
    transferredVolume,
  };
}

export function distillChemState(state: ChemState, desiredVolumeML: number): SplitChemStateResult {
  return splitChemState(state, desiredVolumeML, {
    preferredPhase: getPreferredBoilingPhase(state),
    mode: 'distill',
  });
}

export function mergeChemStates(targetState: ChemState, incomingState: ChemState, additionLabel = '混合液'): MixResult {
  const target = cloneState(targetState);
  const incoming = cloneState(incomingState);
  const targetTotal = getTotalLiquidVolume(target);
  const incomingTotal = getTotalLiquidVolume(incoming);
  const combinedTotal = targetTotal + incomingTotal;
  const targetThermalCapacity = getFluidThermalCapacity(target);
  const incomingThermalCapacity = getFluidThermalCapacity(incoming);
  const targetOrganicVolume = target.organicVolume || 0;
  const incomingOrganicVolume = incoming.organicVolume || 0;
  const combinedOrganicVolume = targetOrganicVolume + incomingOrganicVolume;
  const weightedOrganicDensity = combinedOrganicVolume > EPSILON
    ? (((target.organicDensity ?? 0.7) * targetOrganicVolume) + ((incoming.organicDensity ?? 0.7) * incomingOrganicVolume)) / combinedOrganicVolume
    : undefined;

  const newState: ChemState = {
    volume: target.volume + incoming.volume,
    temperature: blendTemperature([
      { temperature: target.temperature, thermalCapacity: targetThermalCapacity },
      { temperature: incoming.temperature, thermalCapacity: incomingThermalCapacity },
    ], ROOM_TEMPERATURE),
    glassTemp: relaxGlassTemperature(
      target.glassTemp || target.temperature,
      blendTemperature([
        { temperature: target.temperature, thermalCapacity: targetThermalCapacity },
        { temperature: incoming.temperature, thermalCapacity: incomingThermalCapacity },
      ], ROOM_TEMPERATURE),
      incomingTotal / Math.max(20, combinedTotal || 20)
    ),
    moles: { ...target.moles },
    boilingPoint: target.boilingPoint || incoming.boilingPoint || 100,
    organicVolume: combinedOrganicVolume,
    organicColor: incoming.organicColor || target.organicColor,
    organicDensity: weightedOrganicDensity,
  };

  for (const [formula, amount] of Object.entries(incoming.moles)) {
    newState.moles[formula] = (newState.moles[formula] || 0) + amount;
  }

  return finalizeMixedState(newState, `混合 ${additionLabel}`);
}

export function mixReagent(state: ChemState, reagentName: string, addVolumeML: number): MixResult {
  const def = resolveReagentDef(reagentName);
  if (!def) return { newState: state, log: `未知试剂: ${reagentName}`, reactionType: 'added', equation: null };

  // Calculate added moles: Molarity (mol/L) * Volume (L)
  const addedMoles = def.molarity * (addVolumeML / 1000);
  const addedLiquidVolume = getReagentLiquidContributionML(reagentName, addVolumeML);
  const addedAqueousVolume = def.isOrganic ? 0 : addedLiquidVolume;
  const addedOrganicVolume = def.isOrganic ? addedLiquidVolume : 0;
  
  const existingThermalCapacity = getFluidThermalCapacity(state);
  const incomingThermalCapacity = getIncomingReagentThermalCapacity(def, addedLiquidVolume, addedMoles);
  const incomingTemperature = getReagentDefaultTemperature(def);
  const mixedTemperatureBeforeReaction = blendTemperature([
    { temperature: state.temperature, thermalCapacity: existingThermalCapacity },
    { temperature: incomingTemperature, thermalCapacity: incomingThermalCapacity },
  ], state.temperature);

  let deltaT = 0;
  const totalThermalCapacity = Math.max(10, existingThermalCapacity + incomingThermalCapacity);
  if (def.enthalpy) {
    const Q = addedMoles * def.enthalpy * 1000;
    deltaT = Q / totalThermalCapacity;
  }
  deltaT = Math.max(-30, Math.min(60, deltaT));
  const relaxedGlassTemp = relaxGlassTemperature(
    state.glassTemp || state.temperature,
    mixedTemperatureBeforeReaction + deltaT,
    addedLiquidVolume / Math.max(20, getTotalLiquidVolume(state) + addedLiquidVolume)
  );

  
  const newState: ChemState = {
    volume: state.volume + addedAqueousVolume,
    temperature: mixedTemperatureBeforeReaction + deltaT,
    glassTemp: relaxedGlassTemp,
    moles: { ...state.moles },
    boilingPoint: state.boilingPoint || 100,
    organicVolume: (state.organicVolume || 0) + addedOrganicVolume,
    organicColor: state.organicColor,
    organicDensity: state.organicDensity,
  };

  // If adding organic solvent
  if (def.isOrganic) {
    newState.organicColor = getOrganicTint(def);
    if (def.density) {
      const existingOrganicVolume = state.organicVolume || 0;
      const combinedOrganicVolume = existingOrganicVolume + addedOrganicVolume;
      newState.organicDensity = combinedOrganicVolume > EPSILON
        ? (((state.organicDensity ?? def.density) * existingOrganicVolume) + (def.density * addedOrganicVolume)) / combinedOrganicVolume
        : def.density;
    }
  } else {
    // Adding water-based reagent, check if we need to extract existing I2
    if (def.formula === 'I2' && newState.organicVolume && newState.organicVolume > 0) {
       newState.organicColor = 'rgba(128,0,128,0.7)'; // turns purple immediately
    }
  }

  // 1. Add the new reagent to the pool
  newState.moles[def.formula] = (newState.moles[def.formula] || 0) + addedMoles;
  return finalizeMixedState(newState, `加入 ${addVolumeML}ml ${reagentName}`, def);
}

// Calculate pH = -log10([H+]) or 14 + log10([OH-])
export function calculatePH(state: ChemState): number {
  if (state.volume === 0) return 7.0;
  const volL = state.volume / 1000;

  const molesH = getStrongAcidEquivalentMoles(state);
  const molesOH = getStrongBaseEquivalentMoles(state);

  const hMolarity = molesH / volL;
  const ohMolarity = molesOH / volL;

  if (hMolarity > ohMolarity) {
    const netH = hMolarity - ohMolarity;
    if (netH <= 1e-7) return 7.0;
    return Math.max(0, -Math.log10(netH));
  } else if (ohMolarity > hMolarity) {
    const netOH = ohMolarity - hMolarity;
    if (netOH <= 1e-7) return 7.0;
    return Math.min(14, 14 + Math.log10(netOH));
  }
  return 7.0;
}

// Calculates realistically mixed rgba color based on concentrations
export function getChemColor(state: ChemState): string {
  if (state.organicVolume && state.organicVolume > 0 && state.volume === 0) {
     return state.organicColor || 'rgba(255,255,255,0.1)';
  }
  
  if (state.volume === 0) return 'rgba(255,255,255,0)';
  
  const volL = state.volume / 1000;
  
  // Base water (clear)
  let r = 255, g = 255, b = 255, a = 0.02;

  // Cu2+ (Cyan/Blue)
  const cuMolarity = (state.moles['CuSO4'] || 0) / volL;
  if (cuMolarity > 0) {
    r = 34; g = 211; b = 238; 
    a = 0.15; // Constant transparency for clear solutions
  }
  
  // MnO4- (Purple)
  const mnMolarity = (state.moles['KMnO4'] || 0) / volL;
  if (mnMolarity > 0) {
    // dynamically fade out based on concentration, KMnO4 is strongly colored even at low conc
    r = 168; g = 85; b = 247; 
    a = Math.min(0.8, 0.05 + mnMolarity * 50); // fades quickly as it approaches 0
  }

  // Fe3+ (Yellowish brown)
  const fe3Molarity = (state.moles['FeCl3'] || 0) / volL;
  if (fe3Molarity > 0) {
    r = 234; g = 179; b = 8;
    a = 0.15;
  }

  // Fe2+ (Light green)
  const fe2Molarity = (state.moles['FeSO4'] || 0) / volL;
  if (fe2Molarity > 0) {
    r = 132; g = 204; b = 22;
    a = 0.15;
  }

  // I2 in aqueous phase (yellow-brown)
  const iodineAqueousMolarity = (state.moles[IODINE_AQUEOUS_FORMULA] || 0) / volL;
  if (iodineAqueousMolarity > 0) {
    r = 180; g = 120; b = 40;
    a = Math.min(0.65, 0.06 + iodineAqueousMolarity * 12);
  }
  
  // Calculate pH to determine indicator colors
  const ph = calculatePH(state);

  // Indicators
  const phenolphthaleinMoles = state.moles['Phenolphthalein'] || 0;
  if (phenolphthaleinMoles > 0) {
    if (ph >= 8.2 && ph <= 10.0) {
      // Transition range (light pink to fuchsia)
      const ratio = (ph - 8.2) / 1.8;
      r = 236; g = 72; b = 153; 
      a = Math.min(0.8, 0.1 + ratio * 0.7);
    } else if (ph > 10.0) {
      // Deep fuchsia
      r = 219; g = 39; b = 119;
      a = 0.8;
    }
    // Below 8.2 it remains colorless (base water color)
  }

  const methylOrangeMoles = state.moles['MethylOrange'] || 0;
  if (methylOrangeMoles > 0) {
    if (ph <= 3.1) {
      // Red
      r = 220; g = 38; b = 38;
      a = 0.4;
    } else if (ph > 3.1 && ph < 4.4) {
      // Orange transition
      const ratio = (ph - 3.1) / 1.3;
      r = 249; g = 115 - ratio * 40; b = 22; // approx blending
      a = 0.4;
    } else {
      // Yellow
      r = 250; g = 204; b = 21;
      a = 0.4;
    }
  }

  // Fe(SCN)3 (Blood Red Complex - Thermochromic!)
  const scnMolarity = (state.moles['Fe(SCN)3'] || 0) / volL;
  if (scnMolarity > 0) {
    // The equilibrium Fe3+ + 3SCN- <=> Fe(SCN)3 is exothermic (releases heat)
    // Thus, heating it shifts equilibrium LEFT (turns lighter/yellowish). 
    // Cooling it shifts RIGHT (turns deep blood red).
    const shiftFactor = Math.max(0.05, Math.min(2.0, 1 - (state.temperature - 22.4) * 0.012));
    
    // Mix the base yellow of Fe3+ with the blood red of Fe(SCN)3 based on temperature
    r = 185; // dark red
    g = 28 + (1 - shiftFactor) * 100; // adding green makes it more yellow/orange
    b = 28;
    a = 0.8 * shiftFactor; // becomes more transparent when heated
  }

  // Cu(NH3)4 Complex (Deep Blue)
  const cuNh3Molarity = (state.moles['Cu(NH3)4SO4'] || 0) / volL;
  if (cuNh3Molarity > 0) {
    r = 30; g = 58; b = 138; // Deeper blue than regular Cu2+
    a = Math.min(0.9, 0.2 + cuNh3Molarity * 20);
  }

  // Precedence for solids/gases in the visual mix:
  if (state.moles['Ag_mirror'] && state.moles['Ag_mirror'] > 1e-5) {
    r = 203; g = 213; b = 225; a = 1.0; // Silver mirror (metallic gray opaque)
  } else if (state.moles['Cu(OH)2'] && state.moles['Cu(OH)2'] > 1e-5) {
    r = 16; g = 185; b = 129; a = 0.85; // Emerald precip (darker green)
  } else if (state.moles['AgCl'] && state.moles['AgCl'] > 1e-5) {
    r = 248; g = 250; b = 252; a = 0.8; // White precip
  } else if (state.moles['BaSO4'] && state.moles['BaSO4'] > 1e-5) {
    r = 255; g = 255; b = 255; a = 0.95; // Dense white precip
  } else if (state.moles['Fe(OH)3'] && state.moles['Fe(OH)3'] > 1e-5) {
    r = 185; g = 28; b = 28; a = 0.95; // Red-brown precip
  } else if (state.moles['Fe(OH)2'] && state.moles['Fe(OH)2'] > 1e-5) {
    r = 163; g = 230; b = 53; a = 0.8; // White/green precip
  } else if (state.moles['Cl2'] && state.moles['Cl2'] > 1e-5) {
    r = 250; g = 204; b = 21; a = 0.6; // Yellow green gas
  }

  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}
