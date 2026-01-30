import { Button } from "@/components/ui/button";
import { Loader2, Play, Download, LayoutGrid } from "lucide-react";
import { ComplianceStepper } from "@/components/workspace/ComplianceStepper";
import type { AppStage } from "@/hooks/useDataStream";

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
  return (
    <header className="flex items-center justify-between gap-4 px-4 py-2 border-b border-border shrink-0 bg-background min-h-0">
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded flex items-center justify-center bg-[var(--success)] text-primary-foreground shrink-0">
          <LayoutGrid size={14} strokeWidth={2.5} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <h1 className="text-base font-bold text-foreground font-mono tracking-tight">
            LocalZero
          </h1>
          <span className="text-sm text-muted-foreground font-sans font-normal">
            {stage === 'IMPORT' && 'Import'}
            {stage === 'SCHEMA' && 'Schema'}
            {stage === 'PROCESSING' && 'Validating'}
            {stage === 'STUDIO' && 'Triage'}
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex justify-center">
        {stage !== "IMPORT" && (
          <ComplianceStepper currentStage={stage} />
        )}
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
