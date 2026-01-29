import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Play, ShieldCheck, Download } from "lucide-react";

interface AppHeaderProps {
  isReady: boolean;
  stage: string;
  pendingValidationCount: number;
  isValidating: boolean;
  onRunValidation: () => Promise<void>;
  onExport?: () => void;
  canExport?: boolean;
}

export const AppHeader = ({ 
    isReady, 
    stage,
    pendingValidationCount,
    isValidating,
    onRunValidation,
    onExport,
    canExport = false
}: AppHeaderProps) => {
    return (
        <header className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground tracking-tight">LocalZero Schema Engine</h1>
                <Badge variant="outline" className="gap-1.5 text-xs font-normal">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    <span className="text-emerald-600">Data stays local</span>
                </Badge>
                <Badge variant={isReady ? "secondary" : "warning"} className="tracking-wide">
                    {stage === 'IMPORT' ? 'READY' : stage}
                </Badge>
            </div>
            
            <div className="flex items-center gap-2">
                {stage === 'STUDIO' && pendingValidationCount > 0 && (
                    <Button
                        onClick={onRunValidation}
                        disabled={isValidating}
                        className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-none h-8 px-3"
                    >
                        {isValidating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                        Validate {pendingValidationCount} Changes
                    </Button>
                )}
                {stage === 'STUDIO' && canExport && onExport && (
                    <Button
                        onClick={onExport}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-none h-8 px-3"
                    >
                        <Download size={16} />
                        Export CSV
                    </Button>
                )}
            </div>
        </header>
    );
};
