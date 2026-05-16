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

export const FlaskGlass: React.FC<GlassProps> = ({ 
  volume, 
  color, 
  isReacting, 
  reactionType, 
  particles = [], 
  particleColor = '#fff', 
  width = 90 
}) => {
  const height = width * 1.3; 
  // Max liquid height percentage. Because of the triangular shape, 
  // we just let it go up to ~75% max visual height.
  const maxFillPercent = 75; 
  const fillPercent = (Math.min(volume, 250) / 250) * maxFillPercent;

  return (
    <div style={{ width, height, position: 'relative' }} className="group">
      {/* Outer glow during reaction */}
      {isReacting && (
        <motion.div 
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="absolute inset-0 rounded-[30%] blur-[30px] z-[-1]"
          style={{ backgroundColor: particleColor }}
        />
      )}

      {/* SVG defs for liquid clipping mask */}
      <svg viewBox="0 0 100 130" className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <clipPath id="flask-liquid-clip" clipPathUnits="userSpaceOnUse">
            <path d="M 36 15 L 64 15 L 64 42 L 86 110 Q 86 122 75 122 L 25 122 Q 14 122 14 110 L 36 42 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* Back wall of the glass, rim, and scale marks */}
      <svg viewBox="0 0 100 130" className="absolute inset-0 w-full h-full pointer-events-none z-[1]">
        {/* Main Body Background */}
        <path 
          d="M 35 10 L 65 10 L 65 40 L 85 110 Q 85 125 75 125 L 25 125 Q 15 125 15 110 L 35 40 Z" 
          fill="rgba(10,15,30,0.15)" 
          stroke="url(#flask-glass-edge)" 
          strokeWidth="2"
          style={{ backdropFilter: 'blur(4px) saturate(120%)' }}
        />
        <defs>
          <linearGradient id="flask-glass-edge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="15%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="85%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
          </linearGradient>
        </defs>

        {/* Scale Marks (Right-aligned to left diagonal) */}
        <g stroke="rgba(255,255,255,0.4)" strokeWidth="1" opacity="0.9">
          <line x1="32" y1="50" x2="38" y2="50" />
          <text x="42" y="52" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="monospace">250</text>
          
          <line x1="28" y1="68" x2="34" y2="68" />
          <text x="38" y="70" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="monospace">200</text>
          
          <line x1="24" y1="86" x2="30" y2="86" />
          <text x="34" y="88" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="monospace">100</text>
          
          <line x1="20" y1="104" x2="26" y2="104" />
          <text x="30" y="106" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="monospace">50</text>
        </g>
      </svg>

      {/* Liquid Fill Layer */}
      <div className="absolute inset-0 w-full h-full z-[2] overflow-hidden pointer-events-none">
        <svg viewBox="0 0 100 130" className="absolute inset-0 w-full h-full">
          <g clipPath="url(#flask-liquid-clip)">
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
                          inset 15px 0 15px rgba(0,0,0,0.5), 
                          inset -15px 0 15px rgba(0,0,0,0.5), 
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
                        className="w-[100%] h-[100%] absolute top-[0%] left-0 mix-blend-overlay pointer-events-none opacity-50"
                        style={{
                          backgroundImage: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.6) 0%, transparent 50%)'
                        }}
                      />
                      
                      {/* Specular curved highlight specifically for the liquid body */}
                      <div 
                        className="absolute top-0 left-[25%] w-[8%] h-full opacity-60 mix-blend-overlay"
                        style={{
                           background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
                           transform: 'skewX(-10deg)'
                        }}
                      />

                      {/* Turbidity / Cloudiness overlay for precipitates */}
                      {reactionType?.includes('precipitate') && (
                         <div 
                           className="absolute inset-0 mix-blend-normal blur-[1px]"
                           style={{
                             backgroundColor: `color-mix(in srgb, ${particleColor} 40%, transparent)`,
                             backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")',
                             opacity: 0.85
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
      <div className="absolute inset-0 w-full h-full z-[3]" style={{ clipPath: 'url(#flask-liquid-clip)', pointerEvents: 'none' }}>
        {isReacting && particles.map(p => {
          const gasMode = reactionType?.includes('gas');
          const targetY = gasMode ? -20 - seededValue(p.id, 1) * 20 : 100 - seededValue(p.id, 2) * 20;
          const targetX = (seededValue(p.id, 3) - 0.5) * 30;
          const particleLeft = `${35 + seededValue(p.id, 4) * 30}%`;

          return (
            <motion.div 
              key={p.id}
              initial={{ 
                y: gasMode ? 100 : 0, 
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
                repeat: gasMode ? Infinity : 0, 
                duration: p.duration, 
                delay: p.delay,
                ease: gasMode ? "easeIn" : "easeOut"
              }}
              className="absolute rounded-full blur-[0.5px]"
              style={{ 
                backgroundColor: particleColor,
                boxShadow: `0 0 6px ${particleColor}`,
                left: particleLeft,
                bottom: gasMode ? '10px' : undefined,
                top: gasMode ? undefined : '50%',
                width: `${p.size}px`, 
                height: `${p.size}px`
              }}
            />
          );
        })}
      </div>

      {/* Front Glass Reflections Layer */}
      <svg viewBox="0 0 100 130" className="absolute inset-0 w-full h-full pointer-events-none z-[4]">
        {/* Left highlight */}
        <path 
          d="M 37 15 L 37 38 L 18 105 Q 18 115 25 120" 
          fill="none" 
          stroke="url(#left-highlight)" 
          strokeWidth="3" 
          strokeLinecap="round"
          opacity="0.8"
        />
        {/* Right thin highlight */}
        <path 
          d="M 63 20 L 63 38 L 82 105" 
          fill="none" 
          stroke="url(#right-highlight)" 
          strokeWidth="1.5" 
          strokeLinecap="round"
          opacity="0.6"
        />
        <defs>
          <linearGradient id="left-highlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
          </linearGradient>
          <linearGradient id="right-highlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
          </linearGradient>
        </defs>

        {/* Rim Highlights */}
        <ellipse cx="50" cy="10" rx="15" ry="3" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <ellipse cx="50" cy="10" rx="13" ry="1.5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
        {/* Rim glare spot */}
        <path d="M 38 10 C 38 8 42 7 48 7" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );
};
