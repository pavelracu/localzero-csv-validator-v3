import { Check, Network, Shield } from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { AppStage } from '../../hooks/useDataStream';
import type { ColumnSchema } from '../../types';

interface SidebarProps {
  stage: AppStage;
  rowCount: number;
  schema?: ColumnSchema[];
}

const PIPELINE_STEPS = [
  { key: 'schema', label: '01 SCHEMA', sublabel: () => 'Select standard' },
  { key: 'ingestion', label: '02 INGESTION', sublabel: (ctx: { fileSizeGB?: string; schemaLength?: number; rowCount?: number }) => ctx.rowCount != null && ctx.rowCount > 0 ? `${ctx.schemaLength ?? 0} cols / ${ctx.rowCount.toLocaleString()} rows` : ctx.fileSizeGB ? `${ctx.fileSizeGB} Buffered` : 'Load file' },
  { key: 'triage', label: '03 TRIAGE', sublabel: () => 'Validate & fix' },
  { key: 'export', label: '04 EXPORT', sublabel: () => 'Export CSV' },
] as const;

function stageToActiveIndex(stage: AppStage): number {
  switch (stage) {
    case 'SCHEMA':
      return 0;
    case 'INGESTION':
      return 1;
    case 'PROCESSING':
      return 2;
    case 'STUDIO':
      return 3;
    default:
      return 0;
  }
}

export function Sidebar({ stage, rowCount, schema }: SidebarProps) {
  const { fileMetadata } = useWorkspace();
  const activeIndex = stageToActiveIndex(stage);
  const schemaLength = schema?.length ?? 0;

  const fileSizeGB = fileMetadata?.size != null
    ? (fileMetadata.size / 1024 / 1024 / 1024).toFixed(2)
    : undefined;

  return (
    <aside
      className="w-72 border-r border-border shrink-0 flex flex-col bg-background text-foreground"
      data-testid="workspace-sidebar"
    >
      <ScrollArea className="flex-1 min-h-0 [&>[data-radix-scroll-area-viewport]]:bg-transparent">
        <div className="p-3 bg-transparent">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wide text-foreground mb-3">
            Compliance Pipeline
          </h2>
          <div className="space-y-1">
            {PIPELINE_STEPS.map((step, index) => {
              const isCompleted = index < activeIndex;
              const isActive = index === activeIndex;
              const ctx = { fileSizeGB, schemaLength, rowCount };
              const sublabel = step.sublabel(ctx);

              return (
                <div
                  key={step.key}
                  className={cn(
                    'rounded-md border px-2 py-2 transition-colors border-border',
                    isActive && 'bg-accent border-primary text-accent-foreground',
                    isCompleted && 'bg-muted/50 text-foreground',
                    !isActive && !isCompleted && 'text-muted-foreground'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="shrink-0">
                      {isCompleted ? (
                        <Check size={14} className="text-[var(--success)]" />
                      ) : index === 1 ? (
                        <Network size={14} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
                      ) : index === 2 || index === 3 ? (
                        <Shield size={14} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/50 opacity-70" />
                      )}
                    </span>
                    <span className="text-xs font-mono font-medium">
                      {step.label}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'text-[10px] font-mono mt-1 ml-5',
                      isActive ? 'text-accent-foreground/90' : 'text-muted-foreground'
                    )}
                  >
                    {sublabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
