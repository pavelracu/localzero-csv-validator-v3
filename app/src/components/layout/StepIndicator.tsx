import { AppStage } from '../../hooks/useDataStream';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  currentStage: AppStage;
}

const STAGES: { stage: AppStage; label: string; shortLabel: string }[] = [
  { stage: 'IMPORT', label: 'Import', shortLabel: 'Upload' },
  { stage: 'SCHEMA', label: 'Schema', shortLabel: 'Schema' },
  { stage: 'PROCESSING', label: 'Processing', shortLabel: 'Validating' },
  { stage: 'STUDIO', label: 'Studio', shortLabel: 'Review & fix' },
];

export function StepIndicator({ currentStage }: StepIndicatorProps) {
  const currentIndex = STAGES.findIndex(s => s.stage === currentStage);
  
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
      {STAGES.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isUpcoming = index > currentIndex;
        
        return (
          <div key={step.stage} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-1">
              {/* Step Circle */}
              <div
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium shrink-0",
                  isCompleted && "bg-emerald-500 text-white",
                  isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2",
                  isUpcoming && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <Check size={12} /> : index + 1}
              </div>
              
              {/* Step Label */}
              <div className="flex flex-col min-w-0">
                <span
                  className={cn(
                    "text-xs font-medium truncate",
                    isCurrent && "text-foreground",
                    !isCurrent && "text-muted-foreground"
                  )}
                >
                  {step.shortLabel}
                </span>
              </div>
            </div>
            
            {/* Connector Line */}
            {index < STAGES.length - 1 && (
              <div
                className={cn(
                  "h-0.5 mx-2 flex-1",
                  isCompleted ? "bg-emerald-500" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
