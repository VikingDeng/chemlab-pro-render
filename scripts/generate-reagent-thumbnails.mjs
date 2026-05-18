import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outputDir = join(process.cwd(), 'public', 'reagents');
mkdirSync(outputDir, { recursive: true });

const reagents = [
  ['unknown-a', 'A', '?', '#38bdf8', '#155e75', 'vial'],
  ['unknown-b', 'B', '?', '#f8fafc', '#94a3b8', 'vial'],
  ['unknown-c', 'C', '?', '#f59e0b', '#7c2d12', 'vial'],
  ['unknown-d', 'D', '?', '#e2e8f0', '#64748b', 'vial'],
  ['unknown-e', 'E', '?', '#a78bfa', '#4c1d95', 'vial'],
  ['unknown-f', 'F', '?', '#c084fc', '#581c87', 'vial'],
  ['hcl', 'HCl', '酸', '#facc15', '#713f12', 'bottle'],
  ['h2so4', 'H₂SO₄', '酸', '#f8fafc', '#64748b', 'bottle'],
  ['hno3', 'HNO₃', '酸', '#fef3c7', '#92400e', 'bottle'],
  ['naoh', 'NaOH', '碱', '#3b82f6', '#1e3a8a', 'bottle'],
  ['nh3', 'NH₃', '碱', '#60a5fa', '#075985', 'bottle'],
  ['cuso4', 'CuSO₄', '盐', '#22d3ee', '#164e63', 'bottle'],
  ['agno3', 'AgNO₃', '盐', '#e2e8f0', '#475569', 'bottle'],
  ['fecl3', 'FeCl₃', '盐', '#eab308', '#713f12', 'bottle'],
  ['feso4', 'FeSO₄', '盐', '#a3e635', '#365314', 'bottle'],
  ['bacl2', 'BaCl₂', '盐', '#f8fafc', '#64748b', 'bottle'],
  ['na2co3', 'Na₂CO₃', '盐', '#f8fafc', '#64748b', 'powder'],
  ['kscn', 'KSCN', '盐', '#fee2e2', '#991b1b', 'bottle'],
  ['kmno4', 'KMnO₄', '氧化', '#a855f7', '#4c1d95', 'bottle'],
  ['h2o2', 'H₂O₂', '氧化', '#ffffff', '#64748b', 'brown'],
  ['oxalic', 'H₂C₂O₄', '还原', '#f1f5f9', '#475569', 'powder'],
  ['glucose', 'Glucose', '还原', '#fef9c3', '#854d0e', 'powder'],
  ['ccl4', 'CCl₄', '有机', '#ffffff', '#475569', 'solvent'],
  ['hexane', 'Hexane', '有机', '#e0f2fe', '#0369a1', 'solvent'],
  ['i2-aq', 'I₂ aq', '碘水', '#a8a29e', '#3f2f25', 'bottle'],
  ['i2-solid', 'I₂', '固体', '#2e0a2e', '#160416', 'amberjar'],
  ['phenolphthalein', '酚酞', '指示剂', '#fbcfe8', '#831843', 'dropper'],
  ['methyl-orange', '甲基橙', '指示剂', '#fdba74', '#9a3412', 'dropper'],
];

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function bottleBody(kind, id, liquid, dark) {
  const amber = kind === 'brown' || kind === 'amberjar';
  const solvent = kind === 'solvent';
  const powder = kind === 'powder';
  const dropper = kind === 'dropper';
  const vial = kind === 'vial';
  const bodyFill = amber ? '#6b3f1d' : solvent ? '#dbeafe' : powder ? '#f8fafc' : '#e5eef8';
  const glassOpacity = amber ? 0.72 : solvent ? 0.56 : 0.44;
  const labelY = vial ? 68 : 74;
  const liquidY = vial ? 74 : 82;
  const liquidH = vial ? 42 : 44;
  const bottleX = vial ? 38 : 32;
  const bottleW = vial ? 68 : 80;
  const capX = vial ? 50 : 45;
  const capW = vial ? 44 : dropper ? 54 : 54;
  const shoulder = vial ? 'M47 43 C47 34 55 31 58 25 H86 C89 31 97 34 97 43' : 'M42 45 C42 35 52 32 55 24 H89 C92 32 102 35 102 45';
  const bodyPath = vial
    ? `${shoulder} V124 C97 132 91 137 82 137 H62 C53 137 47 132 47 124 Z`
    : `${shoulder} V127 C102 136 95 142 84 142 H60 C49 142 42 136 42 127 Z`;

  if (kind === 'amberjar' || powder) {
    return `
      <ellipse cx="72" cy="141" rx="50" ry="10" fill="#020617" opacity="0.36"/>
      <path d="${bodyPath}" fill="url(#body-${id})" stroke="rgba(255,255,255,.48)" stroke-width="2"/>
      <path d="M${bottleX + 10} ${liquidY + 18} C${bottleX + 28} ${liquidY + 5} ${bottleX + 48} ${liquidY + 35} ${bottleX + bottleW - 8} ${liquidY + 16} V124 C${bottleX + bottleW - 8} 130 ${bottleX + bottleW - 17} 134 ${bottleX + bottleW - 26} 134 H${bottleX + 26} C${bottleX + 17} 134 ${bottleX + 10} 130 ${bottleX + 10} 124 Z" fill="url(#liquid-${id})" opacity="0.82"/>
      <rect x="${capX}" y="17" width="${capW}" height="16" rx="5" fill="#1f2937"/>
      <rect x="${capX + 5}" y="11" width="${capW - 10}" height="8" rx="4" fill="#334155"/>
      <rect x="49" y="${labelY}" width="46" height="34" rx="7" fill="rgba(248,250,252,.9)"/>
      <path d="M55 48 C59 42 85 40 93 49" stroke="white" opacity=".34" stroke-width="3" stroke-linecap="round"/>
      <rect x="52" y="51" width="7" height="66" rx="3.5" fill="white" opacity=".28"/>
    `;
  }

  return `
    <ellipse cx="72" cy="141" rx="50" ry="10" fill="#020617" opacity="0.36"/>
    <path d="${bodyPath}" fill="url(#body-${id})" stroke="rgba(255,255,255,.55)" stroke-width="2"/>
    <path d="M${bottleX + 8} ${liquidY} C${bottleX + 28} ${liquidY - 8} ${bottleX + 45} ${liquidY + 9} ${bottleX + bottleW - 8} ${liquidY} V124 C${bottleX + bottleW - 8} 131 ${bottleX + bottleW - 16} 136 ${bottleX + bottleW - 26} 136 H${bottleX + 26} C${bottleX + 16} 136 ${bottleX + 8} 131 ${bottleX + 8} 124 Z" fill="url(#liquid-${id})" opacity="${glassOpacity}"/>
    ${dropper ? `<path d="M55 21 L89 21 L83 8 H61 Z" fill="#111827"/><rect x="59" y="3" width="26" height="12" rx="6" fill="#334155"/>` : `<rect x="${capX}" y="17" width="${capW}" height="16" rx="5" fill="#1f2937"/><rect x="${capX + 5}" y="11" width="${capW - 10}" height="8" rx="4" fill="#334155"/>`}
    <rect x="49" y="${labelY}" width="46" height="34" rx="7" fill="rgba(248,250,252,.9)"/>
    <path d="M55 48 C59 42 85 40 93 49" stroke="white" opacity=".38" stroke-width="3" stroke-linecap="round"/>
    <rect x="52" y="51" width="7" height="66" rx="3.5" fill="white" opacity=".30"/>
  `;
}

function svg([file, formula, label, liquid, dark, kind]) {
  const id = file.replace(/[^a-z0-9]/gi, '-');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="160" viewBox="0 0 144 160" role="img" aria-label="${esc(formula)} reagent bottle">
  <defs>
    <radialGradient id="bg-${id}" cx="28%" cy="18%" r="82%">
      <stop offset="0" stop-color="${esc(liquid)}" stop-opacity="0.34"/>
      <stop offset="0.52" stop-color="#0f172a" stop-opacity="0.88"/>
      <stop offset="1" stop-color="#020617"/>
    </radialGradient>
    <linearGradient id="body-${id}" x1="35" x2="104" y1="24" y2="139" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.72"/>
      <stop offset="0.42" stop-color="#dbeafe" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#0f172a" stop-opacity="0.52"/>
    </linearGradient>
    <linearGradient id="liquid-${id}" x1="45" x2="102" y1="74" y2="136" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${esc(liquid)}" stop-opacity="0.96"/>
      <stop offset="1" stop-color="${esc(dark)}" stop-opacity="0.94"/>
    </linearGradient>
    <filter id="grain-${id}" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 0.045"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="144" height="160" rx="28" fill="url(#bg-${id})"/>
  <rect width="144" height="160" rx="28" fill="#fff" opacity="0.035" filter="url(#grain-${id})"/>
  <circle cx="33" cy="26" r="34" fill="${esc(liquid)}" opacity="0.18"/>
  ${bottleBody(kind, id, liquid, dark)}
  <text x="72" y="92" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="750" fill="#0f172a">${esc(formula)}</text>
  <text x="72" y="109" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="700" fill="#475569">${esc(label)}</text>
  <path d="M20 20 C34 8 58 7 71 10" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.28"/>
</svg>`;
}

for (const reagent of reagents) {
  writeFileSync(join(outputDir, `${reagent[0]}.svg`), svg(reagent));
}

console.log(`Generated ${reagents.length} reagent thumbnails in ${outputDir}`);
