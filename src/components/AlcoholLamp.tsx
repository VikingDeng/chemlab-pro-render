import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LampProps {
  isOn: boolean;
  onToggle: () => void;
  width?: number;
}

export const AlcoholLamp: React.FC<LampProps> = ({ isOn, onToggle, width = 64 }) => {
  const height = width * 1.5;
  
  return (
    <div style={{ width, height, position: 'relative' }} className="flex flex-col items-center group pointer-events-auto">
      {/* Interactive toggle area over the lamp */}
      <div 
        className="absolute inset-0 z-[100] cursor-pointer" 
        onClick={(e) => {
          e.stopPropagation(); // Stop drag events from firing
          onToggle();
        }}
        onPointerDown={(e) => {
          // This is vital to prevent Framer Motion's drag from capturing the pointerdown
          e.stopPropagation();
        }}
        title={isOn ? "点击熄灭" : "点击点燃"}
      />
      
      {/* Flame */}
      <div className="h-[40%] relative w-full flex justify-center items-end pb-1">
        <AnimatePresence>
          {isOn && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute bottom-1 w-6 h-12 origin-bottom flex justify-center z-10"
            >
              {/* Outer flame */}
              <motion.div 
                animate={{ 
                  scaleY: [1, 1.1, 0.9, 1.05, 1],
                  scaleX: [1, 0.95, 1.05, 0.9, 1],
                  rotate: [-47, -43, -46, -44, -45] // Base rotation is -45 to make the teardrop stand up straight
                }}
                transition={{ repeat: Infinity, duration: 0.3, ease: "easeInOut" }}
                className="absolute bottom-0 w-full h-full rounded-[100%_0_100%_0] origin-bottom bg-gradient-to-t from-blue-500/80 via-yellow-400/90 to-transparent blur-[2px]"
                style={{ 
                  boxShadow: '0 0 20px 5px rgba(234,179,8,0.5)',
                  transform: 'rotate(-45deg)' 
                }}
              />
              {/* Inner core */}
              <motion.div 
                animate={{ scale: [1, 0.9, 1], rotate: [-45, -45, -45] }}
                transition={{ repeat: Infinity, duration: 0.2, ease: "easeInOut" }}
                className="absolute bottom-1 w-3 h-6 rounded-[100%_0_100%_0] origin-bottom bg-blue-300/90 blur-[1px]"
                style={{ transform: 'rotate(-45deg)' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Wick */}
      <div className="w-1.5 h-3 bg-neutral-800 rounded-t-sm z-10" />

      {/* Wick holder/Cap base */}
      <div className="w-6 h-2 bg-gradient-to-r from-neutral-300 via-neutral-100 to-neutral-400 rounded-t-sm border-b border-neutral-400 z-10" />
      <div className="w-8 h-2 bg-gradient-to-r from-neutral-400 via-neutral-200 to-neutral-500 rounded-sm shadow-md z-10" />

      {/* Glass Body */}
      <div className="flex-1 w-[90%] relative rounded-[20px_20px_10px_10px] border border-white/20 overflow-hidden"
           style={{
             background: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.15) 100%)',
             boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5), inset 0 -5px 15px rgba(255,255,255,0.2), 0 5px 10px rgba(0,0,0,0.3)',
             backdropFilter: 'blur(2px)'
           }}>
        
        {/* Alcohol Liquid */}
        <div className="absolute bottom-0 w-full h-[60%] border-t border-white/30"
             style={{
               background: 'linear-gradient(180deg, rgba(236,72,153,0.3) 0%, rgba(236,72,153,0.6) 100%)',
               boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.2)'
             }}>
          {/* Inner wick */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-full bg-neutral-700/50" />
        </div>
        
        {/* Glass reflection */}
        <div className="absolute inset-0 rounded-[20px_20px_10px_10px] pointer-events-none"
             style={{
               background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 15%, rgba(255,255,255,0) 30%)'
             }} />
      </div>

      {/* Cap (visible when off) */}
      <AnimatePresence>
        {!isOn && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0, transition: { duration: 0.2 } }}
            className="absolute top-[40%] w-7 h-8 bg-gradient-to-r from-neutral-200 via-white to-neutral-300 rounded-[5px_5px_0_0] z-30 shadow-[0_5px_10px_rgba(0,0,0,0.5)] border border-neutral-400"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
            <div className="absolute top-1 left-1 w-1 h-full bg-white/50 rounded-full" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
