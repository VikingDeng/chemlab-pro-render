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
  const emitWorkspaceDragState = (active: boolean, point?: { x: number; y: number }) => {
    window.dispatchEvent(new CustomEvent('workspaceDragState', {
      detail: {
        active,
        kind: 'equipment',
        type: dragType,
        name,
        point,
      }
    }));
  };

  if (collapsed) {
    return (
      <motion.div 
        drag={state !== 'disabled'}
        dragSnapToOrigin
        dragElastic={0.2}
        onDragStart={(_event, info) => emitWorkspaceDragState(true, info.point)}
        onDrag={(_event, info) => emitWorkspaceDragState(true, info.point)}
        onDragEnd={(event, info) => {
          emitWorkspaceDragState(false);
          onDragEnd?.(event, info);
        }}
        whileDrag={{ scale: 0.95, zIndex: 100, opacity: 0.8, cursor: 'grabbing' }}
        className="w-10 h-10 flex items-center justify-center rounded-lg mb-2 transition-all hover:bg-[rgba(34,211,238,0.1)] hover:text-[#22d3ee] text-[#64748b] cursor-grab z-50 relative"
        title={name}
        style={{ touchAction: 'none' }}
      >
        {icon}
      </motion.div>
    );
  }

  return (
    <motion.div
      drag={state !== 'disabled'}
      dragSnapToOrigin
      dragElastic={0.2}
      onDragStart={(_event, info) => emitWorkspaceDragState(true, info.point)}
      onDrag={(_event, info) => emitWorkspaceDragState(true, info.point)}
      onDragEnd={(event, info) => {
        emitWorkspaceDragState(false);
        onDragEnd?.(event, info);
      }}
      whileDrag={{ scale: 0.95, zIndex: 100, opacity: 0.8, rotate: -2, cursor: 'grabbing' }}
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
  );
}
