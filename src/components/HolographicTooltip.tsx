import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Microscope } from 'lucide-react';
import type { ChemState } from '../chemEngine';

export const HolographicTooltip: React.FC<{
  x: number;
  y: number;
  chemState: ChemState;
  visible: boolean;
}> = ({ x, y, chemState, visible }) => {
  const composition = useMemo(() => {
    if (!visible) return [];
    const totalVolLiters = chemState.volume / 1000;
    const newComp: {formula: string, concentration: number}[] = [];
    
    // Sort moles from highest to lowest and calculate molarity
    Object.entries(chemState.moles).forEach(([formula, moles]) => {
      if (moles > 1e-4) { // Only show significant trace amounts
        const molarity = totalVolLiters > 0 ? moles / totalVolLiters : moles; // if 0 volume, just show raw moles (solid)
        newComp.push({ formula, concentration: molarity });
      }
    });

    return newComp.sort((a, b) => b.concentration - a.concentration).slice(0, 5);
  }, [chemState.moles, chemState.volume, visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 5 }}
          className="absolute z-[9999] pointer-events-none"
          style={{ left: x + 60, top: y - 40 }}
        >
          <div className="relative bg-[#0a0e1a]/80 backdrop-blur-xl border border-[#22d3ee]/40 p-3 rounded-lg shadow-[0_0_25px_rgba(34,211,238,0.25)] min-w-[140px] transform-gpu">
            {/* Holographic scanning line effect */}
            <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
               <motion.div 
                 animate={{ top: ['-10%', '110%'] }}
                 transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                 className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#22d3ee]/50 to-transparent"
               />
            </div>
            
            <div className="flex items-center gap-1.5 mb-2 border-b border-white/20 pb-1">
              <Microscope size={12} className="text-[#38bdf8]" />
              <span className="text-[10px] text-[#38bdf8] font-bold tracking-widest uppercase">
                微观组分扫描
              </span>
            </div>
            
            <div className="flex flex-col gap-1.5 mt-2">
              {composition.length === 0 ? (
                <div className="text-[11px] text-gray-500 italic">纯净溶剂</div>
              ) : (
                composition.map(c => (
                  <div key={c.formula} className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-white/90" dangerouslySetInnerHTML={{__html: c.formula.replace(/(\d+)/g, '<sub>$1</sub>')}}></span>
                    <span className="text-[#38bdf8]/90 font-bold">{c.concentration < 0.01 ? '<0.01' : c.concentration.toFixed(2)} <span className="text-[9px] text-[#38bdf8]/60">M</span></span>
                  </div>
                ))
              )}
            </div>
            
            {/* Phase info if applicable */}
            {chemState.organicVolume && chemState.organicVolume > 0 && (
              <div className="mt-2 pt-1 border-t border-white/10 flex justify-between text-[10px]">
                <span className="text-[#a855f7]">有机相体积</span>
                <span className="text-white/60">{chemState.organicVolume.toFixed(1)} mL</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
