import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function seededValue(seed: string | number, offset: number) {
  let hash = 0;
  const input = `${seed}-${offset}`;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (Math.sin(hash) + 1) / 2;
}

export interface ReactionParticle {
  id: string | number;
  left: string;
  duration: number;
  delay: number;
  size: number;
}

export interface GlassProps {
  temperature?: number;
  boilingPoint?: number;
  organicVolume?: number;
  organicColor?: string;
  organicDensity?: number;
  velocity?: { x: number, y: number };
  volume: number;
  color: string;
  isReacting?: boolean;
  reactionType?: string;
  particles?: ReactionParticle[];
  particleColor?: string;
  width?: number;
  timeSinceReaction?: number; // Time since last reaction for physics settling
}

export const BeakerGlass: React.FC<GlassProps> = ({ 
  volume, 
  color, 
  isReacting, 
  reactionType, 
  particles = [], 
  particleColor = '#fff', 
  width = 90,
  timeSinceReaction = 0
}) => {
  const height = width * 1.3; 
  const maxFillPercent = 83; // 250ml maps to ~83% of the visual inner height
  const fillPercent = (Math.min(volume, 250) / 250) * maxFillPercent;

  // Calculate settling of precipitates over 10 seconds
  const isPrecipitate = reactionType?.includes('precipitate') || false;
  const settleProgress = isPrecipitate ? Math.min(1, timeSinceReaction / 10000) : 0;
  
  // Calculate visual properties based on settling
  const turbidityOpacity = isPrecipitate ? 0.85 * (1 - settleProgress * 0.8) : 0; // turbidity fades as it settles
  const sedimentHeight = isPrecipitate ? 2 + (settleProgress * 15) : 0; // sediment builds up at bottom

  return (
    <div style={{ width, height, position: 'relative' }} className="group">
      {/* Outer glow during reaction */}
      {isReacting && (
        <motion.div 
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="absolute inset-0 rounded-[20%] blur-[30px] z-[-1]"
          style={{ backgroundColor: particleColor }}
        />
      )}

      {/* SVG defs for liquid clipping mask */}
      <svg viewBox="0 0 100 130" className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <clipPath id="beaker-liquid-clip" clipPathUnits="userSpaceOnUse">
            <path d="M 16 15 L 84 15 L 84 110 Q 84 120 74 120 L 26 120 Q 16 120 16 110 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* Back wall of the glass, rim, and scale marks */}
      <svg viewBox="0 0 100 130" className="absolute inset-0 w-full h-full pointer-events-none z-[1]">
        {/* Main Body Background - adding glass thickness and shadow */}
        <path 
          d="M 10 10 L 15 15 L 15 110 Q 15 125 25 125 L 75 125 Q 85 125 85 110 L 85 15 L 90 10 Z" 
          fill="rgba(10,15,30,0.15)" 
          stroke="url(#glass-edge-gradient)" 
          strokeWidth="2"
          style={{ backdropFilter: 'blur(4px) saturate(120%)' }}
        />
        
        <defs>
          <linearGradient id="glass-edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="10%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="90%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
          </linearGradient>
        </defs>

        {/* Scale Marks (Right-aligned inside the left edge) */}
        <g stroke="rgba(255,255,255,0.4)" strokeWidth="1" opacity="0.9">
          {/* Main vertical line */}
          <line x1="22" y1="30" x2="22" y2="105" stroke="rgba(255,255,255,0.2)" />
          
          <line x1="22" y1="30" x2="28" y2="30" />
          <text x="32" y="32" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="monospace">250</text>
          
          <line x1="22" y1="48" x2="28" y2="48" />
          <text x="32" y="50" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="monospace">200</text>
          
          <line x1="22" y1="66" x2="28" y2="66" />
          <text x="32" y="68" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="monospace">150</text>
          
          <line x1="22" y1="84" x2="28" y2="84" />
          <text x="32" y="86" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="monospace">100</text>
          
          <line x1="22" y1="102" x2="28" y2="102" />
          <text x="32" y="104" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="monospace">50</text>
        </g>
      </svg>

      {/* Liquid Fill Layer */}
      <div className="absolute inset-0 w-full h-full z-[2] overflow-hidden pointer-events-none">
        <svg viewBox="0 0 100 130" className="absolute inset-0 w-full h-full">
          <g clipPath="url(#beaker-liquid-clip)">
            <foreignObject x="0" y="0" width="100" height="130">
              <div className="w-full h-full relative">
                <AnimatePresence>
                  {volume > 0 && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: `${fillPercent}%`, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 100, damping: 20 }}
                      className="absolute bottom-0 left-0 w-full origin-bottom"
                      style={{ 
                        backgroundColor: color,
                        // Deep absorption shadows and edge refraction for liquid
                        boxShadow: `
                          inset 10px 0 15px rgba(0,0,0,0.5), 
                          inset -10px 0 15px rgba(0,0,0,0.5), 
                          inset 0 -20px 30px rgba(0,0,0,0.7),
                          inset 0 0 20px ${color}
                        `
                      }}
                    >
                      {/* Subsurface scattering & Light volume */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent mix-blend-overlay" />
                      
                      {/* Core darkening shadow for volume depth */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      
                      {/* Realistic liquid meniscus (liquid curve at top) */}
                      <div 
                        className="absolute top-[0px] left-0 w-full h-[8px] rounded-[100%]" 
                        style={{
                          backgroundColor: `color-mix(in srgb, ${color} 20%, white)`,
                          boxShadow: `
                            inset 0 -3px 4px rgba(0,0,0,0.6), 
                            inset 0 2px 2px rgba(255,255,255,0.9), 
                            0 4px 10px rgba(0,0,0,0.4)
                          `
                        }}
                      />

                      {/* Caustics / Liquid light reflection */}
                      <div 
                        className="w-[100%] h-[100%] absolute top-0 left-0 mix-blend-overlay pointer-events-none opacity-50"
                        style={{
                          backgroundImage: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.6) 0%, transparent 50%)'
                        }}
                      />
                      
                      {/* Specular curved highlight specifically for the liquid body */}
                      <div 
                        className="absolute top-0 left-[15%] w-[10%] h-full opacity-60 mix-blend-overlay"
                        style={{
                           background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)'
                        }}
                      />

                      {/* Turbidity / Cloudiness overlay for precipitates */}
                      {isPrecipitate && (
                         <div 
                           className="absolute inset-0 mix-blend-normal blur-[1px]"
                           style={{
                             backgroundColor: `color-mix(in srgb, ${particleColor} 40%, transparent)`,
                             backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")',
                             opacity: turbidityOpacity
                           }}
                         />
                      )}
                      
                      {/* Settled Sediment layer at the very bottom */}
                      {isPrecipitate && sedimentHeight > 0 && (
                        <div 
                          className="absolute bottom-0 left-0 w-full"
                          style={{
                            height: `${sedimentHeight}%`,
                            backgroundColor: particleColor,
                            opacity: 0.9,
                            boxShadow: `inset 0 2px 4px rgba(0,0,0,0.3), 0 -2px 10px ${particleColor}`,
                            borderTop: `1px solid rgba(255,255,255,0.2)`
                          }}
                        />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </foreignObject>
          </g>
        </svg>
      </div>

      {/* Reaction Particles Layer */}
      <div className="absolute inset-0 w-full h-full z-[3]" style={{ clipPath: 'url(#beaker-liquid-clip)', pointerEvents: 'none' }}>
        {isReacting && particles.map(p => {
          const isGas = reactionType?.includes('gas') || reactionType === 'gas_boil';
          const particleSeed = `${p.id}-${p.left}-${p.size}-${reactionType ?? 'none'}`;
          const targetY = isGas
            ? -20 - seededValue(particleSeed, 1) * 20
            : 100 - seededValue(particleSeed, 2) * 20;
          const targetX = (seededValue(particleSeed, 3) - 0.5) * 20;
          return (
          <motion.div 
            key={p.id}
            initial={{ 
              y: isGas ? 100 : 0, 
              opacity: 0, 
              scale: 0 
            }}
            animate={{ 
              y: targetY,
              opacity: [0, 1, 0.8], 
              scale: [0, 1, 1],
              x: targetX
            }}
            transition={{ 
              repeat: isGas ? Infinity : 0, 
              duration: p.duration, 
              delay: p.delay,
              ease: isGas ? "easeIn" : "easeOut"
            }}
            className="absolute rounded-full blur-[0.5px]"
            style={isGas ? {
              backgroundColor: 'rgba(255,255,255,0.8)',
              boxShadow: `inset 0 0 2px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.4)`,
              border: '0.5px solid rgba(255,255,255,0.5)',
              left: p.left,
              bottom: '10px',
              width: `${p.size * 1.5}px`, 
              height: `${p.size * 1.5}px`
            } : { 
              backgroundColor: particleColor,
              boxShadow: `0 0 6px ${particleColor}`,
              left: p.left,
              top: '50%',
              width: `${p.size}px`, 
              height: `${p.size}px`
            }}
          />
        )})}
      </div>

      {/* Front Glass Reflections Layer */}
      <svg viewBox="0 0 100 130" className="absolute inset-0 w-full h-full pointer-events-none z-[4]">
        {/* Left thick highlight */}
        <path 
          d="M 18 20 L 18 105 Q 18 117 25 120" 
          fill="none" 
          stroke="url(#left-highlight)" 
          strokeWidth="3.5" 
          strokeLinecap="round"
          opacity="0.85"
        />
        {/* Right thin highlight */}
        <path 
          d="M 82 25 L 82 95 Q 82 105 78 112" 
          fill="none" 
          stroke="url(#right-highlight)" 
          strokeWidth="1.5" 
          strokeLinecap="round"
          opacity="0.6"
        />
        <defs>
          <linearGradient id="left-highlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.4)" />
          </linearGradient>
          <linearGradient id="right-highlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
          </linearGradient>
        </defs>

        {/* Rim Highlights */}
        <ellipse cx="50" cy="10" rx="40" ry="4.5" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <ellipse cx="50" cy="10" rx="38" ry="3" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
        {/* Rim glare spot */}
        <path d="M 15 10 C 15 8 20 6 30 6" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );
};
