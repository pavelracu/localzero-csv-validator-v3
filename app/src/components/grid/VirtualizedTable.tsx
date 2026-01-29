import React, { useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ColumnSchema, ColumnType } from '../../types';
import { AlertTriangle, MoreHorizontal, Filter } from 'lucide-react';
import { IssuesPanel } from '../editor/IssuesPanel'; // Import the new panel
import { Button } from '../ui/button';

interface VirtualizedTableProps {
  rowCount: number;
  schema: ColumnSchema[];
  errors: Map<number, Record<string, string>>;
  fetchRows: (start: number, end: number) => string[][];
  onCorrection: (colIndex: number, type: 'clear' | 'remove_row') => void;
}

export function VirtualizedTable({ rowCount, schema, errors, fetchRows, onCorrection }: VirtualizedTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [showIssues, setShowIssues] = useState(true);

  // Virtualizer Setup
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32, // High density row height (32px)
    overscan: 20,
  });

  // Data Loading Logic (Simplified for brevity - assumes sync or cached for now)
  const items = rowVirtualizer.getVirtualItems();
  const loadedRows = fetchRows(items[0]?.index || 0, items[items.length - 1]?.index || 0);

  return (
    // FIX: 'absolute inset-0' forces this container to fill the relative parent in App.tsx
    <div className="absolute inset-0 flex h-full w-full bg-background group">
      
      {/* Grid Area */}
      <div 
        ref={parentRef} 
        className="flex-1 h-full overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div 
          className="relative w-full"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 grid bg-muted border-b shadow-sm"
               style={{ 
                 gridTemplateColumns: `50px ${schema.map(() => 'minmax(150px, 1fr)').join(' ')}`,
                 height: '32px'
               }}
          >
             <div className="flex items-center justify-center border-r px-2 font-mono text-xs text-muted-foreground bg-muted">
               #
             </div>
             {schema.map((col, i) => (
               <div key={i} className="flex items-center justify-between px-3 border-r text-xs font-semibold text-foreground bg-muted truncate group/header">
                 <span className="truncate">{col.name}</span>
                 <MoreHorizontal size={14} className="opacity-0 group-hover/header:opacity-50" />
               </div>
             ))}
          </div>

          {/* Data Rows */}
          <div
            className="absolute top-0 left-0 w-full grid"
            style={{
              transform: `translateY(${items[0]?.start || 0}px)`,
              gridTemplateColumns: `50px ${schema.map(() => 'minmax(150px, 1fr)').join(' ')}`,
            }}
          >
            {items.map((virtualRow) => {
              const rowIndex = virtualRow.index;
              const rowData = loadedRows[virtualRow.index - items[0].index];
              const rowErrors = errors.get(rowIndex);
              const hasError = !!rowErrors;

              return (
                <React.Fragment key={virtualRow.key}>
                   {/* Row Index */}
                   <div className={`
                      h-8 flex items-center justify-center border-r border-b font-mono text-[10px] text-muted-foreground
                      ${hasError ? 'bg-red-50 text-red-600 font-bold' : 'bg-background'}
                   `}>
                     {hasError ? <AlertTriangle size={12} /> : rowIndex + 1}
                   </div>

                   {/* Cells */}
                   {schema.map((_, colIndex) => {
                     const cellValue = rowData?.[colIndex] || '';
                     const cellError = rowErrors?.[colIndex];

                     return (
                       <div 
                         key={`${rowIndex}-${colIndex}`}
                         className={`
                           h-8 px-3 flex items-center border-r border-b text-xs truncate
                           ${cellError ? 'bg-red-50 inset-ring inset-ring-red-200' : 'bg-background'}
                         `}
                         title={cellError || cellValue}
                       >
                         {cellValue}
                       </div>
                     );
                   })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Issues Sidebar */}
      {showIssues && errors.size > 0 && (
        <IssuesPanel 
          errors={errors} 
          schema={schema} 
          onApplyFix={onCorrection}
          onClose={() => setShowIssues(false)} 
        />
      )}

      {/* Issues Trigger Button */}
      {!showIssues && errors.size > 0 && (
        <Button 
          onClick={() => setShowIssues(true)}
          className="absolute bottom-4 right-4 shadow-lg rounded-full h-10 w-10 p-0 z-30 bg-destructive text-white hover:bg-destructive/90"
        >
          <AlertTriangle size={20} />
        </Button>
      )}
    </div>
  );
}