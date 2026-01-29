import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";

interface AppHeaderProps {
  isReady: boolean;
  stage: string;
  pendingValidationCount: number;
  isValidating: boolean;
  onRunValidation: () => Promise<void>;
  onSavePreset: () => void;           // Added
  onLoadPreset: (preset: any) => void; // Added
  presets: any[];                     // Added
}

export const AppHeader = ({ 
    isReady, 
    stage,
    pendingValidationCount,
    isValidating,
    onRunValidation
}: AppHeaderProps) => {
    return (
        <header className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground tracking-tight">LocalZero Schema Engine</h1>
                <Badge variant={isReady ? "secondary" : "warning"} className="tracking-wide">
                    {stage === 'IMPORT' ? 'READY' : stage}
                </Badge>
            </div>
            
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
        </header>
    );
};
