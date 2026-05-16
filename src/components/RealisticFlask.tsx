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

export const RealisticFlask: React.FC<GlassProps> = ({ 
  volume, 
  color, 
  isReacting, 
  reactionType, 
  particles = [], 
  particleColor = '#fff', 
  width = 90,
  timeSinceReaction = 0,
  temperature = 22.4,
  organicVolume = 0,
  organicColor = 'rgba(255,255,255,0.1)',
  organicDensity = 0.7,
}) => {
  // Frost Calculation (starts at 12C, max at 0C)
  const frostOpacity = Math.max(0, Math.min(1, (12 - temperature) / 12));
  // Real Erlenmeyer flasks are wider at the base and taller
  const height = width * 1.5; 
  
  // Calculate settling of precipitates over 10 seconds
  const isPrecipitate = reactionType?.includes('precipitate') || false;
  const settleProgress = isPrecipitate ? Math.min(1, Math.max(0, timeSinceReaction - 2500) / 12500) : 0;
  
  // Calculate visual properties based on settling
  const turbidityOpacity = isPrecipitate ? Math.max(0.02, 0.95 - (settleProgress * 0.93)) : 0;
  const sedimentHeight = isPrecipitate ? (settleProgress * 15) : 0;
  
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
  const r = rgbaMatch ? parseInt(rgbaMatch[1], 10) : 255;
  const g = rgbaMatch ? parseInt(rgbaMatch[2], 10) : 255;
  const b = rgbaMatch ? parseInt(rgbaMatch[3], 10) : 255;
  const a = rgbaMatch ? parseFloat(rgbaMatch[4]) : 0;
  
  const cleanColor = `rgba(${r}, ${g}, ${b}, ${a})`;
  // Adjusted depth for flask cone
  const depthColor = `rgba(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)}, ${a + 0.15})`;

  const getFillHeightPercent = (targetVol: number) => {
    const clampedVol = Math.min(Math.max(targetVol, 0), 250);
    if (clampedVol === 0) return 0;
    
    // Physics matched geometry
    const rBottom = 40;
    const rNeck = 15;
    const hNeck = 65; 
    const hMax = 75; 
    
    const getVolAtH = (h: number) => {
      let v = 0;
      const hFrustum = Math.min(h, hNeck);
      const slope = (rBottom - rNeck) / hNeck; 
      
      const volAt0 = Math.pow(rBottom, 3) / (3 * slope);
      const volAtHFrustum = Math.pow(rBottom - slope * hFrustum, 3) / (3 * slope);
      v += (volAt0 - volAtHFrustum);
      
      if (h > hNeck) {
        const hCylinder = h - hNeck;
        v += Math.pow(rNeck, 2) * hCylinder;
      }
      return v;
    };
    
    const totalPhysicalVol = getVolAtH(hMax);
    const targetFraction = clampedVol / 250;
    
    let low = 0, high = hMax, h = 0;
    for (let i = 0; i < 20; i++) {
      h = (low + high) / 2;
      if (getVolAtH(h) / totalPhysicalVol < targetFraction) {
        low = h;
      } else {
        high = h;
      }
    }
    return h;
  };

  const totalVolume = volume + organicVolume;
  const fillPercent = getFillHeightPercent(totalVolume);
  const organicPercent = (organicVolume / Math.max(0.1, totalVolume)) * 100;
  const organicIsTop = organicDensity < 1;
  // Calculate relative width at surface for the meniscus scaling
  const fillWidthScale = totalVolume > 0 ? (1 - Math.min(1, fillPercent/65) * 0.6) : 1;

  // Determine if it's coated in Silver (Tollens' reaction)
  let isSilverCoated = false;
  if (color === 'rgba(203, 213, 225, 1)') { // Matched from chemEngine Ag_mirror definition
     isSilverCoated = true;
  }

  return (
    <div style={{ width, height, position: 'relative' }} className="group">
      {/* Outer Caustics */}
      {totalVolume > 0 && (
        <div 
          className="absolute -bottom-3 -left-4 -right-4 h-6 rounded-[100%] blur-lg opacity-50 mix-blend-screen pointer-events-none"
          style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
        />
      )}
      <div className="absolute -bottom-1 -left-2 -right-2 h-4 bg-black/25 rounded-[100%] blur-sm pointer-events-none z-[-1]" />

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
              className="absolute inset-0 rounded-[30%] blur-[20px] z-[1] pointer-events-none mix-blend-screen"
              style={{ backgroundColor: '#ef4444' }}
            />
          )}
        </>
      )}

      {/* --- LAYER 1: BACK GLASS WALL --- */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          // Erlenmeyer shape with smooth bottom curves
          clipPath: 'polygon(35% 0%, 65% 0%, 65% 30%, 98% 90%, 90% 100%, 10% 100%, 2% 90%, 35% 30%)',
          WebkitClipPath: 'polygon(35% 0%, 65% 0%, 65% 30%, 98% 90%, 90% 100%, 10% 100%, 2% 90%, 35% 30%)',
          background: 'linear-gradient(100deg, rgba(20,25,35,0.15) 0%, rgba(20,25,35,0.02) 50%, rgba(20,25,35,0.15) 100%)',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5), inset 0 0 25px rgba(255,255,255,0.1)',
          backdropFilter: 'blur(4px) saturate(120%)',
          WebkitBackdropFilter: 'blur(4px) saturate(120%)',
        }}
      />

      {/* --- LAYER 2: THE LIQUID --- */}
      <div 
        className="absolute inset-0 overflow-hidden z-[2]"
        style={{
          // Slightly inset clip path for the liquid
          clipPath: 'polygon(37% 5%, 63% 5%, 63% 32%, 96% 91%, 88% 98%, 12% 98%, 4% 91%, 37% 32%)',
          WebkitClipPath: 'polygon(37% 5%, 63% 5%, 63% 32%, 96% 91%, 88% 98%, 12% 98%, 4% 91%, 37% 32%)'
        }}
      >
        <AnimatePresence>
          {totalVolume > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: `${fillPercent}%`, opacity: 1 }}
              transition={{ type: "spring", stiffness: 80, damping: 20 }}
              className="absolute bottom-0 left-0 w-full origin-bottom"
              style={{ 
                backgroundColor: cleanColor,
                // Enhanced conical depth
                boxShadow: isSilverCoated ? 
                  `inset 0 0 20px rgba(0,0,0,0.8), inset 15px 0 25px rgba(255,255,255,0.8), inset -15px 0 25px rgba(0,0,0,0.5)` : 
                `
                  inset 15px 0 25px rgba(0,0,0,0.2), 
                  inset -15px 0 25px rgba(0,0,0,0.2), 
                  inset 0 -20px 30px rgba(0,0,0,0.3),
                  inset 0 0 30px ${depthColor}
                `
              }}
            >
              {organicVolume > 0 && (
                <div
                  className="absolute inset-x-0"
                  style={{
                    top: organicIsTop ? 0 : 'auto',
                    bottom: organicIsTop ? 'auto' : 0,
                    height: `${organicPercent}%`,
                    backgroundColor: organicColor,
                    borderTop: organicIsTop ? 'none' : '2px solid rgba(255,255,255,0.35)',
                    borderBottom: organicIsTop ? '2px solid rgba(255,255,255,0.35)' : 'none',
                    boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.15)'
                  }}
                />
              )}

              {/* Liquid Surface Meniscus (Surface Tension) */}
              <div 
                className="absolute top-[-4px] left-1/2 -translate-x-1/2 h-[10px] rounded-[100%]" 
                style={{
                  width: `${fillWidthScale * 100 + 4}%`,
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

              {/* Turbidity effect ONLY for precipitates */}
              {isPrecipitate && (
                 <div 
                   className="absolute inset-0 mix-blend-normal blur-[0.5px]"
                   style={{
                     backgroundColor: `color-mix(in srgb, ${particleColor} 40%, transparent)`,
                     backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%221.5%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")',
                     opacity: turbidityOpacity * 0.95
                   }}
                 />
              )}

              {/* Settled precipitate layer (Microscopic Lattice / Crystals) */}
              {isPrecipitate && sedimentHeight > 0 && (
                 <div 
                   className="absolute bottom-0 w-full z-[5] overflow-hidden"
                   style={{
                     height: `${sedimentHeight}%`,
                     backgroundColor: particleColor,
                     opacity: 0.95,
                     borderTopLeftRadius: '50%',
                     borderTopRightRadius: '50%',
                     boxShadow: `inset 0 4px 6px rgba(0,0,0,0.3), 0 -2px 10px ${particleColor}`,
                     clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)',
                     backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 100 100%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22crystal%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.3%22 numOctaves=%222%22/%3E%3CfeColorMatrix type=%22matrix%22 values=%221 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 7 -3%22/%3E%3C/filter%3E%3Crect width=%22100%22 height=%22100%22 filter=%22url(%23crystal)%22 opacity=%220.4%22 mix-blend-mode=%22overlay%22/%3E%3C/svg%3E")',
                     backgroundBlendMode: 'overlay'
                   }}
                 >
                    {/* Micro-crystals on the top edge */}
                    <div 
                      className="absolute top-0 left-0 w-full h-[6px]"
                      style={{
                        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 1.5px, transparent 1.5px)',
                        backgroundSize: '10px 5px',
                        backgroundPosition: '0 0, 5px 2.5px',
                        opacity: 0.8
                      }}
                    />
                 </div>
              )}

              {/* Particles / Bubbles / Brownian Motion */}
              {isReacting && particles.map(p => {
                const isGas = reactionType?.includes('gas') || reactionType === 'gas_boil';
                const isBoil = reactionType?.includes('gas_boil');
                const wobbleX1 = (seededValue(p.id, 1) - 0.5) * 30;
                const wobbleX2 = wobbleX1 + (seededValue(p.id, 2) - 0.5) * 30;
                const endX = wobbleX2 + (seededValue(p.id, 3) - 0.5) * 20;
                const gasEndY = -250 - seededValue(p.id, 4) * 50;
                const settleY = 120 - seededValue(p.id, 5) * 20;
                const settleX = (seededValue(p.id, 6) - 0.5) * 40;
                const flakeLeft = `${30 + seededValue(p.id, 7) * 40}%`;

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
                      left: isBoil ? '50%' : p.left,
                      marginLeft: isBoil ? `calc(${p.left} - 50%)` : 0,
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
                      left: flakeLeft,
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
          className="absolute inset-0 pointer-events-none mix-blend-screen z-[2]"
          style={{
            opacity: frostOpacity * 0.9,
            clipPath: 'polygon(35% 0%, 65% 0%, 65% 30%, 98% 90%, 90% 100%, 10% 100%, 2% 90%, 35% 30%)',
            backdropFilter: `blur(${frostOpacity * 3}px)`,
            WebkitBackdropFilter: `blur(${frostOpacity * 3}px)`,
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.5%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22 opacity=%220.5%22/%3E%3C/svg%3E")',
            boxShadow: 'inset 0 0 20px rgba(255,255,255,0.5)'
          }}
        />
      )}

      {/* --- LAYER 3: FRONT GLASS REFLECTIONS & SCALE --- */}
      <div 
        className="absolute inset-0 z-[3] pointer-events-none"
        style={{
          clipPath: 'polygon(35% 0%, 65% 0%, 65% 30%, 98% 90%, 90% 100%, 10% 100%, 2% 90%, 35% 30%)',
          WebkitClipPath: 'polygon(35% 0%, 65% 0%, 65% 30%, 98% 90%, 90% 100%, 10% 100%, 2% 90%, 35% 30%)',
          backgroundImage: `
            linear-gradient(100deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.7) 12%, rgba(255,255,255,0.0) 25%, rgba(255,255,255,0.0) 80%, rgba(255,255,255,0.4) 93%, rgba(255,255,255,0.0) 100%),
            linear-gradient(100deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.0) 15%, rgba(0,0,0,0.0) 85%, rgba(0,0,0,0.2) 100%)
          `,
          boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.9)'
        }}
      >
        {/* Top Rim Elipse - Thick reinforced glass ring */}
        <div className="absolute top-[-3px] left-[32%] right-[32%] h-[10px] rounded-[100%] border-[2.5px] border-white/60 shadow-[0_3px_5px_rgba(0,0,0,0.25),inset_0_1px_2px_rgba(255,255,255,0.8)]">
           <div className="absolute top-0 left-[20%] w-[30%] h-[2px] bg-white rounded-full blur-[0.5px]" />
           <div className="absolute bottom-[1px] right-[10%] w-[15%] h-[1px] bg-white/60 rounded-full blur-[0.5px]" />
        </div>

        {/* Diagonal reflection streak across the cone */}
        <div className="absolute top-[35%] bottom-[10%] left-[30%] w-[6%] bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-25deg] blur-[2px]" />

        <div className="absolute inset-0 opacity-80 mix-blend-overlay">
          {[
            { v: 250, bottom: getFillHeightPercent(250) }, 
            { v: 200, bottom: getFillHeightPercent(200) }, 
            { v: 150, bottom: getFillHeightPercent(150) }, 
            { v: 100, bottom: getFillHeightPercent(100) },
            { v: 50, bottom: getFillHeightPercent(50) }  
          ].map((mark) => (
            <div key={mark.v} className="absolute flex items-center gap-1.5" style={{ left: '50%', transform: 'translateX(-50%)', bottom: `calc(${mark.bottom}% + 2px)` }}>
              <div className="w-[10px] h-[1.5px] bg-white/90 shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
              <span className="text-[9px] text-white font-sans font-bold tracking-tighter drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] leading-none select-none">
                {mark.v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
