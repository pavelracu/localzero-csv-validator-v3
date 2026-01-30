import { Loader2 } from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { AppHeader } from '../layout/AppHeader';
import { SystemVitalsHeader } from './SystemVitalsHeader';
import { Sidebar } from './Sidebar';
import { StatusBar } from '../layout/StatusBar';
import type { AppStage } from '../../hooks/useDataStream';
import type { ColumnSchema } from '../../types';
import { cn } from '@/lib/utils';

export interface LayoutProps {
  isReady: boolean;
  stage: AppStage;
  rowCount: number;
  errorCount: number;
  /** Schema for Audit Log column labels (optional). */
  schema?: ColumnSchema[];
  /** True while workspace metadata is being persisted to IndexedDB after file load. */
  isSavingWorkspace?: boolean;
  /** True while putWorkspace is running; shows "Securing Local Workspace..." overlay. */
  isPersisting?: boolean;
  /** Header: validation and export */
  pendingValidationCount?: number;
  isValidating?: boolean;
  onRunValidation?: () => Promise<void>;
  onExport?: () => void;
  canExport?: boolean;
  children: React.ReactNode;
}

export function Layout({
  isReady,
  stage,
  rowCount,
  errorCount,
  schema,
  isSavingWorkspace = false,
  isPersisting = false,
  pendingValidationCount = 0,
  isValidating = false,
  onRunValidation,
  onExport,
  canExport = false,
  children,
}: LayoutProps) {
  const { hasActiveFile } = useWorkspace();
  const showStatusBar = (stage === 'INGESTION' && rowCount > 0) || stage === 'STUDIO';

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background">
      <AppHeader
        stage={stage}
        pendingValidationCount={pendingValidationCount}
        isValidating={isValidating}
        onRunValidation={onRunValidation ?? (async () => {})}
        onExport={onExport}
        canExport={canExport}
      />
      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar stage={stage} rowCount={rowCount} schema={schema} />
        <div
          className={cn(
            'flex-1 flex flex-col overflow-hidden min-w-0',
            hasActiveFile && 'privacy-border'
          )}
          data-privacy-active={hasActiveFile ? 'true' : undefined}
        >
          <main className="flex-1 overflow-hidden relative flex flex-col min-h-0">
            {children}
            {isPersisting && (
              <div
                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm pointer-events-auto"
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2
                  className="h-8 w-8 animate-spin text-[var(--success)] mb-3"
                  aria-hidden
                />
                <p className="text-sm font-medium text-foreground">
                  Securing Local Session...
                </p>
              </div>
            )}
          </main>
          
        </div>
      </div>
      <SystemVitalsHeader
        isEngineReady={isReady}
        isSavingWorkspace={isSavingWorkspace}
      />
    </div>
  );
}
