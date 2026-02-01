import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppStage } from '../../hooks/useDataStream';

const STEPS = [
  { key: 'INGEST', label: 'Ingest', shortLabel: 'Ingest' },
  { key: 'SELECT_STANDARD', label: 'Select Standard', shortLabel: 'Standard' },
  { key: 'TRIAGE', label: 'Triage', shortLabel: 'Triage' },
  { key: 'EXPORT', label: 'Export', shortLabel: 'Export' },
] as const;

function stageToStepIndex(stage: AppStage): number {
  switch (stage) {
    case 'INGESTION':
      return 0;
    case 'SCHEMA':
      return 1;
    case 'PROCESSING':
    case 'STUDIO':
      return 2;
    default:
      return 0;
  }
}

interface ComplianceStepperProps {
  currentStage: AppStage;
}

export function ComplianceStepper({ currentStage }: ComplianceStepperProps) {
  const currentIndex = stageToStepIndex(currentStage);

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30"
      data-testid="compliance-stepper"
    >
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isUpcoming = index > currentIndex;

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium shrink-0 transition-shadow',
                  isCompleted && 'bg-[var(--success)] text-white',
                  isCurrent &&
                    'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 shadow-[0_0_0_2px_var(--primary)]',
                  isUpcoming && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? <ShieldCheck size={12} /> : index + 1}
              </div>
              <div className="flex flex-col min-w-0">
                <span
                  className={cn(
                    'text-xs font-medium truncate',
                    isCurrent && 'text-foreground',
                    !isCurrent && 'text-muted-foreground'
                  )}
                >
                  {step.shortLabel}
                </span>
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-0.5 mx-2 flex-1',
                  isCompleted ? 'bg-[var(--success)]' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
