import React from 'react';
import { motion } from 'framer-motion';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function GlassRodArtwork({
  isStirring = false,
  className = '',
}: {
  isStirring?: boolean;
  className?: string;
}) {
  const uid = React.useId().replace(/:/g, '');

  return (
    <motion.div
      className={className}
      animate={{
        rotate: isStirring ? [0, 7, -7, 0] : -16,
        y: isStirring ? [0, -1, 0] : 0,
      }}
      transition={{ repeat: isStirring ? Infinity : 0, duration: 1.05, ease: 'easeInOut' }}
      style={{ width: 156, height: 26 }}
    >
      <svg viewBox="0 0 240 40" className="h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`rod-core-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
            <stop offset="18%" stopColor="rgba(255,255,255,0.66)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="82%" stopColor="rgba(148,163,184,0.28)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.12)" />
          </linearGradient>
          <linearGradient id={`rod-glow-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(214,197,157,0.0)" />
            <stop offset="50%" stopColor="rgba(214,197,157,0.24)" />
            <stop offset="100%" stopColor="rgba(214,197,157,0.0)" />
          </linearGradient>
        </defs>
        <ellipse cx="120" cy="20" rx="98" ry="5.5" fill={`url(#rod-glow-${uid})`} />
        <rect x="18" y="15" width="204" height="10" rx="5" fill="rgba(2,6,23,0.34)" />
        <rect x="16" y="13" width="208" height="14" rx="7" fill={`url(#rod-core-${uid})`} />
        <rect x="28" y="16.5" width="146" height="3" rx="1.5" fill="rgba(255,255,255,0.72)" />
        <rect x="34" y="20" width="170" height="1.6" rx="0.8" fill="rgba(255,255,255,0.18)" />
        <circle cx="34" cy="20" r="7" fill="rgba(255,255,255,0.06)" />
        <circle cx="206" cy="20" r="7" fill="rgba(255,255,255,0.06)" />
      </svg>
    </motion.div>
  );
}

export function PipetteArtwork({
  volume,
  color,
  className = '',
}: {
  volume: number;
  color: string;
  className?: string;
}) {
  const uid = React.useId().replace(/:/g, '');
  const fill = clamp(volume / 10, 0, 1);
  const liquidHeight = 26 + fill * 110;

  return (
    <motion.div
      className={className}
      animate={{ y: [0, -1, 0], rotate: [0, -1.5, 0] }}
      transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
      style={{ width: 56, height: 162 }}
    >
      <svg viewBox="0 0 80 220" className="h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`pipette-glass-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="20%" stopColor="rgba(255,255,255,0.62)" />
            <stop offset="52%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="76%" stopColor="rgba(148,163,184,0.22)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.10)" />
          </linearGradient>
          <linearGradient id={`pipette-cap-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#fdba74" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
        </defs>
        <ellipse cx="40" cy="193" rx="16" ry="4.5" fill="rgba(2,6,23,0.35)" />
        <rect x="31" y="14" width="18" height="180" rx="9" fill="rgba(2,6,23,0.26)" />
        <rect x="29" y="12" width="22" height="184" rx="11" fill={`url(#pipette-glass-${uid})`} />
        <rect x="32" y="22" width="15" height={`${liquidHeight}`} rx="7.5" fill={color} opacity="0.82" />
        <rect x="34.5" y="28" width="2" height="100" rx="1" fill="rgba(255,255,255,0.55)" />
        <path d="M 29 20 C 35 18, 45 18, 51 20" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.2" />
        <rect x="25" y="4" width="30" height="12" rx="6" fill={`url(#pipette-cap-${uid})`} />
        <rect x="33" y="194" width="6" height="18" rx="3" fill="rgba(255,255,255,0.7)" />
        <path d="M 37 204 L 41 204 L 43 214 L 35 214 Z" fill="rgba(255,255,255,0.66)" />
        {Array.from({ length: 8 }).map((_, i) => (
          <rect
            key={i}
            x={43 + i * 3.4}
            y={30 + i * 14}
            width="8"
            height="0.9"
            rx="0.4"
            fill="rgba(255,255,255,0.38)"
          />
        ))}
      </svg>
    </motion.div>
  );
}

export function TransferTubeArtwork({
  className = '',
}: {
  className?: string;
}) {
  const uid = React.useId().replace(/:/g, '');

  return (
    <motion.div
      className={className}
      animate={{ rotate: [-1.5, 1.2, -1.5] }}
      transition={{ repeat: Infinity, duration: 4.8, ease: 'easeInOut' }}
      style={{ width: 184, height: 66 }}
    >
      <svg viewBox="0 0 260 92" className="h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`tube-core-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
            <stop offset="18%" stopColor="rgba(255,255,255,0.62)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="82%" stopColor="rgba(148,163,184,0.26)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
          </linearGradient>
          <linearGradient id={`tube-shadow-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(2,6,23,0.38)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0.08)" />
          </linearGradient>
        </defs>
        <path
          d="M24 47 C 60 10, 100 12, 132 36 S 196 68, 232 36"
          fill="none"
          stroke={`url(#tube-shadow-${uid})`}
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24 47 C 60 10, 100 12, 132 36 S 196 68, 232 36"
          fill="none"
          stroke={`url(#tube-core-${uid})`}
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M56 28 C 88 18, 118 18, 152 42"
          fill="none"
          stroke="rgba(255,255,255,0.72)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M150 34 L150 72"
          fill="none"
          stroke="rgba(255,255,255,0.42)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M150 36 L150 72"
          fill="none"
          stroke="rgba(214,197,157,0.35)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="18" cy="47" r="11" fill="rgba(255,255,255,0.08)" />
        <circle cx="240" cy="36" r="10" fill="rgba(255,255,255,0.08)" />
      </svg>
    </motion.div>
  );
}

export function FunnelArtwork({
  className = '',
}: {
  className?: string;
}) {
  const uid = React.useId().replace(/:/g, '');

  return (
    <motion.div
      className={className}
      animate={{ y: [0, -1, 0], rotate: [-1.5, 0.8, -1.5] }}
      transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut' }}
      style={{ width: 102, height: 148 }}
    >
      <svg viewBox="0 0 120 176" className="h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`funnel-core-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.88)" />
            <stop offset="42%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(148,163,184,0.18)" />
          </linearGradient>
          <linearGradient id={`funnel-shadow-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(2,6,23,0.4)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0.06)" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="152" rx="24" ry="6" fill="rgba(2,6,23,0.18)" />
        <path
          d="M24 20 H96 L72 88 C 68 98, 52 98, 48 88 Z"
          fill={`url(#funnel-shadow-${uid})`}
          opacity="0.85"
        />
        <path
          d="M27 18 H93 L70 84 C 66 93, 54 93, 50 84 Z"
          fill={`url(#funnel-core-${uid})`}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.2"
        />
        <path
          d="M56 86 H64 V148 C 64 156, 56 158, 56 150 Z"
          fill={`url(#funnel-core-${uid})`}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.1"
        />
        <path d="M38 34 C 54 30, 68 30, 84 34" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        <path d="M60 88 V154" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.4" />
      </svg>
    </motion.div>
  );
}
