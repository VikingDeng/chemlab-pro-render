import React, { useEffect, useRef, useState } from 'react';
import { LineChart, Activity, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThermoChartProps {
  temperatureHistory: { time: number, temp: number }[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onExport: () => void;
}

export const ThermoChart: React.FC<ThermoChartProps> = ({ temperatureHistory, isOpen, setIsOpen, onExport }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setIsHovered] = useState(false);

  useEffect(() => {
    if (!isOpen || !canvasRef.current || temperatureHistory.length === 0) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
       const y = height - (i * height / 4);
       ctx.beginPath();
       ctx.moveTo(0, y);
       ctx.lineTo(width, y);
       ctx.stroke();
    }

    // Draw line
    const maxTemp = Math.max(120, ...temperatureHistory.map(d => d.temp));
    const minTemp = Math.min(-20, ...temperatureHistory.map(d => d.temp));
    const tempRange = maxTemp - minTemp;
    
    // We want to show the last 60 seconds (or 60 data points if 1 per sec)
    // Assuming data comes in fast, let's just plot the last 100 points
    const plotData = temperatureHistory.slice(-100);

    ctx.beginPath();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    plotData.forEach((point, i) => {
      const x = (i / Math.max(1, plotData.length - 1)) * width;
      const y = height - ((point.temp - minTemp) / tempRange) * height;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill gradient
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(244,63,94,0.3)');
    gradient.addColorStop(1, 'rgba(244,63,94,0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Current temp marker
    if (plotData.length > 0) {
      const lastPoint = plotData[plotData.length - 1];
      const x = width;
      const y = height - ((lastPoint.temp - minTemp) / tempRange) * height;
      
      ctx.beginPath();
      ctx.arc(x - 2, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#f43f5e';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Text
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${lastPoint.temp.toFixed(1)}°C`, width - 8, y - 8);
    }

  }, [temperatureHistory, isOpen]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`glass-panel p-2 rounded-lg flex items-center justify-center transition-colors shadow-lg pointer-events-auto ${isOpen ? 'bg-[#f43f5e]/20 text-[#f43f5e] border-[#f43f5e]/50' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        title="热力学监测"
      >
        <Activity size={20} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className="absolute bottom-[calc(100%+12px)] left-0 z-[9999] w-[min(288px,calc(100vw-32px))] md:w-72 glass-panel p-3 border-[#f43f5e]/20 shadow-[0_0_30px_rgba(244,63,94,0.1)] pointer-events-auto origin-bottom-left flex flex-col gap-2"
          >
            <div className="flex justify-between items-center mb-1">
               <div className="text-[12px] font-bold text-[#f43f5e] flex items-center gap-1.5">
                  <LineChart size={14} /> 实时温度曲线
               </div>
               <button 
                 onClick={onExport}
                 onMouseEnter={() => setIsHovered(true)}
                 onMouseLeave={() => setIsHovered(false)}
                 className="text-gray-400 hover:text-[#22d3ee] transition-colors p-1"
                 title="导出实验日志 (CSV/TXT)"
               >
                 <Download size={14} />
               </button>
            </div>
            
            <div className="w-full h-32 bg-black/40 rounded border border-white/5 relative overflow-hidden">
               {temperatureHistory.length === 0 ? (
                 <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-500">
                    等待温度数据...
                 </div>
               ) : (
                 <canvas 
                   ref={canvasRef} 
                   width={230} 
                   height={126} 
                   className="w-full h-full"
                 />
               )}
            </div>

            <div className="flex justify-between text-[9px] text-gray-500 font-mono px-1">
               <span>-60s</span>
               <span>当前</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
