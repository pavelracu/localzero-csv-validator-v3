import React from 'react';
import { ColumnType } from '../../types';
import { Eraser, RotateCcw, AlertTriangle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface FixPanelProps {
    column: { name: string, type: ColumnType };
    errorCount: number;
    onFix: (strategy: 'clear' | 'revert') => void;
    onClose: () => void;
    open: boolean;
}

export const FixPanel: React.FC<FixPanelProps> = ({ column, errorCount, onFix, onClose, open }) => {
    return (
        <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
            <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle size={20} />
                        The Mechanic
                    </SheetTitle>
                    <SheetDescription>
                        Found <strong className="text-foreground">{errorCount}</strong> errors in column <span className="font-mono bg-muted px-1 rounded text-foreground">{column.name}</span>
                    </SheetDescription>
                </SheetHeader>
                
                <div className="mt-8 space-y-4">
                     <Button 
                        variant="destructive" 
                        className="w-full justify-start gap-4 h-auto p-4"
                        onClick={() => onFix('clear')}
                     >
                         <div className="bg-white/20 p-2 rounded text-white">
                            <Eraser size={20} />
                         </div>
                         <div className="text-left">
                             <div className="font-semibold text-foreground">Clear Invalid</div>
                             <div className="text-xs text-muted-foreground">Set invalid cells to empty string</div>
                         </div>
                     </Button>

                     <Button 
                        variant="outline" 
                        className="w-full justify-start gap-4 h-auto p-4"
                        onClick={() => onFix('revert')}
                     >
                         <div className="bg-muted p-2 rounded text-foreground">
                            <RotateCcw size={20} />
                         </div>
                         <div className="text-left">
                             <div className="font-semibold text-foreground">Reset to Original</div>
                             <div className="text-xs text-muted-foreground">Revert changes to this column</div>
                         </div>
                     </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
};
