
import { Thermometer, Droplets, Gauge } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface DashboardReadoutsProps {
  focusedLabel?: string;
  boilingPoint?: number;
  phaseLabel?: string;
  pressure?: number;
}

export function DashboardReadouts({ focusedLabel = '未选择容器', boilingPoint = 100, phaseLabel = '未选择', pressure = 1 }: DashboardReadoutsProps) {
  const [temp, setTemp] = useState(22.4);
  const [ph, setPh] = useState(7.0);
  const [trend, setTrend] = useState('→'); // '↗', '↘', '→'
  const [tempColor, setTempColor] = useState('#d6c59d');

  useEffect(() => {
    // Listen for exact temp/ph from the physical reaction engine
    const handleReactionEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { ph: exactPh, temp: exactTemp } = customEvent.detail;
      
      // Removed global reaction heating logic since Physics engine drives temperature directly now
      if (exactPh !== undefined) setPh(exactPh);
      if (exactTemp !== undefined) {
        setTemp(prev => {
          if (exactTemp > prev + 0.1) setTrend('↗');
          else if (exactTemp < prev - 0.1) setTrend('↘');
          else setTrend('→');
          
          if (exactTemp > 60) setTempColor('#f43f5e'); // Red hot
          else if (exactTemp > 30) setTempColor('#f59e0b'); // Amber warm
          else setTempColor('#d6c59d'); // neutral
          
          return Number(exactTemp.toFixed(1));
        });
      }
    };
    
    // Listen for custom temp sync events for smooth animation during physics heating
    const handleTempSync = (e: Event) => {
       const customEvent = e as CustomEvent;
       const { temp: exactTemp, ph: exactPh } = customEvent.detail;
       if (exactTemp !== undefined) {
          setTemp(prev => {
            if (exactTemp > prev + 0.1) setTrend('↗');
            else if (exactTemp < prev - 0.1) setTrend('↘');
            else setTrend('→');
            
            if (exactTemp > 60) setTempColor('#f43f5e');
            else if (exactTemp > 30) setTempColor('#f59e0b');
            else setTempColor('#d6c59d');
            
            return Number(exactTemp.toFixed(1));
          });
       }
       
       if (exactPh !== undefined) {
         setPh(exactPh);
       }
    };

    window.addEventListener('reagentDrop', handleReactionEvent);
    window.addEventListener('tempSync', handleTempSync);
    return () => {
       window.removeEventListener('reagentDrop', handleReactionEvent);
       window.removeEventListener('tempSync', handleTempSync);
    };
  }, []);

  // Calculate pH dot position (0-14 maps to 0%-100%)
  const phPosition = (ph / 14) * 100;

  return (
    <div data-panel="dashboard-readouts" className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 glass-panel z-30 w-[min(520px,calc(100%-32px))]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 text-[10px] mb-2 uppercase tracking-[1px]">
        <span className="text-[#475569] font-bold">读数</span>
        <span className="text-[#94a3b8] font-medium normal-case tracking-normal truncate max-w-[220px]">当前容器：{focusedLabel}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:items-center">
      {/* READOUT 1 — Temperature */}
    <div className="flex items-center gap-3 w-[132px] md:w-[140px]">
        <Thermometer className="shrink-0 transition-colors" style={{ color: tempColor }} size={20} />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-[#475569] tracking-[1px] font-bold leading-none mb-1">TEMP</span>
          <div className="flex items-center gap-1">
            <motion.span 
              key={temp}
              initial={{ opacity: 0.5, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="leading-none transition-colors" 
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '18px', color: tempColor }}
            >
              {temp}°C
            </motion.span>
            <span className="text-[12px]" style={{ color: tempColor }}>{trend}</span>
          </div>
        </div>
      </div>

      <div className="hidden sm:block w-[1px] h-[24px] bg-[rgba(255,255,255,0.06)] mx-3 md:mx-4"></div>

      {/* READOUT 2 — pH Level */}
      <div className="flex items-center gap-3 w-[132px] md:w-[140px]">
        <Droplets className="text-[#10b981] shrink-0" size={20} />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-[#475569] tracking-[1px] font-bold leading-none mb-1">pH</span>
          <div className="flex flex-col gap-1">
            <motion.span 
              key={ph}
              initial={{ opacity: 0.5, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              className="leading-none" 
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '18px', color: '#e2e8f0' }}
            >
              {ph.toFixed(1)}
            </motion.span>
            <div className="w-[60px] h-[3px] rounded-full relative bg-gradient-to-r from-[#f43f5e] via-[#10b981] to-[#8b5cf6]">
              <motion.div 
                animate={{ left: `${phPosition}%` }}
                transition={{ type: 'spring', stiffness: 100 }}
                className="absolute top-1/2 -translate-y-1/2 w-[6px] h-[6px] bg-white rounded-full shadow-[0_0_4px_rgba(255,255,255,0.8)]"
                style={{ transform: 'translate(-50%, -50%)' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="hidden sm:block w-[1px] h-[24px] bg-[rgba(255,255,255,0.06)] mx-3 md:mx-4"></div>

      {/* READOUT 3 — Pressure / Boiling */}
      <div className="flex items-center gap-3 w-[132px] md:w-[140px] col-span-2 sm:col-span-1">
        <Gauge className="text-[#94a3b8] shrink-0" size={20} />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-[#475569] tracking-[1px] font-bold leading-none mb-1">P / BP</span>
          <span className="leading-none" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '18px', color: '#94a3b8' }}>{pressure.toFixed(2)} atm</span>
          <span className="text-[11px] text-[#64748b] mt-1 truncate max-w-[124px]">{boilingPoint.toFixed(1)}°C · {phaseLabel}</span>
        </div>
      </div>
      </div>

    </div>
  );
}
