import { Button } from "@/components/ui/button";
import { Loader2, Play, Download, LayoutGrid, ChevronRight } from "lucide-react";
import type { AppStage } from "@/hooks/useDataStream";
import { cn } from "@/lib/utils";

const STEPS: { stage: AppStage; label: string }[] = [
  { stage: 'SCHEMA', label: '01 SCHEMA' },
  { stage: 'INGESTION', label: '02 INGESTION' },
  { stage: 'PROCESSING', label: '03 TRIAGE' },
  { stage: 'STUDIO', label: '04 EXPORT' },
];

function getStepIndex(stage: AppStage): number {
  const i = STEPS.findIndex((s) => s.stage === stage);
  return i >= 0 ? i : 0;
}

interface AppHeaderProps {
  stage: AppStage;
  pendingValidationCount: number;
  isValidating: boolean;
  onRunValidation: () => Promise<void>;
  onExport?: () => void;
  canExport?: boolean;
}

export const AppHeader = ({
  stage,
  pendingValidationCount,
  isValidating,
  onRunValidation,
  onExport,
  canExport = false,
}: AppHeaderProps) => {
  const currentStep = getStepIndex(stage);

  return (
    <header className="flex items-center justify-between gap-4 px-4 py-2 border-b border-border shrink-0 bg-background min-h-0">
      <div className="flex items-center gap-4 shrink-0 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded flex items-center justify-center bg-[var(--success)] text-primary-foreground shrink-0">
            <LayoutGrid size={14} strokeWidth={2.5} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-base font-bold text-foreground font-mono tracking-tight">
              LocalZero
            </h1>
            <span className="text-sm text-muted-foreground font-sans font-normal hidden sm:inline">
              {stage === 'SCHEMA' && 'Schema'}
              {stage === 'INGESTION' && 'Ingestion'}
              {stage === 'PROCESSING' && 'Validating'}
              {stage === 'STUDIO' && 'Triage'}
            </span>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-1 text-xs font-mono" aria-label="Pipeline steps">
          {STEPS.map((s, i) => (
            <span key={s.stage} className="flex items-center gap-1 shrink-0">
              <span
                className={cn(
                  i === currentStep && 'text-[var(--success)] font-semibold',
                  i !== currentStep && 'text-muted-foreground'
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <ChevronRight size={12} className="text-muted-foreground/70 shrink-0" />
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {stage === "STUDIO" && pendingValidationCount > 0 && (
          <Button
            onClick={onRunValidation}
            disabled={isValidating}
            className="gap-2 bg-[var(--warning)] hover:opacity-90 text-white border-none h-8 px-3 text-xs font-mono"
          >
            {isValidating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Validate {pendingValidationCount}
          </Button>
        )}
        {stage === "STUDIO" && canExport && onExport && (
          <Button
            onClick={onExport}
            className="gap-2 bg-[var(--success)] hover:opacity-90 text-white border-none h-8 px-3 text-xs font-mono"
          >
            <Download size={14} />
            Export CSV
          </Button>
        )}
      </div>
    </header>
  );
};
