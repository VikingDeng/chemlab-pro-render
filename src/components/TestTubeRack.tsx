import React from 'react';


export interface TestTubeRackProps {
  id: string;
  slots: { tubeId: string | null }[]; // Array of 6
  onSlotClick?: (slotIndex: number) => void;
  width?: number;
}

export const TestTubeRack: React.FC<TestTubeRackProps> = ({ 
  slots = [ { tubeId: null }, { tubeId: null }, { tubeId: null }, { tubeId: null }, { tubeId: null }, { tubeId: null } ],
  onSlotClick,
  width = 180
}) => {
  const height = width * 0.45;
  // const slotWidth = width / 7;

  return (
    <div style={{ width, height, position: 'relative' }} className="group pointer-events-none">
      {/* Back Wooden Bar */}
      <div className="absolute top-[20%] inset-x-0 h-[15%] bg-[#8b5a2b] border-t border-[#a06d3e] border-b border-[#63411e] rounded-sm shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)]" />
      
      {/* Front Wooden Bar with Holes */}
      <div className="absolute top-[45%] inset-x-0 h-[25%] bg-[#a06d3e] border-t border-[#bd8754] border-b border-[#63411e] rounded-sm shadow-[0_5px_10px_rgba(0,0,0,0.3)] z-10 flex justify-evenly items-center px-2">
        {slots.map((_, i) => (
          <div 
            key={`hole-${i}`}
            className="w-[20px] h-[12px] bg-[#3a2512] rounded-[100%] shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] border-b border-[#bd8754]/50 pointer-events-auto cursor-pointer hover:bg-[#4a3522] transition-colors relative flex items-center justify-center group/hole"
            onClick={(e) => {
              e.stopPropagation();
              if (onSlotClick) onSlotClick(i);
            }}
          >
            {/* Visual cue that it's empty / clickable */}
            <div className="opacity-0 group-hover/hole:opacity-100 transition-opacity w-2 h-2 rounded-full bg-white/20 blur-[1px]" />
            
            {/* Display index label just below hole */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[#3a2512] font-bold text-[8px] opacity-60">
              {i + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Base */}
      <div className="absolute bottom-0 inset-x-0 h-[15%] bg-[#63411e] border-t border-[#8b5a2b] rounded-md shadow-[0_10px_20px_rgba(0,0,0,0.5)] z-20 flex justify-evenly items-center px-2">
         {slots.map((_, i) => (
          <div 
            key={`base-${i}`}
            className="w-[16px] h-[8px] bg-[#4a3522] rounded-[100%] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]"
          />
        ))}
      </div>

      {/* Left/Right Legs */}
      <div className="absolute top-[10%] bottom-[5%] left-[2%] w-[6%] bg-[#8b5a2b] rounded-t-sm shadow-[2px_0_5px_rgba(0,0,0,0.2)] z-[5]" />
      <div className="absolute top-[10%] bottom-[5%] right-[2%] w-[6%] bg-[#8b5a2b] rounded-t-sm shadow-[-2px_0_5px_rgba(0,0,0,0.2)] z-[5]" />
    </div>
  );
};
