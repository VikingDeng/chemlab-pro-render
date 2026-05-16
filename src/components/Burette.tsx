import React from 'react';
import { motion } from 'framer-motion';

export interface BuretteProps {
  volume: number;     // 0 to 50 mL typical
  maxVolume?: number; // 50 mL default
  contentColor?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  width?: number;
}

export const Burette: React.FC<BuretteProps> = ({ 
  volume, 
  contentColor = 'rgba(255,255,255,0.1)', 
  isOpen = false, 
  onToggle,
  width = 30
}) => {
  const height = width * 10; // Tall and thin
  // const maxFill = 50;
  const maxVolume = 50;
  const fillPercent = (Math.min(volume, maxVolume) / maxVolume) * 90; // Don't fill past the 90% mark
  
  return (
    <div style={{ width, height, position: 'relative' }} className="group">
      {/* Outer Tube */}
      <div 
        className="absolute top-0 bottom-[15%] left-[20%] right-[20%] rounded-[4px]"
        style={{
          border: '1.5px solid rgba(255,255,255,0.2)',
          borderTop: 'none',
          borderBottom: 'none',
          boxShadow: 'inset 0 0 10px rgba(255,255,255,0.1)',
          background: 'linear-gradient(90deg, rgba(20,25,35,0.15) 0%, rgba(20,25,35,0.02) 50%, rgba(20,25,35,0.15) 100%)',
          backdropFilter: 'blur(1px)'
        }}
      />
      
      {/* Liquid inside the tube */}
      <div 
        className="absolute top-[5%] bottom-[15%] left-[22%] right-[22%] overflow-hidden rounded-[2px] z-[2]"
      >
        <motion.div 
          animate={{ height: `${fillPercent}%` }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-0 left-0 w-full origin-bottom"
          style={{ 
            backgroundColor: contentColor,
            boxShadow: `inset 3px 0 5px rgba(0,0,0,0.1), inset -3px 0 5px rgba(0,0,0,0.1)`
          }}
        >
          {/* Meniscus */}
          <div 
            className="absolute top-[-2px] left-0 right-0 h-[4px] rounded-[100%]" 
            style={{
              backgroundColor: contentColor,
              border: '1px solid rgba(255,255,255,0.3)'
            }}
          />
        </motion.div>
      </div>

      {/* Glass Reflections */}
      <div 
        className="absolute top-0 bottom-[15%] left-[20%] right-[20%] z-[3] pointer-events-none rounded-[4px]"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.5) 15%, rgba(255,255,255,0.0) 30%)`
        }}
      />

      {/* Scale Marks */}
      <div className="absolute top-[5%] bottom-[15%] left-[20%] right-[20%] z-[4] pointer-events-none">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="absolute w-[4px] h-[1px] bg-white/70" style={{ left: 0, top: `${i * 10}%` }}>
            {(i % 2 === 0) && (
              <span className="absolute left-[6px] top-[-5px] text-[7px] text-white/80 font-mono scale-75 origin-left">
                {i * 5}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Stopcock (Valve) */}
      <div 
        data-interactive="true"
        className="absolute bottom-[8%] left-[10%] right-[10%] h-[12px] bg-gray-800 rounded z-[5] cursor-pointer shadow-lg border border-gray-600 flex items-center justify-center transition-colors hover:bg-gray-700"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); if(onToggle) onToggle(); }}
      >
        {/* Handle */}
        <motion.div 
          animate={{ rotate: isOpen ? 0 : 90 }}
          className="w-[80%] h-[4px] bg-[#22d3ee] rounded shadow-[0_0_5px_rgba(34,211,238,0.5)]"
        />
      </div>

      {/* Tip / Spout */}
      <div 
        className="absolute bottom-0 left-[35%] right-[35%] h-[8%] rounded-[0_0_2px_2px]"
        style={{
          border: '1px solid rgba(255,255,255,0.2)',
          borderTop: 'none',
          background: 'rgba(255,255,255,0.05)'
        }}
      />

      {/* Droplet Animation (when open and has liquid) */}
      {isOpen && volume > 0 && (
        <motion.div 
          animate={{ y: [0, 40], opacity: [1, 1, 0], scale: [1, 0.8, 0] }}
          transition={{ repeat: Infinity, duration: 0.5, ease: "easeIn" }}
          className="absolute bottom-[-10px] left-[45%] right-[45%] h-[8px] rounded-full blur-[0.5px] z-[10]"
          style={{ backgroundColor: contentColor }}
        />
      )}
    </div>
  );
};
