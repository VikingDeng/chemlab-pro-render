import React from 'react';

export interface TestTubeRackProps {
  id: string;
  slots: { tubeId: string | null }[];
  onSlotClick?: (slotIndex: number) => void;
  width?: number;
}

export const TestTubeRack: React.FC<TestTubeRackProps> = ({
  id,
  slots = [{ tubeId: null }, { tubeId: null }, { tubeId: null }, { tubeId: null }, { tubeId: null }, { tubeId: null }],
  onSlotClick,
  width = 180,
}) => {
  const height = width * 0.5;

  return (
    <div
      data-rack-id={id}
      style={{ width, height, position: 'relative' }}
      className="group pointer-events-none select-none"
    >
      {/* Base shadow */}
      <div className="absolute inset-x-3 bottom-0 h-[14%] rounded-[16px] bg-black/25 blur-sm" />

      {/* Main rack body */}
      <div
        className="absolute inset-x-0 bottom-[7%] top-[16%] rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,43,46,0.92),rgba(12,24,27,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_16px_28px_rgba(2,6,23,0.35)] overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.18),transparent_45%),linear-gradient(90deg,rgba(255,255,255,0.08),transparent_18%,transparent_82%,rgba(255,255,255,0.06))] opacity-70" />

        {/* Top rail */}
        <div className="absolute left-[6%] right-[6%] top-[10%] h-[18%] rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(70,177,161,0.88),rgba(23,113,106,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]" />

        {/* Middle deck */}
        <div className="absolute left-[5%] right-[5%] top-[32%] bottom-[20%] rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,rgba(31,122,114,0.80),rgba(18,73,72,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />

        {/* Bottom rail */}
        <div className="absolute left-[4%] right-[4%] bottom-[6%] h-[16%] rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(23,81,79,0.90),rgba(11,45,46,0.96))]" />

        {/* Side supports */}
        <div className="absolute left-[2%] top-[12%] bottom-[6%] w-[5%] rounded-[14px] bg-[linear-gradient(180deg,rgba(17,112,105,0.88),rgba(10,44,46,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />
        <div className="absolute right-[2%] top-[12%] bottom-[6%] w-[5%] rounded-[14px] bg-[linear-gradient(180deg,rgba(17,112,105,0.88),rgba(10,44,46,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />

        {/* Slot row */}
        <div className="absolute left-[8%] right-[8%] top-[32%] bottom-[18%] flex items-center justify-between px-1">
          {slots.map((slot, i) => (
            <div key={`slot-${i}`} className="relative flex h-full flex-1 items-center justify-center">
              {slot.tubeId && (
                <div className="absolute bottom-[10%] flex h-[72%] w-[18px] items-end justify-center">
                  <div className="h-full w-[12px] rounded-b-[999px] rounded-t-[999px] border border-white/40 bg-[linear-gradient(90deg,rgba(255,255,255,0.2),rgba(255,255,255,0.55),rgba(255,255,255,0.18))] shadow-[inset_0_1px_4px_rgba(255,255,255,0.15)]" />
                </div>
              )}
              <div
                className="relative z-10 flex h-[24px] w-[24px] items-center justify-center rounded-full border border-white/12 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.12),rgba(3,10,16,0.92)_72%)] shadow-[inset_0_1px_3px_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.04)] pointer-events-auto cursor-pointer transition-transform duration-150 hover:scale-105"
                onClick={(e) => {
                  e.stopPropagation();
                  onSlotClick?.(i);
                }}
              >
                <div className="h-[9px] w-[9px] rounded-full bg-white/8 shadow-[inset_0_1px_2px_rgba(255,255,255,0.12)]" />
                <div className="absolute inset-0 rounded-full ring-1 ring-white/5" />
              </div>
            </div>
          ))}
        </div>

        {/* Top gloss */}
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0)_18%,rgba(255,255,255,0)_78%,rgba(255,255,255,0.08)_100%)] opacity-70 pointer-events-none" />
      </div>
    </div>
  );
};
