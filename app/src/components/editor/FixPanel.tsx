import React, { useState, useEffect } from 'react';
import { ColumnType, Suggestion, SuggestionReport } from '../../types';
import { Eraser, RotateCcw, AlertTriangle, Wand2, ArrowRight, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface FixPanelProps {
    column: { name: string, type: ColumnType };
    errorCount: number;
    onCorrection: (strategy: 'clear' | 'revert') => void;
    onGetSuggestions: () => Promise<SuggestionReport[]>;
    onApplySuggestion: (suggestion: Suggestion) => Promise<void>;
    onClose: () => void;
    open: boolean;
}

const SuggestionCard: React.FC<{
    report: SuggestionReport;
    onApply: (suggestion: Suggestion) => Promise<void>;
    isApplying: boolean;
}> = ({ report, onApply, isApplying }) => {
    return (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-4">
                <div className="flex items-start gap-4">
                    <div className="p-2 rounded-md bg-primary/10 text-primary">
                        <Wand2 size={20} />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-foreground">{report.description}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                            Applies to {report.affected_rows_count} cells.
                        </div>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => onApply(report.suggestion)}
                        disabled={isApplying}
                    >
                        {isApplying ? (
                            <>
                                <Loader2 size={14} className="animate-spin mr-1.5" />
                                Applying…
                            </>
                        ) : (
                            'Apply'
                        )}
                    </Button>
                </div>

                 <div className="mt-3 text-xs font-mono bg-muted/80 p-2 rounded-md flex items-center justify-center gap-2">
                    <span className="truncate text-red-500" title={report.example_before}>"{report.example_before}"</span>
                    <ArrowRight size={14} className="text-muted-foreground flex-shrink-0" />
                    <span className="truncate text-emerald-500" title={report.example_after}>"{report.example_after}"</span>
                </div>
            </div>
        </div>
    );
};


export const FixPanel: React.FC<FixPanelProps> = ({ 
    column, 
    errorCount, 
    onCorrection, 
    onGetSuggestions,
    onApplySuggestion,
    onClose, 
    open 
}) => {
    const [suggestions, setSuggestions] = useState<SuggestionReport[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isApplying, setIsApplying] = useState(false);

    useEffect(() => {
        if (open) {
            setIsLoading(true);
            onGetSuggestions()
                .then(setSuggestions)
                .finally(() => setIsLoading(false));
        } else {
            setSuggestions([]);
            setIsApplying(false);
        }
    }, [open, onGetSuggestions]);

    const handleApply = async (suggestion: Suggestion) => {
        setIsApplying(true);
        try {
            await new Promise((r) => setTimeout(r, 0));
            await onApplySuggestion(suggestion);
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
            <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <AlertTriangle size={20} className="text-destructive"/>
                        Fix errors — {column.name}
                    </SheetTitle>
                    <SheetDescription>
                        Fixes for <strong className="text-foreground">{column.type}</strong>. Found <strong className="text-foreground">{errorCount}</strong> errors in this column.
                    </SheetDescription>
                </SheetHeader>
                
                <div className="mt-6 space-y-4">
                    {/* Suggested Fixes First */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-foreground">Suggested Fixes</h3>
                        {isLoading && (
                            <>
                                <p className="text-sm text-muted-foreground">Analyzing column…</p>
                                <div className="h-[90px] w-full bg-muted/60 animate-pulse rounded-lg" />
                                <div className="h-[90px] w-full bg-muted/60 animate-pulse rounded-lg" />
                            </>
                        )}
                        {!isLoading && suggestions.length > 0 && (
                            suggestions.map((report, i) => (
                                <SuggestionCard
                                    key={i}
                                    report={report}
                                    onApply={handleApply}
                                    isApplying={isApplying}
                                />
                            ))
                        )}
                         {!isLoading && suggestions.length === 0 && (
                            <div className="text-center text-sm text-muted-foreground py-8">
                                No automatic suggestions available for this column.
                            </div>
                        )}
                    </div>
                    
                    <div className="relative">
                        <Separator />
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="mx-auto bg-background px-2 text-xs text-muted-foreground">Manual Actions</div>
                        </div>
                    </div>

                    <div className={`space-y-3 pt-2 ${isApplying ? 'pointer-events-none opacity-60' : ''}`}>
                        <div
                            className="flex items-center gap-4 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => !isApplying && onCorrection('clear')}
                        >
                            <div className="p-2 rounded-md bg-amber-100 text-amber-800">
                                <Eraser size={18} />
                            </div>
                            <div className="text-left">
                                <div className="font-semibold text-foreground text-sm">Clear Invalid Cells</div>
                                <div className="text-xs text-muted-foreground">Set all invalid cells to an empty value.</div>
                            </div>
                        </div>

                        <div
                            className="flex items-center gap-4 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => !isApplying && onCorrection('revert')}
                        >
                            <div className="p-2 rounded-md bg-gray-100 text-gray-600">
                                <RotateCcw size={18} />
                            </div>
                            <div className="text-left">
                                <div className="font-semibold text-foreground text-sm">Reset Column</div>
                                <div className="text-xs text-muted-foreground">Revert all changes in this column to their original values.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
};
