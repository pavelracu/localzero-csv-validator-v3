import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, X, ArrowRight, Wand2, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ColumnSchema } from '../../types';

interface IssuesPanelProps {
  errors: Map<number, Record<string, string>>; // rowIndex -> { colId: errorMsg }
  schema: ColumnSchema[];
  onApplyFix: (colIndex: number, type: 'clear' | 'remove_row') => void;
  onClose: () => void;
}

export function IssuesPanel({ errors, schema, onApplyFix, onClose }: IssuesPanelProps) {
  
  // 1. Aggregate Errors by Column
  const aggregations = useMemo(() => {
    const cols = new Map<number, { name: string, count: number, examples: Set<string> }>();
    
    errors.forEach((rowErrors) => {
      Object.entries(rowErrors).forEach(([colId, msg]) => {
        const colIdx = parseInt(colId);
        if (!cols.has(colIdx)) {
          cols.set(colIdx, { 
            name: schema[colIdx]?.name || 'Unknown', 
            count: 0, 
            examples: new Set() 
          });
        }
        const data = cols.get(colIdx)!;
        data.count++;
        if (data.examples.size < 3) data.examples.add(msg);
      });
    });
    
    return Array.from(cols.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [errors, schema]);

  return (
    <div className="h-full w-80 border-l bg-background flex flex-col shadow-xl z-20">
      {/* Header */}
      <div className="h-12 border-b flex items-center justify-between px-4 bg-muted/10">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <AlertTriangle size={16} className="text-amber-500" />
          <span>{errors.size} Rows with Issues</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {aggregations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-3 opacity-50" />
              <p>No errors found!</p>
              <p className="text-xs mt-1">Your data is ready for export.</p>
            </div>
          ) : (
            aggregations.map(([colIdx, data]) => (
              <div key={colIdx} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] bg-muted">
                      {data.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{data.count} issues</span>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-md border p-3 space-y-3">
                  <div className="space-y-1">
                    {Array.from(data.examples).map((ex, i) => (
                       <div key={i} className="text-xs text-destructive flex items-start gap-1.5">
                         <span className="mt-0.5">•</span>
                         <span className="break-all opacity-90">{ex}</span>
                       </div>
                    ))}
                  </div>
                  
                  <Separator />

                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-xs justify-start gap-1.5"
                      onClick={() => onApplyFix(colIdx, 'clear')}
                    >
                      <Wand2 size={12} /> Clear Cells
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs justify-start gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onApplyFix(colIdx, 'remove_row')}
                    >
                      <Trash2 size={12} /> Delete Rows
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}