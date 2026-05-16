import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export interface ReagentProps {
  category: ReagentCategory;
  dot: string;
  name: string;
  badgeFormula: React.ReactNode;
}

export interface ReagentShelfProps {
  highlightedReagents?: string[];
  suggestedReagents?: string[];
  dimIrrelevant?: boolean;
}

type ReagentCategory = '基础酸碱' | '金属盐' | '氧化还原' | '萃取/有机' | '指示剂';

type ReagentGroup = {
  id: ReagentCategory;
  label: ReagentCategory;
  description: string;
  items: ReagentProps[];
};

const REAGENT_GROUPS: ReagentGroup[] = [
  {
    id: '基础酸碱',
    label: '基础酸碱',
    description: '适合中和、滴定与配制基础体系。',
    items: [
      { category: '基础酸碱', dot: '#facc15', name: '盐酸', badgeFormula: <>HCl · 1M</> },
      { category: '基础酸碱', dot: '#3b82f6', name: '氢氧化钠', badgeFormula: <>NaOH · 1M</> },
      { category: '基础酸碱', dot: '#60a5fa', name: '氨水', badgeFormula: <>NH₃·H₂O · 1M</> },
    ],
  },
  {
    id: '金属盐',
    label: '金属盐',
    description: '覆盖沉淀、络合与离子鉴定常用盐类。',
    items: [
      { category: '金属盐', dot: '#22d3ee', name: '硫酸铜', badgeFormula: <>CuSO₄ · 0.5M</> },
      { category: '金属盐', dot: '#e2e8f0', name: '硝酸银', badgeFormula: <>AgNO₃ · 0.1M</> },
      { category: '金属盐', dot: '#eab308', name: '氯化铁', badgeFormula: <>FeCl₃ · 0.5M</> },
      { category: '金属盐', dot: '#a3e635', name: '硫酸亚铁', badgeFormula: <>FeSO₄ · 0.5M</> },
      { category: '金属盐', dot: '#f8fafc', name: '碳酸钠', badgeFormula: <>Na₂CO₃ · 1M</> },
    ],
  },
  {
    id: '氧化还原',
    label: '氧化还原',
    description: '用于氧化剂、还原剂与放热过程演示。',
    items: [
      { category: '氧化还原', dot: '#a855f7', name: '高锰酸钾', badgeFormula: <>KMnO₄ · 0.01M</> },
      { category: '氧化还原', dot: '#ffffff', name: '双氧水', badgeFormula: <>H₂O₂ · 1M</> },
      { category: '氧化还原', dot: '#f1f5f9', name: '草酸 (H₂C₂O₄)', badgeFormula: <>H₂C₂O₄ · 0.5M</> },
    ],
  },
  {
    id: '萃取/有机',
    label: '萃取/有机',
    description: '聚焦有机相、分层与碘萃取相关试剂。',
    items: [
      { category: '萃取/有机', dot: '#ffffff', name: '四氯化碳 (CCl₄)', badgeFormula: <>CCl₄ · 纯</> },
      { category: '萃取/有机', dot: '#a8a29e', name: '碘水 (I₂ aq)', badgeFormula: <>I₂ · 0.05M</> },
      { category: '萃取/有机', dot: '#2e0a2e', name: '碘单质 (I₂ 固体)', badgeFormula: <>I₂ · 升华相变</> },
    ],
  },
  {
    id: '指示剂',
    label: '指示剂',
    description: '用于颜色变化与终点判断。',
    items: [
      { category: '指示剂', dot: '#fbcfe8', name: '酚酞指示剂', badgeFormula: <>Phenolphthalein</> },
      { category: '指示剂', dot: '#fdba74', name: '甲基橙指示剂', badgeFormula: <>Methyl Orange</> },
    ],
  },
];

export function ReagentShelf({
  highlightedReagents = [],
  suggestedReagents = [],
  dimIrrelevant = false,
}: ReagentShelfProps) {
  const [activeCategory, setActiveCategory] = useState<'全部' | ReagentCategory>('全部');

  const highlightedSet = useMemo(() => new Set(highlightedReagents), [highlightedReagents]);
  const suggestedSet = useMemo(
    () => new Set(suggestedReagents.filter(name => !highlightedSet.has(name))),
    [highlightedSet, suggestedReagents]
  );
  const hasMissionHighlights = highlightedSet.size > 0 || suggestedSet.size > 0;

  const visibleGroups = useMemo(
    () => REAGENT_GROUPS
      .filter(group => activeCategory === '全部' || group.id === activeCategory)
      .map(group => ({
        ...group,
        items: group.items
          .map((item, index) => ({ item, index }))
          .sort((a, b) => {
            const scoreA = highlightedSet.has(a.item.name) ? 2 : suggestedSet.has(a.item.name) ? 1 : 0;
            const scoreB = highlightedSet.has(b.item.name) ? 2 : suggestedSet.has(b.item.name) ? 1 : 0;
            return scoreB - scoreA || a.index - b.index;
          })
          .map(entry => entry.item),
      }))
      .sort((a, b) => {
        const scoreA = a.items.reduce((sum, item) => sum + (highlightedSet.has(item.name) ? 2 : suggestedSet.has(item.name) ? 1 : 0), 0);
        const scoreB = b.items.reduce((sum, item) => sum + (highlightedSet.has(item.name) ? 2 : suggestedSet.has(item.name) ? 1 : 0), 0);
        return scoreB - scoreA;
      }),
    [activeCategory, highlightedSet, suggestedSet]
  );

  const renderReagentCard = (item: ReagentProps, key: string) => {
    const isHighlighted = highlightedSet.has(item.name);
    const isSuggested = suggestedSet.has(item.name);
    const isMuted = dimIrrelevant && hasMissionHighlights && !isHighlighted && !isSuggested;

    const emitWorkspaceDragState = (active: boolean, point?: { x: number; y: number }) => {
      window.dispatchEvent(new CustomEvent('workspaceDragState', {
        detail: {
          active,
          kind: 'reagent',
          name: item.name,
          point,
        }
      }));
    };

    return (
      <motion.div
        drag
        dragSnapToOrigin
        dragElastic={0.2}
        onDragStart={(_e, info) => emitWorkspaceDragState(true, info.point)}
        onDrag={(_e, info) => emitWorkspaceDragState(true, info.point)}
        onDragEnd={(e, i) => {
          emitWorkspaceDragState(false);
          const customEvent = new CustomEvent('reagentDrop', {
            detail: { event: e, info: i, type: 'reagent', name: item.name, isDrop: true }
          });
          window.dispatchEvent(customEvent);
        }}
        whileDrag={{ scale: 0.95, zIndex: 100, opacity: 0.8, cursor: 'grabbing', rotate: 2 }}
        key={key}
        className={`min-h-[58px] flex items-center justify-between px-3 py-3 rounded-xl border transition-all duration-200 cursor-grab group relative overflow-visible ${isHighlighted
          ? 'border-[#22d3ee]/40 bg-[rgba(34,211,238,0.10)] shadow-[0_0_18px_rgba(34,211,238,0.12)]'
          : isSuggested
          ? 'border-[#c084fc]/28 bg-[rgba(168,85,247,0.08)] shadow-[0_0_14px_rgba(168,85,247,0.08)]'
          : 'border-white/6 bg-[rgba(255,255,255,0.02)] hover:border-[#22d3ee]/18 hover:bg-[rgba(34,211,238,0.05)] hover:shadow-[0_0_16px_rgba(34,211,238,0.08)]'} ${isMuted ? 'opacity-50 saturate-[0.75]' : ''}`}
        style={{ touchAction: 'none' }}
      >
        <div
          className={`absolute inset-0 transition-opacity duration-200 pointer-events-none rounded-xl ${isHighlighted || isSuggested ? 'opacity-[0.16]' : 'opacity-0 group-hover:opacity-10'}`}
          style={{ backgroundColor: item.dot }}
        ></div>

        {(isHighlighted || isSuggested) && (
          <div className="absolute top-2 right-2 z-10 pointer-events-none">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isHighlighted
              ? 'border-[#22d3ee]/35 bg-[#22d3ee]/14 text-[#67e8f9]'
              : 'border-[#c084fc]/30 bg-[#a855f7]/14 text-[#e9d5ff]'}`}
            >
              {isHighlighted ? '任务相关' : '可尝试'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 overflow-hidden mr-2 relative z-10 pointer-events-none min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-[9999px] shrink-0 transition-transform duration-300 ease-out shadow-[0_0_10px_currentColor] ${isHighlighted ? 'scale-[1.3]' : 'group-hover:scale-[1.25]'}`}
            style={{ backgroundColor: item.dot }}
          ></span>
          <span className={`text-[14px] font-medium truncate ${isHighlighted ? 'text-white' : 'text-[#e2e8f0]'}`}>
            {item.name}
          </span>
        </div>

        <div
          className="shrink-0 max-w-[48%] px-2.5 py-1 rounded-[9999px] text-[12px] font-mono leading-tight flex items-center justify-center relative z-10 pointer-events-none reagent-badge whitespace-nowrap overflow-hidden text-ellipsis border border-white/6"
          style={{
            backgroundColor: `color-mix(in srgb, ${item.dot} 15%, transparent)`,
            color: item.dot,
            fontFamily: "'JetBrains Mono', monospace"
          }}
        >
          {item.badgeFormula}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex-1 min-h-[340px] flex flex-col overflow-hidden glass-panel">
      <div className="shrink-0 flex gap-2 overflow-x-auto px-3 py-3 border-b border-white/6 bg-black/10">
        <button
          type="button"
          onClick={() => setActiveCategory('全部')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] border transition-colors ${activeCategory === '全部' ? 'border-[#22d3ee]/40 bg-[#22d3ee]/12 text-[#22d3ee] shadow-[0_0_14px_rgba(34,211,238,0.12)]' : 'border-white/8 bg-white/4 text-[#94a3b8] hover:text-white'}`}
        >
          全部
        </button>
        {REAGENT_GROUPS.map(group => (
          <button
            key={group.id}
            type="button"
            onClick={() => setActiveCategory(group.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] border transition-colors ${activeCategory === group.id ? 'border-[#22d3ee]/40 bg-[#22d3ee]/12 text-[#22d3ee] shadow-[0_0_14px_rgba(34,211,238,0.12)]' : 'border-white/8 bg-white/4 text-[#94a3b8] hover:text-white'}`}
          >
            {group.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4 pr-2">
        {hasMissionHighlights && (
          <section className="rounded-2xl border border-[#22d3ee]/16 bg-[rgba(34,211,238,0.05)] px-3 py-3">
            <div className="mb-2 text-[11px] font-semibold text-[#67e8f9]">任务试剂</div>
            <div className="flex flex-wrap gap-2">
              {highlightedReagents.map(name => (
                <span key={name} className="px-2 py-1 rounded-full border border-[#22d3ee]/25 bg-[#22d3ee]/10 text-[11px] text-[#67e8f9]">
                  {name}
                </span>
              ))}
              {suggestedReagents.filter(name => !highlightedSet.has(name)).map(name => (
                <span key={name} className="px-2 py-1 rounded-full border border-[#a855f7]/25 bg-[#a855f7]/10 text-[11px] text-[#e9d5ff]">
                  {name}
                </span>
              ))}
            </div>
          </section>
        )}
        {visibleGroups.map(group => (
          <section key={group.id} className="space-y-2">
            <div className="px-1 flex items-center justify-between gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[13px] font-semibold text-[#e2e8f0]">{group.label}</h3>
                <span className="text-[11px] text-[#64748b] px-2 py-0.5 rounded-full bg-white/4 border border-white/6">{group.items.length} 项</span>
              </div>
            </div>
            {group.items.map((item, index) => renderReagentCard(item, `${group.id}-${index}`))}
          </section>
        ))}
        <div className="mt-4 text-[#475569] italic text-[13px] text-center w-full pt-3 border-t border-white/5">
          拖入容器
        </div>
      </div>
    </div>
  );
}
