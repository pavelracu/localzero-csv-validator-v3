import React, { useState, useEffect } from 'react';
import { ColumnSchema, Suggestion, SuggestionReport } from '../../types';
import { Eraser, RotateCcw, AlertTriangle, Wand2, ArrowRight, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface FixSidebarProps {
    selectedColumn: { index: number, schema: ColumnSchema, errorCount: number } | null;
    onCorrection: (colIndex: number, strategy: 'clear' | 'revert') => void;
    onGetSuggestions: (colIndex: number) => Promise<SuggestionReport[]>;
    onApplySuggestion: (colIndex: number, suggestion: Suggestion) => void;
    onClose: () => void;
}

const SuggestionCard: React.FC<{ report: SuggestionReport; onApply: (suggestion: Suggestion) => void; }> = ({ report, onApply }) => {
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
                     <Button size="sm" onClick={() => onApply(report.suggestion)}>Apply</Button>
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


export const FixSidebar: React.FC<FixSidebarProps> = ({
    selectedColumn,
    onCorrection,
    onGetSuggestions,
    onApplySuggestion,
    onClose
}) => {
    const [suggestions, setSuggestions] = useState<SuggestionReport[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (selectedColumn) {
            setIsLoading(true);
            onGetSuggestions(selectedColumn.index)
                .then(setSuggestions)
                .finally(() => setIsLoading(false));
        } else {
            setSuggestions([]);
        }
    }, [selectedColumn, onGetSuggestions]);

    if (!selectedColumn) {
        return (
            <div className="p-6 h-full flex flex-col items-center justify-center text-center bg-muted/30">
                <div className="p-3 rounded-full bg-primary/10 mb-4">
                    <AlertTriangle size={28} className="text-primary/80" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Validation Errors</h3>
                <p className="text-sm text-muted-foreground mt-1">Select a column with errors to see automatic suggestions and manual fixes.</p>
            </div>
        );
    }
    
    const { index: colIndex, schema: colSchema, errorCount } = selectedColumn;

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                        <AlertTriangle size={20} className="text-destructive"/>
                        Resolve Errors
                    </h3>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                        <X size={16} />
                    </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                    Found <strong className="text-foreground">{errorCount}</strong> errors in <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground text-xs">{colSchema.name}</span>
                </p>
            </div>
            
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                <div className="space-y-3">
                    {isLoading && (
                        <>
                            <div className="h-[90px] w-full bg-muted/60 animate-pulse rounded-lg" />
                            <div className="h-[90px] w-full bg-muted/60 animate-pulse rounded-lg" />
                        </>
                    )}
                    {!isLoading && suggestions.length > 0 && (
                        suggestions.map((report, i) => (
                            <SuggestionCard key={i} report={report} onApply={(suggestion) => onApplySuggestion(colIndex, suggestion)} />
                        ))
                    )}
                     {!isLoading && suggestions.length === 0 && (
                        <div className="text-center text-sm text-muted-foreground py-8">
                            No automatic suggestions available for this column.
                        </div>
                    )}
                </div>
                
                <div className="relative py-2">
                    <Separator />
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="mx-auto bg-background px-2 text-xs text-muted-foreground">OR MANUAL FIXES</div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div
                        className="flex items-center gap-4 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => onCorrection(colIndex, 'clear')}
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
                        onClick={() => onCorrection(colIndex, 'revert')}
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
        </div>
    );
};
