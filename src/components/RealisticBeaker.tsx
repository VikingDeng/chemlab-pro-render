import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GlassProps } from './BeakerGlass';

function seededValue(seed: string | number, offset: number) {
  let hash = 0;
  const input = `${seed}-${offset}`;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (Math.sin(hash) + 1) / 2;
}

export const RealisticBeaker: React.FC<GlassProps> = ({ 
  volume, 
  color, 
  isReacting, 
  reactionType, 
  particles = [], 
  particleColor = '#fff', 
  width = 90,
    timeSinceReaction = 0,
    velocity = {x: 0, y: 0},
    temperature = 22.4,
    organicVolume = 0,
    organicColor = 'rgba(255,255,255,0.1)',
    organicDensity = 0.7,
}) => {
  // Inertia Calculation
  const sloshingAngle = Math.max(-15, Math.min(15, -velocity.x * 0.015));
  // Frost Calculation (starts at 12C, max at 0C)
  const frostOpacity = Math.max(0, Math.min(1, (12 - temperature) / 12));
  // Beaker dimensions matching a standard 250ml Griffin low-form beaker (Height approx 1.4x diameter)
    const height = width * 1.4; 
    const maxFillPercent = 82; 
    const totalVolume = volume + organicVolume;
    const fillPercent = (Math.min(totalVolume, 250) / 250) * maxFillPercent;
    const organicPercent = (organicVolume / Math.max(0.1, totalVolume)) * 100;
    const organicIsTop = organicDensity < 1;

  // Determine if it's coated in Silver (Tollens' reaction)
  let isSilverCoated = false;
  if (color === 'rgba(203, 213, 225, 1)') { // Matched from chemEngine Ag_mirror definition
     isSilverCoated = true;
  }

  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
  const r = rgbaMatch ? parseInt(rgbaMatch[1], 10) : 255;
  const g = rgbaMatch ? parseInt(rgbaMatch[2], 10) : 255;
  const b = rgbaMatch ? parseInt(rgbaMatch[3], 10) : 255;
  const a = rgbaMatch ? parseFloat(rgbaMatch[4]) : 0;
  
  const cleanColor = `rgba(${r}, ${g}, ${b}, ${a})`;
  // Darker shade for edge depth, keeping transparency
  const depthColor = `rgba(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)}, ${a + 0.1})`;
  const isPrecipitate = reactionType?.includes('precipitate');

  return (
    <div style={{ width, height, position: 'relative' }} className="group">
      {/* Outer Caustics on table - Real glass casts shadows and light on the table */}
      {totalVolume > 0 && (
        <div 
          className="absolute -bottom-4 -left-2 -right-2 h-8 rounded-[100%] blur-lg opacity-40 mix-blend-screen pointer-events-none"
          style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
        />
      )}
      <div className="absolute -bottom-2 -left-1 -right-1 h-4 bg-black/20 rounded-[100%] blur-sm pointer-events-none z-[-1]" />

      {/* Dynamic Ambient Glow / Bloom Effect for Reactions */}
      {isReacting && (
        <>
          <motion.div 
            animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.15, 0.95] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="absolute -inset-10 rounded-[40%] blur-[40px] z-[-1] pointer-events-none mix-blend-screen"
            style={{ backgroundColor: particleColor }}
          />
          {/* Intense Core Glow */}
          {reactionType === 'neutralize' && (
            <motion.div 
              animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.8, 1, 0.8] }}
              transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
              className="absolute inset-0 rounded-[20%] blur-[20px] z-[1] pointer-events-none mix-blend-screen"
              style={{ backgroundColor: '#ef4444' }}
            />
          )}
        </>
      )}

      {/* --- LAYER 1: BACK GLASS WALL --- */}
      <div 
        className="absolute inset-0 rounded-[12px_12px_18px_18px] pointer-events-none"
        style={{
          border: '1.5px solid rgba(255,255,255,0.15)',
          borderTop: 'none',
          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.4), inset 0 0 25px rgba(255,255,255,0.05)',
          background: 'linear-gradient(90deg, rgba(20,25,35,0.15) 0%, rgba(20,25,35,0.02) 50%, rgba(20,25,35,0.15) 100%)',
          backdropFilter: 'blur(4px) saturate(120%)',
          WebkitBackdropFilter: 'blur(4px) saturate(120%)',
        }}
      />

      {/* --- LAYER 2: THE LIQUID --- */}
      <div 
        className="absolute inset-0 overflow-hidden rounded-[2px_2px_16px_16px] z-[2]"
        style={{
          clipPath: 'inset(2px 2px 3px 2px round 0 0 14px 14px)',
          WebkitClipPath: 'inset(2px 2px 3px 2px round 0 0 14px 14px)'
        }}
      >
        <AnimatePresence>
          {totalVolume > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0, rotate: 0 }}
              animate={{ 
                height: `${fillPercent}%`, 
                opacity: 1, 
                rotate: sloshingAngle,
                scaleY: 1 + Math.abs(sloshingAngle) * 0.01 // Slight stretch to prevent edge gap
              }}
              transition={{ 
                height: { type: "spring", stiffness: 80, damping: 20 },
                rotate: { type: "spring", stiffness: 300, damping: 12 }, // Sloshing spring
                scaleY: { type: "spring", stiffness: 300, damping: 12 }
              }}
              className="absolute bottom-0 left-0 w-full origin-bottom transition-colors duration-500"
              style={{ 
                backgroundColor: cleanColor,
                // Highly realistic volumetric shadow for liquid inside cylinder
                boxShadow: isSilverCoated ? 
                  `inset 0 0 20px rgba(0,0,0,0.8), inset 10px 0 20px rgba(255,255,255,0.8), inset -10px 0 20px rgba(0,0,0,0.5)` : 
                `
                  inset 8px 0 15px rgba(0,0,0,0.15), 
                  inset -8px 0 15px rgba(0,0,0,0.15), 
                  inset 0 -15px 25px rgba(0,0,0,0.25),
                  inset 0 0 20px ${depthColor}
                `
              }}
            >
              {/* Organic Phase Separator (e.g. CCl4 layer at bottom) */}
              {organicVolume > 0 && (
                <div 
                  className="absolute left-0 w-full" 
                  style={{
                    top: organicIsTop ? 0 : 'auto',
                    bottom: organicIsTop ? 'auto' : 0,
                    height: `${organicPercent}%`,
                    backgroundColor: organicColor,
                    borderTop: organicIsTop ? 'none' : '2px solid rgba(255,255,255,0.4)',
                    borderBottom: organicIsTop ? '2px solid rgba(255,255,255,0.4)' : 'none',
                    boxShadow: `inset 0 5px 10px rgba(0,0,0,0.2)`
                  }}
                />
              )}

              {/* Liquid Surface Meniscus (Surface Tension / Meniscus Edge) */}
              <div 
                className="absolute top-[-6px] left-[-3px] right-[-3px] h-[12px] rounded-[100%]" 
                style={{
                  backgroundColor: `rgba(${r}, ${g}, ${b}, ${Math.min(1, a + 0.25)})`,
                  boxShadow: `
                    inset 0 -4px 6px rgba(0,0,0,0.4), 
                    inset 0 4px 6px rgba(255,255,255,0.8), 
                    0 4px 6px rgba(0,0,0,0.2)
                  `,
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  backdropFilter: 'brightness(1.2) contrast(1.1) blur(2px)',
                  WebkitBackdropFilter: 'brightness(1.2) contrast(1.1) blur(2px)'
                }}
              />
              
              {/* Inner Optical Refraction Line */}
              <div 
                className="absolute top-[-2px] left-[5%] right-[5%] h-[4px] rounded-[100%]" 
                style={{
                  backgroundColor: 'rgba(255,255,255,0.5)',
                  boxShadow: '0 0 5px rgba(255,255,255,0.8)',
                  filter: 'blur(1px)'
                }}
              />

              {/* Turbidity effect for precipitates */}
              {isPrecipitate && (
                 <div 
                   className="absolute inset-0 mix-blend-normal blur-[0.5px]"
                   style={{
                     opacity: Math.max(0.02, 0.95 - (Math.max(0, timeSinceReaction - 2500) / 12500) * 0.93),
                     backgroundColor: `color-mix(in srgb, ${particleColor} 40%, transparent)`,
                     backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'
                   }}
                 />
              )}

              {/* Settled precipitate layer (Microscopic Lattice / Crystals) */}
              {isPrecipitate && (
                 <motion.div 
                   animate={{ height: `${Math.min(15, (Math.max(0, timeSinceReaction - 2500) / 12500) * 15)}%` }} 
                   transition={{ duration: 0.5, ease: "easeOut" }} 
                   className="absolute bottom-0 w-full z-[5] overflow-hidden"
                   style={{
                     backgroundColor: particleColor,
                     opacity: 0.95,
                     borderTopLeftRadius: '100%',
                     borderTopRightRadius: '100%',
                     boxShadow: `inset 0 4px 6px rgba(0,0,0,0.2), 0 -2px 10px ${particleColor}`,
                     backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 100 100%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22crystal%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.3%22 numOctaves=%222%22/%3E%3CfeColorMatrix type=%22matrix%22 values=%221 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 7 -3%22/%3E%3C/filter%3E%3Crect width=%22100%22 height=%22100%22 filter=%22url(%23crystal)%22 opacity=%220.4%22 mix-blend-mode=%22overlay%22/%3E%3C/svg%3E")',
                     backgroundBlendMode: 'overlay'
                   }}
                 >
                    {/* Floating micro-crystals settling on the surface of the sediment */}
                    <div 
                      className="absolute top-0 left-0 w-full h-[5px]"
                      style={{
                        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 1px, transparent 1px)',
                        backgroundSize: '8px 4px',
                        backgroundPosition: '0 0, 4px 2px',
                        opacity: 0.8
                      }}
                    />
                 </motion.div>
              )}

              {/* Particles / Bubbles / Brownian Motion */}
              {isReacting && particles.map(p => {
                const isGas = reactionType?.includes('gas');
                const isBoil = reactionType?.includes('gas_boil');
                const wobbleX1 = (seededValue(p.id, 1) - 0.5) * 40;
                const wobbleX2 = wobbleX1 + (seededValue(p.id, 2) - 0.5) * 40;
                const endX = wobbleX2 + (seededValue(p.id, 3) - 0.5) * 40;
                const gasEndY = -250 - seededValue(p.id, 4) * 50;
                const settleY = 120 - seededValue(p.id, 5) * 20;
                const settleX = (seededValue(p.id, 6) - 0.5) * 30;

                return (
                  <motion.div 
                    key={p.id}
                    initial={{ y: isGas ? 0 : 0, x: 0, opacity: 0, scale: isBoil ? 0.2 : 0 }}
                    animate={{ 
                      y: isGas ? [-10, -100, gasEndY] : settleY, 
                      x: isGas ? [0, wobbleX1, wobbleX2, endX] : settleX,
                      opacity: isGas ? [0, 0.9, 0.9, 0] : [0, 1, 0.8], 
                      scale: isGas ? [0, 1.2, 1.8, 2.5] : [0, 1, 1],
                    }}
                    transition={{ 
                      repeat: isGas ? Infinity : 0, 
                      duration: p.duration * (isGas ? 1.5 : 1), 
                      delay: p.delay,
                      ease: isGas ? "easeIn" : "easeOut",
                      times: isGas ? [0, 0.3, 0.7, 1] : undefined
                    }}
                    className={`absolute rounded-full ${isGas ? '' : 'blur-[0.5px]'}`}
                    style={isGas ? {
                      left: isBoil ? '50%' : p.left, // Boil comes mostly from center bottom (heat source)
                      marginLeft: isBoil ? `calc(${p.left} - 50%)` : 0, // Spread slightly
                      bottom: '5px',
                      width: `${p.size * 1.5}px`, 
                      height: `${p.size * 1.5}px`,
                      background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.05) 20%, transparent 70%)',
                      boxShadow: `inset 0 0 ${p.size*0.2}px rgba(255,255,255,0.6), inset -1px -1px ${p.size*0.3}px rgba(0,0,0,0.2)`,
                      border: '0.5px solid rgba(255,255,255,0.4)',
                    } : {
                      backgroundColor: particleColor,
                      boxShadow: `inset -1px -1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)`,
                      opacity: 0.8,
                      left: p.left,
                      top: '20%',
                      width: `${p.size}px`, 
                      height: `${p.size}px`
                    }}
                  />
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- CONDENSATION / FROST LAYER --- */}
      {frostOpacity > 0 && (
        <div 
          className="absolute inset-0 rounded-[12px_12px_18px_18px] pointer-events-none mix-blend-screen z-[2]"
          style={{
            opacity: frostOpacity * 0.9,
            backdropFilter: `blur(${frostOpacity * 3}px)`,
            WebkitBackdropFilter: `blur(${frostOpacity * 3}px)`,
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.5%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22 opacity=%220.5%22/%3E%3C/svg%3E")',
            boxShadow: 'inset 0 0 20px rgba(255,255,255,0.5)'
          }}
        />
      )}

      {/* --- LAYER 3: FRONT GLASS REFLECTIONS & THICKNESS --- */}
      <div 
        className="absolute inset-0 rounded-[12px_12px_18px_18px] z-[3] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.7) 4%, rgba(255,255,255,0.0) 12%, rgba(255,255,255,0.0) 86%, rgba(255,255,255,0.4) 94%, rgba(255,255,255,0.0) 100%),
            linear-gradient(90deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.0) 8%, rgba(0,0,0,0.0) 92%, rgba(0,0,0,0.2) 100%)
          `,
          boxShadow: 'inset 0 1.5px 2px rgba(255,255,255,0.9), inset 0 -2px 5px rgba(255,255,255,0.3)'
        }}
      >
        {/* Top Rim Elipse - Thick rolled glass edge of a beaker */}
        <div className="absolute top-[-4px] left-[-2px] right-[-2px] h-[10px] rounded-[100%] border-[2.5px] border-white/60 shadow-[0_3px_5px_rgba(0,0,0,0.25),inset_0_1px_2px_rgba(255,255,255,0.8)]">
           <div className="absolute top-0 left-[15%] w-[25%] h-[2px] bg-white rounded-full blur-[0.5px]" />
           <div className="absolute bottom-[1px] right-[10%] w-[15%] h-[1px] bg-white/60 rounded-full blur-[0.5px]" />
        </div>

        {/* Beaker Spout (Beak) - Accurately shaped */}
        <div className="absolute top-[-7px] left-[2px] w-[14px] h-[10px] bg-white/50 rounded-[10px_0_0_0] skew-x-[-25deg] blur-[0.5px] shadow-[-2px_-1px_2px_rgba(255,255,255,0.8)]" />

        {/* Diagonal reflection streak across the cylinder */}
        <div className="absolute top-[10%] bottom-[10%] left-[25%] w-[8%] bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-15deg] blur-[2px]" />
        
        {/* Silver mirror specular reflection */}
        {isSilverCoated && (
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/20 to-transparent opacity-80 pointer-events-none mix-blend-overlay" />
        )}

        {/* Etched scale marks */}
        <div className="absolute inset-0 opacity-80 mix-blend-overlay">
          {[
            { v: 250, bottom: '82%' },
            { v: 200, bottom: '65.6%' },
            { v: 150, bottom: '49.2%' },
            { v: 100, bottom: '32.8%' },
            { v: 50,  bottom: '16.4%' }
          ].map((mark) => (
            <div key={mark.v} className="absolute flex items-center gap-1.5" style={{ left: '50%', transform: 'translateX(-50%)', bottom: `calc(${mark.bottom} + 2px)` }}>
              <div className="w-[10px] h-[1.5px] bg-white/90 shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
              <span className="text-[9px] text-white font-sans font-bold tracking-tighter drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] leading-none select-none">
                {mark.v}
              </span>
            </div>
          ))}
          {/* Main vertical line */}
          <div className="absolute top-[18%] bottom-[16.4%] w-[1.5px] bg-white/60 shadow-[0_1px_1px_rgba(0,0,0,0.3)]" style={{ left: 'calc(50% - 11px)' }} />
        </div>
      </div>
    </div>
  );
};
