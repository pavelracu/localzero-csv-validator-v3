import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ColumnSchema, ColumnType } from '../../types';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { IssuesPanel } from '../editor/IssuesPanel'; 
import { ColumnHeader } from './ColumnHeader'; // Re-using your header component

interface VirtualizedTableProps {
  rowCount: number;
  schema: ColumnSchema[];
  errors: Map<number, Set<number>>; 
  pendingValidation: Set<number>;
  // We strictly use the hook's getter
  getRow: (index: number) => string[] | undefined;
  fetchRows: (start: number, limit: number) => Promise<Record<number, string[]>>; 
  onTypeChange: (colIndex: number, newType: ColumnType) => void;
  onSelectFix: (colIndex: number) => void;
}

const CHUNK_SIZE = 50;

export function VirtualizedTable({ 
  rowCount, 
  schema, 
  errors, 
  pendingValidation, 
  getRow, 
  fetchRows, 
  onTypeChange, 
  onSelectFix 
}: VirtualizedTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Minimal state to toggle the sidebar
  const [fixingColumn, setFixingColumn] = useState<number | null>(null);

  // FORCE UPDATE: The hook's cache is a Ref, so it won't trigger re-renders automatically.
  // We use this to tell React "The data is ready, paint it."
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // DATA LOADER
  useEffect(() => {
    if (virtualItems.length === 0) return;

    // 1. Calculate which chunks of data are missing from the current view
    const missingChunks = new Set<number>();
    
    for (const item of virtualItems) {
      if (!getRow(item.index)) {
        const chunkId = Math.floor(item.index / CHUNK_SIZE);
        missingChunks.add(chunkId);
      }
    }

    if (missingChunks.size === 0) return;

    // 2. Fetch missing chunks
    // We don't need to track "inflight" here because useDataStream does it for us.
    missingChunks.forEach(chunkId => {
      const start = chunkId * CHUNK_SIZE;
      
      fetchRows(start, CHUNK_SIZE)
        .then(() => {
          // Data is now in the Hook's Ref. Trigger a paint.
          forceUpdate();
        })
        .catch(console.error);
    });
  }, [virtualItems, getRow, fetchRows, forceUpdate]);

  return (
    <div className="absolute inset-0 flex h-full w-full bg-background group">
      
      {/* Grid Container */}
      <div 
        ref={parentRef} 
        className="flex-1 h-full overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div 
          className="relative w-full"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {/* Header */}
          <div className="sticky top-0 z-20 flex bg-background border-b shadow-sm"
               style={{ minWidth: '100%' }}
          >
             <div className="w-[50px] flex-shrink-0 flex items-center justify-center border-r px-2 font-mono text-xs text-muted-foreground bg-muted/50 h-[35px]">
               #
             </div>
             {schema.map((col, i) => (
               <div key={i} className="flex-1 min-w-[150px] border-r h-[35px]">
                 <ColumnHeader 
                    name={col.name}
                    type={col.detected_type}
                    isPending={pendingValidation.has(i)}
                    errorCount={errors.get(i)?.size || 0}
                    onTypeChange={(t) => onTypeChange(i, t)}
                    onSelectFix={() => setFixingColumn(i)}
                 />
               </div>
             ))}
          </div>

          {/* Body */}
          <div
            className="absolute top-0 left-0 w-full"
            style={{
              transform: `translateY(${virtualItems[0]?.start || 0}px)`,
            }}
          >
            {virtualItems.map((virtualRow) => {
              const rowIndex = virtualRow.index;
              const rowData = getRow(rowIndex);
              const rowErrors = errors.get(rowIndex);
              const hasError = rowErrors && rowErrors.size > 0;

              return (
                <div 
                  key={virtualRow.key} 
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className={`flex w-full border-b border-border hover:bg-muted/50 h-[35px]`}
                >
                   {/* Row Number */}
                   <div className={`
                      w-[50px] flex-shrink-0 flex items-center justify-center border-r font-mono text-[10px] text-muted-foreground
                      ${hasError ? 'bg-red-50 text-red-600 font-bold' : 'bg-background'}
                   `}>
                     {hasError ? <AlertTriangle size={12} /> : rowIndex + 1}
                   </div>

                   {/* Cells */}
                   {schema.map((_, colIndex) => {
                     const cellValue = rowData?.[colIndex];
                     const isCellError = rowErrors?.has(colIndex);

                     return (
                       <div 
                         key={colIndex}
                         className={`
                           flex-1 min-w-[150px] px-3 flex items-center border-r text-xs truncate
                           ${isCellError ? 'bg-red-50 ring-1 ring-inset ring-red-200 text-red-700' : ''}
                         `}
                         title={isCellError ? "Validation Error" : cellValue}
                       >
                         {cellValue !== undefined ? cellValue : (
                           <div className="h-2 w-16 bg-muted/20 rounded animate-pulse" />
                         )}
                       </div>
                     );
                   })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Issues Sidebar (Conditional Render) */}
      {fixingColumn !== null && (
        <div className="w-[400px] border-l border-border flex-shrink-0 bg-background z-30 shadow-xl">
            {/* NOTE: You need to pass the correct props to FixSidebar here.
                We'll wire this up fully in the next step (Logic Phase).
                For now, we just close it.
            */}
            <IssuesPanel 
               errors={errors}
               schema={schema}
               onApplyFix={(colIdx, type) => console.log('Fix', colIdx, type)}
               onClose={() => setFixingColumn(null)}
            />
        </div>
      )}
    </div>
  );
}