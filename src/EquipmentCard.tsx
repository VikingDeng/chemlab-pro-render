import React from 'react';
import { GripVertical } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PanInfo } from 'framer-motion';

export interface EquipmentCardProps {
  dragType?: string;
  icon: React.ReactNode;
  name: string;
  subtitle: string;
  state?: 'default' | 'hover' | 'active' | 'dragging' | 'disabled';
  collapsed?: boolean;
  onDragEnd?: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
}

export function EquipmentCard({
  dragType,
  icon,
  name,
  subtitle,
  state = 'default',
  collapsed = false,
  onDragEnd,
}: EquipmentCardProps) {
  const [dragGhost, setDragGhost] = React.useState<{ x: number; y: number } | null>(null);
  const dragGhostRef = React.useRef<HTMLDivElement>(null);
  const dragGhostPointRef = React.useRef<{ x: number; y: number } | null>(null);
  const dragGhostFrameRef = React.useRef<number | null>(null);
  const pendingWorkspaceDragStateRef = React.useRef<{
    active: boolean;
    kind: 'equipment';
    type?: string;
    name: string;
    point?: { x: number; y: number };
  } | null>(null);
  const workspaceDragStateFrameRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (dragGhostFrameRef.current !== null) {
        cancelAnimationFrame(dragGhostFrameRef.current);
      }
      if (workspaceDragStateFrameRef.current !== null) {
        cancelAnimationFrame(workspaceDragStateFrameRef.current);
      }
    };
  }, []);

  const dispatchWorkspaceDragState = (detail: NonNullable<typeof pendingWorkspaceDragStateRef.current>) => {
    window.dispatchEvent(new CustomEvent('workspaceDragState', { detail }));
  };

  const emitWorkspaceDragState = (active: boolean, point?: { x: number; y: number }) => {
    const detail = {
      active,
      kind: 'equipment' as const,
      type: dragType,
      name,
      point,
    };

    if (!active) {
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
  };

  const positionDragGhost = (point: { x: number; y: number }) => {
    dragGhostPointRef.current = point;
    if (dragGhostFrameRef.current !== null) return;

    dragGhostFrameRef.current = requestAnimationFrame(() => {
      dragGhostFrameRef.current = null;
      const nextPoint = dragGhostPointRef.current;
      const ghostElement = dragGhostRef.current;
      if (!nextPoint || !ghostElement) return;
      ghostElement.style.transform = `translate3d(${nextPoint.x}px, ${nextPoint.y}px, 0) translate(-50%, -50%)`;
    });
  };

  const beginDragGhost = (point: { x: number; y: number }) => {
    setDragGhost(point);
    positionDragGhost(point);
  };

  const clearDragGhost = () => {
    if (dragGhostFrameRef.current !== null) {
      cancelAnimationFrame(dragGhostFrameRef.current);
      dragGhostFrameRef.current = null;
    }
    dragGhostPointRef.current = null;
    setDragGhost(null);
  };

  const ghost = dragGhost ? (
    <div
      ref={dragGhostRef}
      className="pointer-events-none fixed left-0 top-0 z-[9999] flex min-h-[52px] w-[190px] items-center gap-3 rounded-2xl border border-white/16 bg-[rgba(8,13,24,0.92)] px-4 py-3 text-white shadow-[0_20px_54px_rgba(2,6,23,0.56),0_0_22px_rgba(34,211,238,0.12)] backdrop-blur-xl will-change-transform"
      style={{ transform: `translate3d(${dragGhost.x}px, ${dragGhost.y}px, 0) translate(-50%, -50%)` }}
    >
      <span className="text-[#67e8f9]">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold">{name}</span>
        <span className="block truncate text-[11px] text-[#94a3b8]">{subtitle}</span>
      </span>
    </div>
  ) : null;

  if (collapsed) {
    return (
      <>
        {ghost}
        <motion.div
          drag={state !== 'disabled'}
          dragSnapToOrigin
          dragElastic={0.08}
          dragMomentum={false}
          onDragStart={(_event, info) => {
            emitWorkspaceDragState(true, info.point);
            beginDragGhost(info.point);
          }}
          onDrag={(_event, info) => {
            emitWorkspaceDragState(true, info.point);
            positionDragGhost(info.point);
          }}
          onDragEnd={(event, info) => {
            emitWorkspaceDragState(false);
            clearDragGhost();
            onDragEnd?.(event, info);
          }}
          whileDrag={{ scale: 0.98, zIndex: 100, opacity: 0.3, cursor: 'grabbing' }}
          className="w-10 h-10 flex items-center justify-center rounded-lg mb-2 transition-all hover:bg-[rgba(34,211,238,0.1)] hover:text-[#22d3ee] text-[#64748b] cursor-grab z-50 relative"
          title={name}
          style={{ touchAction: 'none' }}
        >
          {icon}
        </motion.div>
      </>
    );
  }

  return (
    <>
      {ghost}
      <motion.div
        drag={state !== 'disabled'}
        dragSnapToOrigin
        dragElastic={0.08}
        dragMomentum={false}
        onDragStart={(_event, info) => {
          emitWorkspaceDragState(true, info.point);
          beginDragGhost(info.point);
        }}
        onDrag={(_event, info) => {
          emitWorkspaceDragState(true, info.point);
          positionDragGhost(info.point);
        }}
        onDragEnd={(event, info) => {
          emitWorkspaceDragState(false);
          clearDragGhost();
          onDragEnd?.(event, info);
        }}
        whileDrag={{ scale: 0.98, zIndex: 100, opacity: 0.3, cursor: 'grabbing' }}
        className={`
          w-full xl:w-[228px] min-h-[56px] flex items-center px-3 py-3
          border-b border-[rgba(255,255,255,0.04)] bg-transparent
          interactive-item group cursor-grab relative
          ${
            state === 'disabled'
              ? 'opacity-35 cursor-not-allowed'
              : state === 'dragging'
              ? 'opacity-60 scale-95 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
              : 'active:scale-[0.98] active:bg-[rgba(34,211,238,0.08)]'
          }
        `}
        style={{ touchAction: 'none' }}
      >
        <div
          className={`w-[32px] h-[32px] flex items-center justify-center shrink-0 transition-colors duration-150 ease-out mr-[12px]
            ${
              state === 'disabled'
                ? 'text-[#64748b]'
                : 'text-[#64748b] group-hover:text-[#22d3ee]'
            }
          `}
        >
          {icon}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center pointer-events-none">
          <div className="text-[14px] font-medium text-[#e2e8f0] truncate leading-tight mb-0.5">
            {name}
          </div>
          <div className="text-[12px] text-[#475569] truncate leading-tight">
            {subtitle}
          </div>
        </div>

        {state === 'disabled' ? (
          <div className="shrink-0 text-[10px] uppercase font-bold text-[#22d3ee] bg-[rgba(34,211,238,0.1)] px-1.5 py-0.5 rounded ml-2 pointer-events-none">
            使用中
          </div>
        ) : (
          <div className="shrink-0 w-4 h-6 flex items-center justify-center text-[#475569] group-hover:text-[#94a3b8] transition-colors ml-2 pointer-events-none">
            <GripVertical size={16} />
          </div>
        )}
      </motion.div>
    </>
  );
}
