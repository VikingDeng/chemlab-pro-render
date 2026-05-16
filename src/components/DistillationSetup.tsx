import React from 'react';

export const DistillationSetup: React.FC<{
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isBoiling: boolean;
  activeColor?: string;
}> = ({ startX, startY, endX, endY, isBoiling, activeColor = 'rgba(255,255,255,0.4)' }) => {
  // SVG Curve drawing for the tube
  const dx = endX - startX;
  // const dy = endY - startY;
  const controlPoint1X = startX + dx * 0.2;
  const controlPoint1Y = startY - 100; // Curve upwards
  const controlPoint2X = startX + dx * 0.8;
  const controlPoint2Y = endY - 150; // Curve upwards then drop
  
  const pathData = `M ${startX} ${startY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${endX} ${endY}`;
  
  // Calculate relative bounds for the SVG viewBox
  // const minX = Math.min(startX, endX, controlPoint1X, controlPoint2X) - 20;
  // const minY = Math.min(startY, endY, controlPoint1Y, controlPoint2Y) - 20;
  // const maxX = Math.max(startX, endX, controlPoint1X, controlPoint2X) + 20;
  // const maxY = Math.max(startY, endY, controlPoint1Y, controlPoint2Y) + 20;
  // const width = maxX - minX;
  // const height = maxY - minY;

  return (
    <svg 
      className="absolute top-0 left-0 pointer-events-none z-[15]"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      {/* Rubber Stopper at start */}
      <path 
        d={`M ${startX-10} ${startY+5} L ${startX+10} ${startY+5} L ${startX+14} ${startY-10} L ${startX-14} ${startY-10} Z`}
        fill="#333" 
        stroke="#111"
      />
      
      {/* Outer Tube */}
      <path 
        d={pathData} 
        fill="none" 
        stroke="rgba(255,255,255,0.4)" 
        strokeWidth="12" 
        strokeLinecap="round"
        className="drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]"
      />
      {/* Inner Tube highlight */}
      <path 
        d={pathData} 
        fill="none" 
        stroke="rgba(255,255,255,0.8)" 
        strokeWidth="4" 
        strokeLinecap="round"
      />
      
      {/* Steam flow animation inside tube */}
      {isBoiling && (
        <path 
          d={pathData} 
          fill="none" 
          stroke={activeColor} 
          strokeWidth="6" 
          strokeLinecap="round"
          strokeDasharray="10 20"
          className="animate-[dash_1s_linear_infinite]"
        />
      )}

      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -30;
          }
        }
      `}</style>
    </svg>
  );
};
