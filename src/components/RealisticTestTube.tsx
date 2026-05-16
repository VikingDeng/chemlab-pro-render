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

export const RealisticTestTube: React.FC<GlassProps> = ({ 
  volume, 
  color, 
  isReacting, 
  reactionType,
      particleColor = '#fff', 
    width = 24, // Thin
    velocity = {x: 0, y: 0},
  temperature = 22.4,
  boilingPoint = 100,
  organicVolume = 0,
  organicColor = 'rgba(255,255,255,0.1)',
  organicDensity = 0.7,
  timeSinceReaction = 0,
}) => {
  const sloshingAngle = Math.max(-15, Math.min(15, -velocity.x * 0.05));
  const frostOpacity = Math.max(0, Math.min(1, (12 - temperature) / 12));
  const height = width * 5.5; 
  const maxFillPercent = 85; 
  const totalVolume = volume + organicVolume;
  const maxVolume = 20; // 20mL max
  const fillPercent = (Math.min(totalVolume, maxVolume) / maxVolume) * maxFillPercent;
  const organicPercent = (organicVolume / Math.max(0.1, totalVolume)) * 100;
  const organicIsTop = organicDensity < 1;
  const isPrecipitate = reactionType?.includes('precipitate') || false;
  const settleProgress = isPrecipitate ? Math.min(1, Math.max(0, timeSinceReaction - 2500) / 12500) : 0;
  const turbidityOpacity = isPrecipitate ? Math.max(0.02, 0.92 - settleProgress * 0.9) : 0;
  const sedimentHeight = isPrecipitate ? 4 + settleProgress * 18 : 0;

  // Determine if it's coated in Silver (Tollens' reaction)
  let isSilverCoated = false;
  if (color === 'rgba(203, 213, 225, 1)') { // Matched from chemEngine Ag_mirror definition
     isSilverCoated = true;
  }

  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
  const r = rgbaMatch ? parseInt(rgbaMatch[1], 10) : 255;
  const g = rgbaMatch ? parseInt(rgbaMatch[2], 10) : 255;
  const b = rgbaMatch ? parseInt(rgbaMatch[3], 10) : 255;
  // const opacity = rgbaMatch ? parseFloat(rgbaMatch[4]) : 0;

  const isBoiling = temperature >= (boilingPoint - 0.5);

  return (
    <div style={{ width, height, position: 'relative' }} className="group">
      {/* Outer Caustics */}
      {totalVolume > 0 && (
        <div 
          className="absolute -bottom-2 -left-1 -right-1 h-4 rounded-[100%] blur-sm opacity-40 mix-blend-screen pointer-events-none"
          style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
        />
      )}
      
      {isReacting && (
        <motion.div 
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.15, 0.95] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute -inset-4 rounded-[40%] blur-[20px] z-[-1] mix-blend-screen pointer-events-none"
          style={{ backgroundColor: particleColor }}
        />
      )}

      {/* Main Glass Body */}
      <div 
        className="absolute inset-0 border-l-[2px] border-r-[2px] border-b-[3px] border-white/40 shadow-[inset_0_0_10px_rgba(255,255,255,0.3)] backdrop-blur-sm pointer-events-none overflow-hidden z-10"
        style={{ borderRadius: `0 0 ${width/2}px ${width/2}px`, background: 'rgba(255,255,255,0.05)' }}
      >
        {/* Fill Area Container */}
        <div className="absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden origin-bottom transition-all duration-300"
             style={{ 
               height: `${fillPercent}%`,
               transform: `perspective(200px) rotateZ(${sloshingAngle}deg)`,
               borderRadius: `0 0 ${width/2}px ${width/2}px`
             }}>
             
          {/* Main Liquid */}
          <div className="absolute inset-x-0 bottom-0 h-[200%] transition-colors duration-500 z-10"
               style={{ 
                 backgroundColor: color,
                 boxShadow: isSilverCoated ? 
                   `inset 0 0 10px rgba(0,0,0,0.8), inset 5px 0 15px rgba(255,255,255,0.9), inset -5px 0 15px rgba(0,0,0,0.5)` : 
                   'none'
               }}>
            {/* Meniscus */}
            <div className="absolute top-0 inset-x-0 h-[4px] rounded-[100%] border-[0.5px] border-white/50 bg-white/20 shadow-[0_2px_4px_rgba(0,0,0,0.1)]" style={{ backgroundColor: color, filter: 'brightness(1.2)' }} />
          </div>

          {/* Organic Layer (Top Layer) */}
          {organicVolume > 0 && (
            <div className="absolute inset-x-0 transition-colors duration-500 z-20 backdrop-blur-md"
                 style={{ 
                   top: organicIsTop ? 0 : 'auto',
                   bottom: organicIsTop ? 'auto' : 0,
                   height: `${organicPercent}%`, 
                   backgroundColor: organicColor 
                 }}>
              <div className="absolute top-0 inset-x-0 h-[4px] rounded-[100%] border-[0.5px] border-white/50 bg-white/30" />
              <div className="absolute bottom-0 inset-x-0 h-[2px] rounded-[100%] border-b border-black/20" />
            </div>
          )}

          {isPrecipitate && (
            <div
              className="absolute inset-0 z-30 blur-[0.5px]"
              style={{
                backgroundColor: `color-mix(in srgb, ${particleColor} 42%, transparent)`,
                backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")',
                opacity: turbidityOpacity,
              }}
            />
          )}

          {isPrecipitate && sedimentHeight > 0 && (
            <div
              className="absolute bottom-0 inset-x-0 z-40 overflow-hidden"
              style={{
                height: `${sedimentHeight}%`,
                backgroundColor: particleColor,
                opacity: 0.92,
                borderTop: '1px solid rgba(255,255,255,0.2)',
                boxShadow: `inset 0 2px 4px rgba(0,0,0,0.25), 0 -2px 8px ${particleColor}`,
              }}
            >
              <div
                className="absolute top-0 inset-x-0 h-[3px]"
                style={{
                  backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.35) 1px, transparent 1px)',
                  backgroundSize: '6px 3px',
                  opacity: 0.7,
                }}
              />
            </div>
          )}
        </div>
        
        {/* Frost / Steam */}
        {frostOpacity > 0 && (
          <div className="absolute inset-0 bg-white/50 pointer-events-none z-30 transition-opacity duration-[2s]"
               style={{ opacity: frostOpacity, backdropFilter: `blur(${frostOpacity * 4}px)`, WebkitMaskImage: 'linear-gradient(to top, white, transparent)', maskImage: 'linear-gradient(to top, white, transparent)' }} />
        )}

        <div className="absolute top-1 left-1 bottom-4 w-1/4 bg-gradient-to-r from-white/60 to-transparent rounded-l-full blur-[1px]" />
        
        {/* Bubble Particles container */}
        <div className="absolute inset-x-0 bottom-0 pointer-events-none z-20 overflow-hidden" style={{ height: `${fillPercent}%` }}>
          <AnimatePresence>
            {isBoiling && [...Array(3)].map((_, i) => {
              const bubbleSeed = `testtube-${i}-${width}`;
              const initialX = (seededValue(bubbleSeed, 1) - 0.5) * (width / 2);
              const targetX = (seededValue(bubbleSeed, 2) - 0.5) * width;
              const duration = 0.8 + seededValue(bubbleSeed, 3) * 0.4;
              const delay = seededValue(bubbleSeed, 4);

              return (
                <motion.div
                  key={`boil-${i}`}
                  initial={{ y: '100%', x: initialX, scale: 0.2, opacity: 0 }}
                  animate={{ y: '-20%', x: targetX, scale: 1.5, opacity: [0, 0.8, 0] }}
                  transition={{ repeat: Infinity, duration, delay }}
                  className="absolute left-1/2 bottom-0 w-[4px] h-[4px] rounded-full bg-white/60 blur-[0.5px]"
                  style={{ marginLeft: '-2px' }}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="absolute top-0 -inset-x-0.5 h-[6px] border-[1px] border-white/60 rounded-[100%] bg-gradient-to-b from-white/10 to-transparent shadow-[0_2px_4px_rgba(255,255,255,0.2)] pointer-events-none z-20" />
    </div>
  );
};
