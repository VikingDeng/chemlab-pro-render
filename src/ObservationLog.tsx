import { useState, useEffect, useRef, useCallback } from 'react';
import { ScrollText, Terminal, Hand, Gauge, Zap, Eye, ArrowUp } from 'lucide-react';

export type LogType = 'system' | 'action' | 'measurement' | 'reaction' | 'observation' | 'agent';

export interface LogEntry {
  id: string;
  time: string;
  event: string;
  type: LogType;
}

export interface ObservationLogProps {
  className?: string;
}

function getCurrentTimeString() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

export function ObservationLog({ className = '' }: ObservationLogProps) {
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    {
      id: 'system-ready',
      time: getCurrentTimeString(),
      event: '实验台已就绪，等待新的实验操作',
      type: 'system'
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasUnreadLogs, setHasUnreadLogs] = useState(false);

  const isNearBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 48;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  }, []);

  const getIcon = (type: LogType) => {
    switch (type) {
      case 'system': return <Terminal size={14} />;
      case 'action': return <Hand size={14} />;
      case 'measurement': return <Gauge size={14} />;
      case 'reaction': return <Zap size={14} />;
      case 'observation': return <Eye size={14} />;
      case 'agent': return <Terminal size={14} />;
    }
  };

  const getLogStyle = (type: LogType) => {
    switch (type) {
      case 'system':
        return { text: 'text-[#64748b] italic', icon: 'text-[#64748b]', bg: 'bg-transparent' };
      case 'action':
        return { text: 'text-[#94a3b8]', icon: 'text-[#94a3b8]', bg: 'bg-transparent' };
      case 'measurement':
        return { text: 'text-[#d6c59d] font-mono', icon: 'text-[#d6c59d]', bg: 'bg-transparent' };
      case 'reaction':
        return { text: 'text-[#f59e0b]', icon: 'text-[#f59e0b]', bg: 'bg-[rgba(245,158,11,0.05)] border border-[rgba(245,158,11,0.2)]' };
      case 'observation':
        return { text: 'text-[#e2e8f0]', icon: 'text-[#e2e8f0]', bg: 'bg-transparent' };
      case 'agent':
        return { text: 'text-[#a855f7]', icon: 'text-[#a855f7]', bg: 'bg-[rgba(168,85,247,0.06)] border border-[rgba(168,85,247,0.18)]' };
    }
  };

  useEffect(() => {
    let timeoutId: number | null = null;
    const handleReagentDrop = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { name, reacted, isDrop } = customEvent.detail;
      
      // We only log if it's explicitly marked as a reaction log dispatch
      if (isDrop) return;
      
      const timeString = getCurrentTimeString();

      // Prevent React StrictMode duplicate events using a simple debounce mechanism
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setLogs(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            time: timeString,
            event: reacted ? `检测到反应：${reacted} (加入 ${name})` : `加入试剂：${name}`,
            type: reacted ? 'reaction' : 'action'
          }
        ]);
      }, 50); // 50ms debounce
    };

    window.addEventListener('reagentDrop', handleReagentDrop);

    const handleAgentNote = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { message } = customEvent.detail || {};
      if (!message) return;
      setLogs(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          time: getCurrentTimeString(),
          event: message,
          type: 'agent'
        }
      ]);
    };
    window.addEventListener('agentNote', handleAgentNote);
    return () => {
      window.removeEventListener('reagentDrop', handleReagentDrop);
      window.removeEventListener('agentNote', handleAgentNote);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setLogs(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        time: getCurrentTimeString(),
        event: inputValue,
        type: 'observation'
      }
    ]);
    setInputValue('');
  };

  useEffect(() => {
    const nearBottom = isNearBottom();
    if (nearBottom) {
      requestAnimationFrame(() => {
        scrollToBottom(logs.length <= 2 ? 'auto' : 'smooth');
        setHasUnreadLogs(false);
      });
      return;
    }

    requestAnimationFrame(() => {
      setHasUnreadLogs(true);
    });
  }, [isNearBottom, logs, scrollToBottom]);

  return (
    <div data-panel="observation-log" className={`flex flex-1 min-h-0 flex-col overflow-hidden relative p-4 glass-panel ${className}`}>
      <div className="shrink-0 mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[#e2e8f0] font-semibold flex items-center gap-2 shrink-0">
            <ScrollText size={18} />
            观察日志
          </h2>
        </div>

        {hasUnreadLogs && (
          <button
            type="button"
            onClick={() => {
              scrollToBottom();
              setHasUnreadLogs(false);
            }}
            className="shrink-0 px-2.5 py-1 rounded-full text-[11px] text-[#d6c59d] border border-[#d6c59d]/25 bg-[#d6c59d]/10 hover:bg-[#d6c59d]/15 transition-colors"
          >
            新日志 ↓
          </button>
        )}
      </div>
      
      <div className="relative flex-1 min-h-0 mb-3">
      <div
        ref={scrollContainerRef}
        onScroll={() => {
          if (isNearBottom()) {
            setHasUnreadLogs(false);
          }
        }}
        className="flex-1 h-full overflow-y-auto space-y-2 pr-1 -mr-1 pb-6"
      >
        {logs.map((log) => {
          const style = getLogStyle(log.type);
          
          return (
            <div 
              key={log.id} 
              className={`flex items-start gap-2 p-2 rounded-lg animate-in slide-in-from-bottom-2 fade-in duration-250 ease-out ${style.bg}`}
            >
              <div className="shrink-0 mt-0.5 text-[#475569] font-mono text-[12px] w-[40px]">
                {log.time}
              </div>
              <div className={`shrink-0 mt-0.5 ${style.icon}`}>
                {getIcon(log.type)}
              </div>
              <div className={`text-[13px] leading-relaxed flex-1 break-words ${style.text}`}>
                {log.type === 'action' && log.event.includes('CuSO₄') ? (
                  <span>
                    {log.event.split('CuSO₄')[0]}<span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#d6c59d' }}>CuSO₄</span>{log.event.split('CuSO₄')[1]}
                  </span>
                ) : log.type === 'action' && log.event.includes('NaOH') ? (
                  <span>
                    {log.event.split('NaOH')[0]}<span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#d6c59d' }}>NaOH</span>{log.event.split('NaOH')[1]}
                  </span>
                ) : log.type === 'action' && log.event.includes('HCl') ? (
                  <span>
                    {log.event.split('HCl')[0]}<span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#facc15' }}>HCl</span>{log.event.split('HCl')[1]}
                  </span>
                ) : log.type === 'action' && log.event.includes('AgNO₃') ? (
                  <span>
                    {log.event.split('AgNO₃')[0]}<span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#e2e8f0' }}>AgNO₃</span>{log.event.split('AgNO₃')[1]}
                  </span>
                ) : log.type === 'reaction' && log.event.includes('Cu(OH)₂') ? (
                  <span>
                    {log.event.split('Cu(OH)₂')[0]}<span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#10b981' }}>Cu(OH)₂</span>{log.event.split('Cu(OH)₂')[1]}
                  </span>
                ) : log.type === 'reaction' && log.event.includes('AgCl') ? (
                  <span>
                    {log.event.split('AgCl')[0]}<span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#f1f5f9' }}>AgCl</span>{log.event.split('AgCl')[1]}
                  </span>
                ) : (
                  log.event
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#060913] to-transparent rounded-b-[16px]" />
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="手动记录观察笔记..."
          className="w-full h-[36px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg pl-3 pr-9 text-[13px] text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[rgba(214,197,157,0.4)] focus:bg-[rgba(214,197,157,0.02)] transition-all"
        />
        <button 
          type="submit"
          className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-[#475569] hover:text-[#d6c59d] transition-colors rounded-md"
        >
          <ArrowUp size={16} />
        </button>
      </form>
    </div>
  );
}
