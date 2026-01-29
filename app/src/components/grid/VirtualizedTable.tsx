import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ColumnSchema, ColumnType, Suggestion, SuggestionReport } from '../../types';
import { AlertTriangle } from 'lucide-react';
import { FixPanel } from '../editor/FixPanel'; 
import { ColumnHeader } from './ColumnHeader';
import { Button } from '@/components/ui/button';

interface VirtualizedTableProps {
  rowCount: number;
  schema: ColumnSchema[];
  errors: Map<number, Set<number>>; 
  pendingValidation: Set<number>;
  // We strictly use the hook's getter
  getRow: (index: number) => string[] | undefined;
  fetchRows: (start: number, limit: number) => Promise<Record<number, string[]>>; 
  onTypeChange: (colIndex: number, newType: ColumnType) => void;
  getSuggestions: (colIdx: number) => Promise<SuggestionReport[]>;
  applySuggestion: (colIdx: number, suggestion: Suggestion) => Promise<void>;
  applyCorrection: (colIdx: number, strategy: 'clear' | 'revert') => Promise<void>;
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
  getSuggestions,
  applySuggestion,
  applyCorrection
}: VirtualizedTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Minimal state to toggle the sidebar
  const [fixingColumn, setFixingColumn] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'errors'>('all');

  // FORCE UPDATE: The hook's cache is a Ref, so it won't trigger re-renders automatically.
  // We use this to tell React "The data is ready, paint it."
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  // Calculate error rows - errors Map is: Map<colIndex, Set<rowIndex>>
  const errorRowIndices = useMemo(() => {
    const errorRows = new Set<number>();
    errors.forEach((rowIndices) => {
      rowIndices.forEach((rowIndex) => {
        errorRows.add(rowIndex);
      });
    });
    return errorRows;
  }, [errors]);

  const errorRowCount = errorRowIndices.size;
  const displayRowCount = filterMode === 'errors' ? errorRowCount : rowCount;
  
  // Create mapping for error-only mode
  const errorRowMap = useMemo(() => {
    if (filterMode === 'all') return null;
    const sorted = Array.from(errorRowIndices).sort((a, b) => a - b);
    const map = new Map<number, number>(); // display index -> actual row index
    sorted.forEach((actualIndex, displayIndex) => {
      map.set(displayIndex, actualIndex);
    });
    return map;
  }, [filterMode, errorRowIndices]);

  const rowVirtualizer = useVirtualizer({
    count: displayRowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Helper to get actual row index from display index
  const getActualRowIndex = useCallback((displayIndex: number): number => {
    if (filterMode === 'all') return displayIndex;
    return errorRowMap?.get(displayIndex) ?? displayIndex;
  }, [filterMode, errorRowMap]);

  // DATA LOADER
  useEffect(() => {
    if (virtualItems.length === 0) return;

    // 1. Calculate which chunks of data are missing from the current view
    const missingChunks = new Set<number>();
    
    for (const item of virtualItems) {
      const actualRowIndex = getActualRowIndex(item.index);
      if (!getRow(actualRowIndex)) {
        const chunkId = Math.floor(actualRowIndex / CHUNK_SIZE);
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
  }, [virtualItems, getRow, fetchRows, forceUpdate, getActualRowIndex]);

  return (
    <div className="absolute inset-0 flex h-full w-full bg-background group flex-col">
      {/* Filter Control */}
      <div className="px-4 py-2 border-b bg-background flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">View:</span>
          <div className="inline-flex rounded-md border border-input bg-background" role="group">
            <Button
              variant={filterMode === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-r-none border-r h-8 px-3 text-xs"
              onClick={() => {
                setFilterMode('all');
                rowVirtualizer.scrollToIndex(0);
              }}
            >
              All ({rowCount.toLocaleString()})
            </Button>
            <Button
              variant={filterMode === 'errors' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-l-none h-8 px-3 text-xs"
              onClick={() => {
                setFilterMode('errors');
                rowVirtualizer.scrollToIndex(0);
              }}
            >
              Errors ({errorRowCount.toLocaleString()})
            </Button>
          </div>
        </div>
      </div>
      
      {/* Grid Container */}
      <div 
        ref={parentRef} 
        className="flex-1 h-full overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div
          className="relative"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            minWidth: `${50 + schema.length * 150}px`,
          }}
        >
          {/* Header — fixed width per column so header and body align when scrolling */}
          <div
            className="sticky top-0 z-20 flex bg-background border-b shadow-sm min-h-[56px]"
            style={{ minWidth: `${50 + schema.length * 150}px` }}
          >
             <div className="w-[50px] flex-shrink-0 flex items-center justify-center border-r border-border px-2 font-mono text-xs text-muted-foreground bg-muted/50 min-h-[56px]">
               #
             </div>
             {schema.map((col, i) => (
               <div key={i} className="w-[150px] min-w-[150px] flex-shrink-0 border-r border-border min-h-[56px]">
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
            className="absolute top-0 left-0"
            style={{
              transform: `translateY(${virtualItems[0]?.start || 0}px)`,
              minWidth: `${50 + schema.length * 150}px`,
            }}
          >
            {virtualItems.map((virtualRow) => {
              const displayIndex = virtualRow.index;
              const rowIndex = getActualRowIndex(displayIndex);
              const rowData = getRow(rowIndex);
              // errors Map is Map<colIndex, Set<rowIndex>> — check per cell
              const rowHasAnyError = schema.some((_, colIndex) => errors.get(colIndex)?.has(rowIndex));

              return (
                <div 
                  key={virtualRow.key} 
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="flex border-b border-border hover:bg-muted/50 h-[35px]"
                  style={{ minWidth: `${50 + schema.length * 150}px` }}
                >
                   {/* Row Number — only show icon when row has error, no full-row highlight */}
                   <div className="w-[50px] flex-shrink-0 flex items-center justify-center border-r font-mono text-[10px] text-muted-foreground bg-background">
                     {rowHasAnyError ? <AlertTriangle size={12} className="text-amber-500" /> : rowIndex + 1}
                   </div>

                   {/* Cells — highlight only the cell that has an error */}
                   {schema.map((_, colIndex) => {
                     const cellValue = rowData?.[colIndex];
                     const isCellError = errors.get(colIndex)?.has(rowIndex) ?? false;

                     return (
                       <div 
                         key={colIndex}
                         className={`
                           w-[150px] min-w-[150px] flex-shrink-0 px-3 flex items-center border-r border-border text-xs truncate
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

      {/* Fix Panel (Conditional Render) */}
      {fixingColumn !== null && schema[fixingColumn] && (
        <FixPanel
          column={{ name: schema[fixingColumn].name, type: schema[fixingColumn].detected_type }}
          errorCount={errors.get(fixingColumn)?.size || 0}
          onCorrection={(strategy) => {
            applyCorrection(fixingColumn, strategy).then(() => {
              // Force re-render after correction
              forceUpdate();
            });
          }}
          onGetSuggestions={() => getSuggestions(fixingColumn)}
          onApplySuggestion={(suggestion) => {
            applySuggestion(fixingColumn, suggestion).then(() => {
              // Force re-render after suggestion applied
              forceUpdate();
            });
          }}
          onClose={() => setFixingColumn(null)}
          open={fixingColumn !== null}
        />
      )}
    </div>
  );
}