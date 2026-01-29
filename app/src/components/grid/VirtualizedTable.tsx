import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ColumnSchema, ColumnType, Suggestion, SuggestionReport } from '../../types';
import { ColumnHeader } from './ColumnHeader';

interface VirtualizedTableProps {
  rowCount: number;
  schema: ColumnSchema[];
  errors: Map<number, Set<number>>;
  pendingValidation: Set<number>;
  fetchRows: (start: number, limit: number) => Promise<Record<number, string[]>>;
  onTypeChange: (colIndex: number, newType: ColumnType) => void;
  onCorrection: (colIndex: number, strategy: string) => void;
  onGetSuggestions: (colIndex: number) => Promise<SuggestionReport[]>;
  onApplySuggestion: (colIndex: number, suggestion: Suggestion) => void;
  getRow: (index: number) => string[] | undefined;
}

const CHUNK_SIZE = 50;

export const VirtualizedTable: React.FC<VirtualizedTableProps> = ({
  rowCount,
  schema,
  errors,
  pendingValidation,
  fetchRows,
  onTypeChange,
  onCorrection,
  onGetSuggestions,
  onApplySuggestion,
  getRow,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  // Force update trigger
  const [, setTick] = useState(0);
  const requestedChunks = useRef<Set<number>>(new Set());

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (rowCount === 0) return;
    
    // Determine missing chunks
    const neededChunks = new Set<number>();
    
    virtualItems.forEach(item => {
        if (!getRow(item.index)) {
            const chunkId = Math.floor(item.index / CHUNK_SIZE);
            if (!requestedChunks.current.has(chunkId)) {
                neededChunks.add(chunkId);
            }
        }
    });

    if (neededChunks.size > 0) {
        // Mark as requested immediately
        neededChunks.forEach(c => requestedChunks.current.add(c));
        
        const chunks = Array.from(neededChunks).sort((a, b) => a - b);
        
        // Fetch contiguous ranges to be polite to the worker
        // Simple approach: just fetch min to max (might over-fetch slightly but efficient)
        const minChunk = chunks[0];
        const maxChunk = chunks[chunks.length - 1];
        
        const fetchStart = minChunk * CHUNK_SIZE;
        const fetchLimit = (maxChunk - minChunk + 1) * CHUNK_SIZE;

        // console.log(`Fetching range ${fetchStart} - ${fetchStart + fetchLimit}`);

        fetchRows(fetchStart, fetchLimit)
            .then(() => {
                // Data is in the ref cache now. Trigger render.
                setTick(t => t + 1);
            })
            .catch(err => {
                console.error("Fetch failed", err);
                // Clear requested flags on error so we try again? 
                // Or keep them to avoid death loop. keeping them is safer.
            });
    }
  }, [virtualItems, rowCount, fetchRows, getRow]);

  const columnHelper = createColumnHelper<string[]>();

  const columns = useMemo(() => {
    return schema.map((col, index) => 
      columnHelper.accessor(row => row ? row[index] : '', {
        id: index.toString(),
        header: () => (
          <ColumnHeader
            name={col.name}
            type={col.detected_type}
            isPending={pendingValidation.has(index)}
            errorCount={errors.get(index)?.size || 0}
            onTypeChange={(newType) => onTypeChange(index, newType)}
            onCorrection={(strategy) => onCorrection(index, strategy)}
            onGetSuggestions={() => onGetSuggestions(index)}
            onApplySuggestion={(suggestion) => onApplySuggestion(index, suggestion)}
          />
        ),
        cell: (info) => info.getValue(),
      })
    );
  }, [schema, onTypeChange, pendingValidation, errors, onCorrection, onGetSuggestions, onApplySuggestion]);

  const table = useReactTable({
    data: [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div 
        ref={parentRef} 
        className="overflow-auto border border-gray-200 rounded-lg h-[600px] w-full relative bg-white"
    >
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-white sticky top-0 z-20 shadow-sm">
                    {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id} className="flex w-full">
                            {headerGroup.headers.map(header => (
                                                                <th
                                                                    key={header.id}
                                                                    className="px-4 text-left align-middle font-medium text-muted-foreground bg-white border-b border-border flex-1 min-w-[150px]"
                                                                    style={{ width: header.getSize() }}
                                                                >                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody 
                    style={{
                        transform: `translateY(${virtualItems[0]?.start ?? 0}px)`, 
                        position: 'absolute', 
                        top: 0, 
                        left: 0,
                        width: '100%'
                    }}
                >
                    {virtualItems.map(virtualRow => {
                        const rowIndex = virtualRow.index;
                        const rowData = getRow(rowIndex);
                        
                        return (
                            <tr 
                                key={virtualRow.key} 
                                data-index={virtualRow.index} 
                                ref={rowVirtualizer.measureElement}
                                className="flex w-full border-b border-border transition-colors hover:bg-muted/50"
                                style={{ height: `${virtualRow.size}px` }}
                            >
                                {table.getVisibleFlatColumns().map(column => {
                                    const colIndex = parseInt(column.id);
                                    // Use raw array access for speed
                                    const cellValue = rowData ? rowData[colIndex] : null;
                                    const isLoading = cellValue === null || cellValue === undefined;
                                    const isError = errors.get(colIndex)?.has(rowIndex);
                                    
                                    return (
                                        <td
                                            key={column.id}
                                            className={`relative p-2 text-sm border-r border-border truncate flex-1 min-w-[150px] font-mono ${
                                                isError ? 'text-foreground bg-red-50/30' : 'text-muted-foreground'
                                            }`}
                                            title={!isLoading && isError ? `Error: ${cellValue}` : (cellValue || "")}
                                            style={{ width: column.getSize() }}
                                        >
                                            {isError && (
                                                <div className="absolute top-0 right-0 w-2 h-2 rounded-bl bg-destructive" />
                                            )}
                                            {isLoading ? (
                                                <div className="h-4 w-2/3 bg-gray-100 animate-pulse rounded" />
                                            ) : (
                                                cellValue
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
  );
};