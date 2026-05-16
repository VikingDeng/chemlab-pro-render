import { useMemo, useState } from 'react';
import { RealisticBeaker } from './components/RealisticBeaker';
import { RealisticFlask } from './components/RealisticFlask';

function seededValue(seed: string, offset: number) {
  let hash = 0;
  const input = `${seed}-${offset}`;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (Math.sin(hash) + 1) / 2;
}


export function TestPage() {
  const [vol, setVol] = useState(150);
  const [r, setR] = useState(34);
  const [g, setG] = useState(211);
  const [b, setB] = useState(238);
  const [a, setA] = useState(0.8);
  const [isReacting, setIsReacting] = useState(false);
  const [reactionType, setReactionType] = useState('precipitate'); // precipitate or gas

  const color = `rgba(${r}, ${g}, ${b}, ${a})`;
  
  const particles = useMemo(
    () => Array.from({ length: reactionType === 'gas' ? 25 : 15 }).map((_, i) => ({
      id: i,
      left: `${20 + seededValue(reactionType, i) * 60}%`,
      duration: reactionType === 'gas'
        ? 1 + seededValue(reactionType, i + 100)
        : 1.5 + seededValue(reactionType, i + 100) * 2,
      delay: seededValue(reactionType, i + 200) * 2,
      size: 3 + seededValue(reactionType, i + 300) * 4
    })),
    [reactionType]
  );
  
  const particleColor = reactionType === 'gas' ? '#facc15' : '#f8fafc'; // yellow gas, white precipitate
  
  return (
    <div className="min-h-screen bg-[#060913] text-white p-8 flex flex-col items-center relative z-0">
      
      {/* Background pattern to explicitly prove transparency */}
      <div className="absolute inset-0 z-[-1] pointer-events-none opacity-30 flex items-center justify-center overflow-hidden">
        <div className="text-[120px] font-black text-white transform -rotate-12 select-none tracking-widest leading-none text-center">
          CHEMISTRY<br/>LAB PRO
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-8">UI & Visual Effects Test Lab</h1>
      
      <div className="flex gap-16 items-end mb-16 h-[300px]">
        <div className="flex flex-col items-center gap-4">
          <RealisticBeaker 
             volume={vol} 
             color={color} 
             isReacting={isReacting} 
             reactionType={reactionType}
             particles={particles}
             particleColor={particleColor}
             width={140}
          />
          <span className="text-sm text-gray-400">RealisticBeaker</span>
        </div>
        
        <div className="flex flex-col items-center gap-4">
          <RealisticFlask 
             volume={vol} 
             color={color} 
             isReacting={isReacting} 
             reactionType={reactionType}
             particles={particles}
             particleColor={particleColor}
             width={140}
          />
          <span className="text-sm text-gray-400">RealisticFlask</span>
        </div>
      </div>
      
      <div className="glass-panel p-6 w-[500px] flex flex-col gap-6">
        <h3 className="font-bold text-[#22d3ee] border-b border-white/10 pb-2">Controls</h3>
        
        <div className="space-y-4">
          <div>
            <label className="flex justify-between text-sm text-gray-300 mb-1">
              <span>Volume (mL)</span>
              <span className="font-mono">{vol}</span>
            </label>
            <input type="range" min="0" max="250" value={vol} onChange={e => setVol(Number(e.target.value))} className="w-full accent-[#22d3ee]" />
          </div>
          
          <div className="pt-4 border-t border-white/10">
            <label className="flex justify-between text-sm text-gray-300 mb-1">
              <span>Color R</span>
              <span className="font-mono">{r}</span>
            </label>
            <input type="range" min="0" max="255" value={r} onChange={e => setR(Number(e.target.value))} className="w-full accent-red-500" />
          </div>
          <div>
            <label className="flex justify-between text-sm text-gray-300 mb-1">
              <span>Color G</span>
              <span className="font-mono">{g}</span>
            </label>
            <input type="range" min="0" max="255" value={g} onChange={e => setG(Number(e.target.value))} className="w-full accent-green-500" />
          </div>
          <div>
            <label className="flex justify-between text-sm text-gray-300 mb-1">
              <span>Color B</span>
              <span className="font-mono">{b}</span>
            </label>
            <input type="range" min="0" max="255" value={b} onChange={e => setB(Number(e.target.value))} className="w-full accent-blue-500" />
          </div>
          <div>
            <label className="flex justify-between text-sm text-gray-300 mb-1">
              <span>Color Alpha</span>
              <span className="font-mono">{a.toFixed(2)}</span>
            </label>
            <input type="range" min="0" max="1" step="0.05" value={a} onChange={e => setA(Number(e.target.value))} className="w-full accent-white" />
          </div>
          
          <div className="pt-4 border-t border-white/10 flex gap-4 items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isReacting} onChange={e => setIsReacting(e.target.checked)} className="accent-[#22d3ee] w-4 h-4" />
              <span className="text-sm">Trigger Reaction</span>
            </label>
            
            {isReacting && (
              <select 
                value={reactionType} 
                onChange={e => setReactionType(e.target.value)}
                className="bg-white/5 border border-white/10 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-[#22d3ee]"
              >
                <option value="precipitate">Precipitate (Solid)</option>
                <option value="gas">Gas (Bubbles)</option>
              </select>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
