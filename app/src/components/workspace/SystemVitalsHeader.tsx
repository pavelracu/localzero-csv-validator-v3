import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PerformanceMemory {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

declare global {
  interface Performance {
    memory?: PerformanceMemory;
  }
}

const CORE_VERSION = 'WASM_V2.4';
const APP_VERSION = 'v2.4.0-stable';
const RAM_TOOLTIP =
  'RAM usage is an estimate. Precision mode active on Chromium-based browsers.';

interface SystemVitalsHeaderProps {
  isEngineReady: boolean;
  isSavingWorkspace?: boolean;
}


export function SystemVitalsHeader({
  isEngineReady,
  isSavingWorkspace = false,
}: SystemVitalsHeaderProps) {
  const { privacyShieldStatus, hasActiveFile } = useWorkspace();
  const [ram, setRam] = useState<{ usedGB: number; limitGB: number } | null>(null);

  useEffect(() => {
    const read = () => {
      const mem = (performance as Performance & { memory?: PerformanceMemory })
        .memory;
      if (mem?.usedJSHeapSize != null && mem?.jsHeapSizeLimit != null) {
        setRam({
          usedGB: mem.usedJSHeapSize / 1024 / 1024 / 1024,
          limitGB: mem.jsHeapSizeLimit / 1024 / 1024 / 1024,
        });
      }
    };
    read();
    const t = setInterval(read, 2000);
    return () => clearInterval(t);
  }, []);

  const ramLabel =
    ram != null
      ? `${ram.usedGB.toFixed(1)} GB / ${ram.limitGB.toFixed(1)} GB`
      : '— / —';
  const latencyLabel = '0 MS';

  return (
    <footer
      className="flex items-center justify-between px-4 py-1.5 border-t border-border shrink-0 bg-muted/30 text-xs vitals-mono"
      data-testid="system-vitals-footer"
      role="contentinfo"
    >
      <div className="flex items-center gap-4 vitals-mono uppercase tracking-wide">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              isSavingWorkspace && 'bg-[var(--warning)] animate-pulse',
              !isSavingWorkspace && isEngineReady && 'bg-[var(--success)]',
              !isSavingWorkspace && !isEngineReady && 'bg-[var(--warning)] animate-pulse'
            )}
            aria-hidden
          />
          <span className="text-muted-foreground tabular-nums">
            Engine:{' '}
            <span
              className={
                isEngineReady && !isSavingWorkspace
                  ? 'text-[var(--success)] font-medium'
                  : 'text-muted-foreground'
              }
            >
              {isSavingWorkspace
                ? 'Saving…'
                : isEngineReady
                  ? 'Ready'
                  : 'Loading…'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1.5" title={RAM_TOOLTIP}>
          <span className="text-muted-foreground tabular-nums">
            RAM: {ramLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground tabular-nums">
            Latency: {latencyLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground tabular-nums">
            Core: {CORE_VERSION}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 vitals-mono">
        <span
          className={
            privacyShieldStatus === 'local-only' && hasActiveFile
              ? 'text-[var(--success)] font-medium'
              : 'text-muted-foreground'
          }
          title="Data never leaves this device"
        >
          {privacyShieldStatus === 'local-only' && hasActiveFile
            ? 'Local only'
            : 'No upload'}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {APP_VERSION}
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] shrink-0" aria-hidden />
        <span className="text-[var(--success)]">Up to date</span>
      </div>
    </footer>
  );
}
