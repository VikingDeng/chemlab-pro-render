import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  showUnknownSamples?: boolean;
  className?: string;
  focusOnly?: boolean;
  focusSignal?: number;
  quickAddEnabled?: boolean;
}

type ReagentCategory = '未知样品' | '基础酸碱' | '金属盐' | '氧化还原' | '萃取/有机' | '指示剂';

type ReagentGroup = {
  id: ReagentCategory;
  label: ReagentCategory;
  description: string;
  items: ReagentProps[];
};

type DragPoint = { x: number; y: number };

type WorkspaceDragStateDetail = {
  active: boolean;
  kind: 'reagent';
  name: string;
  point?: DragPoint;
};

type ActiveReagentPointer = {
  pointerId: number;
  item: ReagentProps;
  start: DragPoint;
  last: DragPoint;
  dragging: boolean;
  element: HTMLDivElement;
};

const REAGENT_IMAGE_BY_NAME: Record<string, string> = {
  '未知样品 A': '/reagents/unknown-a.jpg',
  '未知样品 B': '/reagents/unknown-b.jpg',
  '未知样品 C': '/reagents/unknown-c.jpg',
  '未知样品 D': '/reagents/unknown-d.jpg',
  '未知样品 E': '/reagents/unknown-e.jpg',
  '未知样品 F': '/reagents/unknown-f.jpg',
  '盐酸': '/reagents/hcl.jpg',
  '硫酸': '/reagents/h2so4.jpg',
  '硝酸': '/reagents/hno3.jpg',
  '氢氧化钠': '/reagents/naoh.jpg',
  '氨水': '/reagents/nh3.jpg',
  '硫酸铜': '/reagents/cuso4.jpg',
  '硝酸银': '/reagents/agno3.jpg',
  '氯化铁': '/reagents/fecl3.jpg',
  '硫酸亚铁': '/reagents/feso4.jpg',
  '氯化钡': '/reagents/bacl2.jpg',
  '碳酸钠': '/reagents/na2co3.jpg',
  '硫氰化钾': '/reagents/kscn.jpg',
  '高锰酸钾': '/reagents/kmno4.jpg',
  '双氧水': '/reagents/h2o2.jpg',
  '草酸 (H₂C₂O₄)': '/reagents/oxalic.jpg',
  '葡萄糖 (Glucose)': '/reagents/glucose.jpg',
  '四氯化碳 (CCl₄)': '/reagents/ccl4.jpg',
  '正己烷 (Hexane)': '/reagents/hexane.jpg',
  '碘水 (I₂ aq)': '/reagents/i2-aq.jpg',
  '碘单质 (I₂ 固体)': '/reagents/i2-solid.jpg',
  '酚酞指示剂': '/reagents/phenolphthalein.jpg',
  '甲基橙指示剂': '/reagents/methyl-orange.jpg',
};

function getReagentImageSrc(name: string) {
  return REAGENT_IMAGE_BY_NAME[name] || '/reagents/unknown-a.jpg';
}

const REAGENT_GROUPS: ReagentGroup[] = [
  {
    id: '未知样品',
    label: '未知样品',
    description: '闯关用样品，只通过现象判断成分。',
    items: [
      { category: '未知样品', dot: '#38bdf8', name: '未知样品 A', badgeFormula: <>A · ?</> },
      { category: '未知样品', dot: '#f8fafc', name: '未知样品 B', badgeFormula: <>B · ?</> },
      { category: '未知样品', dot: '#f59e0b', name: '未知样品 C', badgeFormula: <>C · ?</> },
      { category: '未知样品', dot: '#e2e8f0', name: '未知样品 D', badgeFormula: <>D · ?</> },
      { category: '未知样品', dot: '#a78bfa', name: '未知样品 E', badgeFormula: <>E · ?</> },
      { category: '未知样品', dot: '#c084fc', name: '未知样品 F', badgeFormula: <>F · ?</> },
    ],
  },
  {
    id: '基础酸碱',
    label: '基础酸碱',
    description: '适合中和、滴定与配制基础体系。',
    items: [
      { category: '基础酸碱', dot: '#facc15', name: '盐酸', badgeFormula: <>HCl · 1M</> },
      { category: '基础酸碱', dot: '#f8fafc', name: '硫酸', badgeFormula: <>H₂SO₄ · 0.5M</> },
      { category: '基础酸碱', dot: '#fef3c7', name: '硝酸', badgeFormula: <>HNO₃ · 1M</> },
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
      { category: '金属盐', dot: '#f8fafc', name: '氯化钡', badgeFormula: <>BaCl₂ · 0.5M</> },
      { category: '金属盐', dot: '#f8fafc', name: '碳酸钠', badgeFormula: <>Na₂CO₃ · 1M</> },
      { category: '金属盐', dot: '#fee2e2', name: '硫氰化钾', badgeFormula: <>KSCN · 0.5M</> },
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
      { category: '氧化还原', dot: '#fef9c3', name: '葡萄糖 (Glucose)', badgeFormula: <>Glucose · 0.5M</> },
    ],
  },
  {
    id: '萃取/有机',
    label: '萃取/有机',
    description: '聚焦有机相、分层与碘萃取相关试剂。',
    items: [
      { category: '萃取/有机', dot: '#ffffff', name: '四氯化碳 (CCl₄)', badgeFormula: <>CCl₄ · 纯</> },
      { category: '萃取/有机', dot: '#e0f2fe', name: '正己烷 (Hexane)', badgeFormula: <>Hexane · 纯</> },
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
  showUnknownSamples = false,
  className = '',
  focusOnly = false,
  focusSignal = 0,
  quickAddEnabled = false,
}: ReagentShelfProps) {
  const [activeCategory, setActiveCategory] = useState<'全部' | ReagentCategory>('全部');
  const [dragGhost, setDragGhost] = useState<ReagentProps | null>(null);
  const [draggingReagentName, setDraggingReagentName] = useState<string | null>(null);
  const effectiveActiveCategory = !showUnknownSamples && activeCategory === '未知样品' ? '全部' : activeCategory;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragClickGuardRef = useRef(false);
  const activePointerRef = useRef<ActiveReagentPointer | null>(null);
  const dragGhostRef = useRef<HTMLDivElement>(null);
  const dragGhostPointRef = useRef<DragPoint | null>(null);
  const dragGhostFrameRef = useRef<number | null>(null);
  const pendingWorkspaceDragStateRef = useRef<WorkspaceDragStateDetail | null>(null);
  const workspaceDragStateFrameRef = useRef<number | null>(null);

  const highlightedSet = useMemo(() => new Set(highlightedReagents), [highlightedReagents]);
  const suggestedSet = useMemo(
    () => new Set(suggestedReagents.filter(name => !highlightedSet.has(name))),
    [highlightedSet, suggestedReagents]
  );
  const hasMissionHighlights = highlightedSet.size > 0 || suggestedSet.size > 0;
  const isRelevant = useCallback((item: ReagentProps) => highlightedSet.has(item.name) || suggestedSet.has(item.name), [highlightedSet, suggestedSet]);

  const visibleGroups = useMemo(
    () => REAGENT_GROUPS
      .filter(group => showUnknownSamples || group.id !== '未知样品')
      .filter(group => effectiveActiveCategory === '全部' || group.id === effectiveActiveCategory)
      .map(group => ({
        ...group,
        items: group.items
          .filter(item => !focusOnly || !hasMissionHighlights || isRelevant(item))
          .map((item, index) => ({ item, index }))
          .sort((a, b) => {
            const scoreA = highlightedSet.has(a.item.name) ? 2 : suggestedSet.has(a.item.name) ? 1 : 0;
            const scoreB = highlightedSet.has(b.item.name) ? 2 : suggestedSet.has(b.item.name) ? 1 : 0;
            return scoreB - scoreA || a.index - b.index;
          })
          .map(entry => entry.item),
      }))
      .filter(group => group.items.length > 0)
      .sort((a, b) => {
        const scoreA = a.items.reduce((sum, item) => sum + (highlightedSet.has(item.name) ? 2 : suggestedSet.has(item.name) ? 1 : 0), 0);
        const scoreB = b.items.reduce((sum, item) => sum + (highlightedSet.has(item.name) ? 2 : suggestedSet.has(item.name) ? 1 : 0), 0);
        return scoreB - scoreA;
      }),
    [effectiveActiveCategory, focusOnly, hasMissionHighlights, highlightedSet, isRelevant, showUnknownSamples, suggestedSet]
  );

  const categoryGroups = useMemo(
    () => REAGENT_GROUPS
      .filter(group => showUnknownSamples || group.id !== '未知样品')
      .filter(group => !focusOnly || !hasMissionHighlights || group.items.some(isRelevant)),
    [focusOnly, hasMissionHighlights, isRelevant, showUnknownSamples]
  );

  useEffect(() => {
    if (!focusSignal) return;
    const frame = requestAnimationFrame(() => {
      setActiveCategory('全部');
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusSignal]);

  useEffect(() => {
    return () => {
      if (dragGhostFrameRef.current !== null) {
        cancelAnimationFrame(dragGhostFrameRef.current);
      }
      if (workspaceDragStateFrameRef.current !== null) {
        cancelAnimationFrame(workspaceDragStateFrameRef.current);
      }
      document.body.classList.remove('reagent-drag-active');
    };
  }, []);

  const dispatchWorkspaceDragState = useCallback((detail: WorkspaceDragStateDetail) => {
    window.dispatchEvent(new CustomEvent('workspaceDragState', { detail }));
  }, []);

  const emitWorkspaceDragState = useCallback((detail: WorkspaceDragStateDetail) => {
    if (!detail.active) {
      if (workspaceDragStateFrameRef.current !== null) {
        cancelAnimationFrame(workspaceDragStateFrameRef.current);
        workspaceDragStateFrameRef.current = null;
      }
      pendingWorkspaceDragStateRef.current = null;
      dispatchWorkspaceDragState(detail);
      return;
    }

    pendingWorkspaceDragStateRef.current = detail;
    if (workspaceDragStateFrameRef.current !== null) return;

    workspaceDragStateFrameRef.current = requestAnimationFrame(() => {
      workspaceDragStateFrameRef.current = null;
      const nextDetail = pendingWorkspaceDragStateRef.current;
      pendingWorkspaceDragStateRef.current = null;
      if (nextDetail) {
        dispatchWorkspaceDragState(nextDetail);
      }
    });
  }, [dispatchWorkspaceDragState]);

  const positionDragGhost = useCallback((point: DragPoint) => {
    dragGhostPointRef.current = point;
    if (dragGhostFrameRef.current !== null) return;

    dragGhostFrameRef.current = requestAnimationFrame(() => {
      dragGhostFrameRef.current = null;
      const nextPoint = dragGhostPointRef.current;
      const ghostElement = dragGhostRef.current;
      if (!nextPoint || !ghostElement) return;
      ghostElement.style.transform = `translate3d(${nextPoint.x}px, ${nextPoint.y}px, 0) translate(-50%, -50%)`;
    });
  }, []);

  const clearDragGhost = useCallback(() => {
    if (dragGhostFrameRef.current !== null) {
      cancelAnimationFrame(dragGhostFrameRef.current);
      dragGhostFrameRef.current = null;
    }
    dragGhostPointRef.current = null;
    activePointerRef.current = null;
    document.body.classList.remove('reagent-drag-active');
    setDraggingReagentName(null);
    setDragGhost(null);
  }, []);

  const renderReagentCard = (item: ReagentProps, key: string) => {
    const isHighlighted = highlightedSet.has(item.name);
    const isSuggested = suggestedSet.has(item.name);
    const isMuted = dimIrrelevant && hasMissionHighlights && !isHighlighted && !isSuggested;
    const imageSrc = getReagentImageSrc(item.name);

    const updateWorkspaceDragState = (active: boolean, point?: DragPoint) => {
      emitWorkspaceDragState({
        active,
        kind: 'reagent',
        name: item.name,
        point,
      });
    };

    const beginDragGhost = (point: DragPoint) => {
      setDragGhost(item);
      setDraggingReagentName(item.name);
      document.body.classList.add('reagent-drag-active');
      positionDragGhost(point);
    };

    const emitQuickAdd = () => {
      if (!quickAddEnabled || dragClickGuardRef.current) return;
      window.dispatchEvent(new CustomEvent('quickAddReagent', {
        detail: {
          name: item.name,
          tone: isHighlighted ? 'main' : isSuggested ? 'try' : 'free',
        },
      }));
    };

    const beginPointer = (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      const point = { x: event.clientX, y: event.clientY };
      document.body.classList.add('reagent-drag-active');
      activePointerRef.current = {
        pointerId: event.pointerId,
        item,
        start: point,
        last: point,
        dragging: false,
        element: event.currentTarget,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const movePointer = (event: React.PointerEvent<HTMLDivElement>) => {
      const active = activePointerRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const point = { x: event.clientX, y: event.clientY };
      active.last = point;
      const distance = Math.hypot(point.x - active.start.x, point.y - active.start.y);

      if (!active.dragging && distance >= 4) {
        active.dragging = true;
        dragClickGuardRef.current = true;
        beginDragGhost(point);
      }

      if (!active.dragging) return;
      event.preventDefault();
      updateWorkspaceDragState(true, point);
      positionDragGhost(point);
    };

    const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
      const active = activePointerRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const point = { x: event.clientX, y: event.clientY };
      active.last = point;
      active.element.releasePointerCapture?.(event.pointerId);

      if (active.dragging) {
        updateWorkspaceDragState(false);
        clearDragGhost();
        window.setTimeout(() => {
          dragClickGuardRef.current = false;
        }, 0);
        window.dispatchEvent(new CustomEvent('reagentDrop', {
          detail: {
            event: { clientX: point.x, clientY: point.y },
            info: { point },
            type: 'reagent',
            name: item.name,
            isDrop: true,
          },
        }));
        return;
      }

      activePointerRef.current = null;
      document.body.classList.remove('reagent-drag-active');
      emitQuickAdd();
    };

    const cancelPointer = (event: React.PointerEvent<HTMLDivElement>) => {
      const active = activePointerRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      updateWorkspaceDragState(false);
      clearDragGhost();
      window.setTimeout(() => {
        dragClickGuardRef.current = false;
      }, 0);
    };

    const isDragging = draggingReagentName === item.name;

    return (
      <div
        key={key}
        onPointerDown={beginPointer}
        onPointerMove={movePointer}
        onPointerUp={finishPointer}
        onPointerCancel={cancelPointer}
        className={`reagent-card isolate min-h-[68px] flex items-center justify-between pl-2.5 pr-3 py-2 rounded-xl border transition-all duration-200 cursor-grab group relative overflow-visible ${isDragging ? 'reagent-card-dragging opacity-35' : ''} ${quickAddEnabled ? 'active:scale-[0.99]' : ''} ${isHighlighted
          ? 'border-[#22d3ee]/40 bg-[rgba(34,211,238,0.10)] shadow-[0_0_18px_rgba(34,211,238,0.12)]'
          : isSuggested
          ? 'border-[#c084fc]/28 bg-[rgba(168,85,247,0.08)] shadow-[0_0_14px_rgba(168,85,247,0.08)]'
          : 'border-white/6 bg-[rgba(255,255,255,0.02)] hover:border-[#22d3ee]/18 hover:bg-[rgba(34,211,238,0.05)] hover:shadow-[0_0_16px_rgba(34,211,238,0.08)]'} ${isMuted ? 'opacity-50 saturate-[0.75]' : ''}`}
        style={{ touchAction: 'none', userSelect: 'none' }}
      >
        <div
          className={`absolute inset-0 z-0 transition-opacity duration-200 pointer-events-none rounded-xl ${isHighlighted || isSuggested ? 'opacity-[0.16]' : 'opacity-0 group-hover:opacity-10'}`}
          style={{ backgroundColor: item.dot }}
        ></div>

        {(isHighlighted || isSuggested) && (
          <div
            className={`absolute left-0 top-2 bottom-2 w-1 rounded-full pointer-events-none ${isHighlighted ? 'bg-[#22d3ee]' : 'bg-[#a855f7]'}`}
          />
        )}

        <div className="flex items-center gap-3 overflow-hidden mr-2 relative z-10 pointer-events-none min-w-0">
          <span
            className={`relative z-20 grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-[#07101f] shadow-[0_10px_24px_rgba(2,6,23,0.34)] transition-transform duration-200 ease-out ${isHighlighted ? 'scale-[1.04] ring-1 ring-[#22d3ee]/32' : 'group-hover:scale-[1.03]'}`}
          >
            <img
              src={imageSrc}
              alt=""
              draggable={false}
              loading="lazy"
              className="h-full w-full object-cover contrast-[1.04] saturate-[1.08]"
            />
            <span
              className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-[#07101f] shadow-[0_0_10px_currentColor]"
              style={{ backgroundColor: item.dot, color: item.dot }}
            />
          </span>
          <span className={`text-[14px] font-medium truncate ${isHighlighted ? 'text-white' : 'text-[#e2e8f0]'}`}>
            {item.name}
          </span>
        </div>

        <div
          className="shrink-0 max-w-[42%] px-2.5 py-1 rounded-[9999px] text-[12px] font-mono leading-tight flex items-center justify-center relative z-10 pointer-events-none reagent-badge whitespace-nowrap overflow-hidden text-ellipsis border border-white/6"
          style={{
            backgroundColor: `color-mix(in srgb, ${item.dot} 15%, transparent)`,
            color: item.dot,
            fontFamily: "'JetBrains Mono', monospace"
          }}
        >
          {item.badgeFormula}
        </div>
      </div>
    );
  };

  return (
    <div data-panel="reagent-shelf" className={`flex flex-1 min-h-0 flex-col overflow-hidden glass-panel ${className}`}>
      {dragGhost && (
        <div
          ref={dragGhostRef}
          className="reagent-drag-ghost pointer-events-none fixed left-0 top-0 z-[9999] flex min-h-[58px] w-[232px] items-center justify-between rounded-2xl border border-[#22d3ee]/34 bg-[rgba(8,13,24,0.92)] px-3 py-2 shadow-[0_18px_44px_rgba(2,6,23,0.48),0_0_18px_rgba(34,211,238,0.12)] will-change-transform"
          style={{ transform: 'translate3d(-9999px, -9999px, 0) translate(-50%, -50%)' }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/12 text-[12px] font-bold text-white shadow-[0_10px_22px_rgba(2,6,23,0.28)]"
              style={{
                background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.72), ${dragGhost.dot} 42%, rgba(7,16,31,0.98) 100%)`,
              }}
            >
              {dragGhost.category === '未知样品' ? dragGhost.name.replace('未知样品 ', '') : '滴'}
            </span>
            <span className="truncate text-[14px] font-semibold text-white">{dragGhost.name}</span>
          </div>
          <span
            className="ml-3 shrink-0 rounded-full border border-white/8 px-2 py-1 font-mono text-[11px]"
            style={{ color: dragGhost.dot }}
          >
            {dragGhost.badgeFormula}
          </span>
        </div>
      )}
      <div className="shrink-0 flex gap-2 overflow-x-auto px-3 py-3 border-b border-white/6 bg-black/10">
        <button
          type="button"
          onClick={() => setActiveCategory('全部')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] border transition-colors ${effectiveActiveCategory === '全部' ? 'border-[#22d3ee]/40 bg-[#22d3ee]/12 text-[#22d3ee] shadow-[0_0_14px_rgba(34,211,238,0.12)]' : 'border-white/8 bg-white/4 text-[#94a3b8] hover:text-white'}`}
        >
          全部
        </button>
        {categoryGroups.map(group => (
          <button
            key={group.id}
            type="button"
            onClick={() => setActiveCategory(group.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] border transition-colors ${effectiveActiveCategory === group.id ? 'border-[#22d3ee]/40 bg-[#22d3ee]/12 text-[#22d3ee] shadow-[0_0_14px_rgba(34,211,238,0.12)]' : 'border-white/8 bg-white/4 text-[#94a3b8] hover:text-white'}`}
          >
            {group.label}
          </button>
        ))}
      </div>
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4 pr-2">
        {hasMissionHighlights && (
          <section className="rounded-2xl border border-[#22d3ee]/16 bg-[rgba(34,211,238,0.05)] px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-[#67e8f9]">本关试剂</span>
              <span className="text-[#64748b]">支线会污染</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {highlightedReagents.map(name => (
                <span key={name} className="px-2 py-0.5 rounded-full border border-[#22d3ee]/25 bg-[#22d3ee]/10 text-[10px] text-[#67e8f9]">
                  {name}
                </span>
              ))}
              {suggestedReagents.filter(name => !highlightedSet.has(name)).map(name => (
                <span key={name} className="px-2 py-0.5 rounded-full border border-[#a855f7]/25 bg-[#a855f7]/10 text-[10px] text-[#e9d5ff]">
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
          {quickAddEnabled ? '点按加入，也可拖入容器' : '拖入容器'}
        </div>
      </div>
    </div>
  );
}
