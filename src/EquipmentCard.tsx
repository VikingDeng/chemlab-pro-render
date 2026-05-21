import React from 'react';
import { GripVertical } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PanInfo } from 'framer-motion';

export interface EquipmentCardProps {
  dragType?: string;
  icon: React.ReactNode;
  name: string;
  subtitle: string;
  imageSrc?: string;
  imageAlt?: string;
  state?: 'default' | 'hover' | 'active' | 'dragging' | 'disabled';
  collapsed?: boolean;
  onDragEnd?: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
}

export function EquipmentCard({
  dragType,
  icon,
  name,
  subtitle,
  imageSrc,
  imageAlt,
  state = 'default',
  collapsed = false,
  onDragEnd,
}: EquipmentCardProps) {
  const [dragGhost, setDragGhost] = React.useState<{ x: number; y: number } | null>(null);
  const [failedImageSrc, setFailedImageSrc] = React.useState<string | null>(null);
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

  const shouldShowPhoto = Boolean(imageSrc) && failedImageSrc !== imageSrc;
  const tileSize = collapsed ? 'h-10 w-10' : 'h-[56px] w-[56px]';

  const photoTile = (
    <div
      className={`${tileSize} shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(7,12,20,0.9)] shadow-[0_12px_28px_rgba(2,6,23,0.34)]`}
    >
      {shouldShowPhoto ? (
        <img
          src={imageSrc}
          alt={imageAlt || name}
          draggable={false}
          loading="lazy"
          onError={() => setFailedImageSrc(imageSrc ?? name)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="relative flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_24%,rgba(214,197,157,0.22),rgba(8,13,24,0.92)_58%,rgba(5,9,15,1)_100%)] text-[#d6c59d]">
          <span className="scale-[1.05]">{icon}</span>
          <span className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />
        </div>
      )}
    </div>
  );

  const ghost = dragGhost ? (
    <div
      ref={dragGhostRef}
      className="pointer-events-none fixed left-0 top-0 z-[9999] flex min-h-[60px] w-[220px] items-center gap-3 rounded-[22px] border border-white/16 bg-[rgba(8,13,24,0.92)] px-3 py-3 text-white shadow-[0_20px_54px_rgba(2,6,23,0.56),0_0_22px_rgba(214,197,157,0.12)] backdrop-blur-xl will-change-transform"
      style={{ transform: `translate3d(${dragGhost.x}px, ${dragGhost.y}px, 0) translate(-50%, -50%)` }}
    >
      <div className="relative shrink-0">
        {shouldShowPhoto ? (
          <div className="h-11 w-11 overflow-hidden rounded-[18px] border border-white/12 bg-[#07101f] shadow-[0_10px_22px_rgba(2,6,23,0.28)]">
            <img
              src={imageSrc}
              alt={imageAlt || name}
              draggable={false}
              loading="eager"
              onError={() => setFailedImageSrc(imageSrc ?? name)}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="grid h-11 w-11 place-items-center rounded-[18px] border border-white/12 bg-[rgba(214,197,157,0.10)] text-[#f8e7bd] shadow-[0_10px_22px_rgba(2,6,23,0.28)]">
            {icon}
          </div>
        )}
      </div>
      <span className="min-w-0 flex-1">
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
          className="mb-2 flex h-10 w-10 items-center justify-center rounded-[14px] transition-all hover:bg-[rgba(214,197,157,0.1)] hover:text-[#d6c59d] text-[#64748b] cursor-grab z-50 relative"
          title={name}
          style={{ touchAction: 'none' }}
        >
          {photoTile}
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
          w-full xl:w-[228px] min-h-[68px] flex items-center gap-3 px-3 py-3.5
          border-b border-[rgba(255,255,255,0.04)] bg-transparent
          interactive-item group cursor-grab relative
          ${
            state === 'disabled'
              ? 'opacity-35 cursor-not-allowed'
              : state === 'dragging'
              ? 'opacity-60 scale-95 shadow-[0_0_20px_rgba(214,197,157,0.2)]'
              : 'active:scale-[0.98] active:bg-[rgba(214,197,157,0.08)]'
          }
        `}
        style={{ touchAction: 'none' }}
      >
        {photoTile}

        <div className="flex-1 min-w-0 flex flex-col justify-center pointer-events-none">
          <div className="text-[14px] font-medium text-[#e2e8f0] truncate leading-tight mb-0.5">
            {name}
          </div>
          <div className="text-[12px] text-[#475569] truncate leading-tight">
            {subtitle}
          </div>
        </div>

        {state === 'disabled' ? (
          <div className="shrink-0 text-[10px] uppercase font-bold text-[#d6c59d] bg-[rgba(214,197,157,0.1)] px-1.5 py-0.5 rounded ml-2 pointer-events-none">
            使用中
          </div>
        ) : (
          <div className="shrink-0 w-4 h-6 flex items-center justify-center text-[#475569] group-hover:text-[#94a3b8] transition-colors ml-1 pointer-events-none">
            <GripVertical size={16} />
          </div>
        )}
      </motion.div>
    </>
  );
}
