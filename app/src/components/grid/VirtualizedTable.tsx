import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ColumnSchema, ColumnType } from '../../types';
import { ColumnHeader } from './ColumnHeader';

interface VirtualizedTableProps {
  rowCount: number;
  schema: ColumnSchema[];
  errors: Map<number, Set<number>>;
  pendingValidation: Set<number>;
  fetchRows: (start: number, limit: number) => Promise<Record<number, string[]>>;
  onTypeChange: (colIndex: number, newType: ColumnType) => void;
  onFix: (colIndex: number, strategy: string) => void;
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
  onFix,
  getRow,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [, forceUpdate] = useState({});

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35, // 35px row height
    overscan: 10,
  });

  // Fetching Logic with Batching
  useEffect(() => {
    if (rowCount === 0) return;

    const virtualItems = rowVirtualizer.getVirtualItems();
    const [start, end] = [
        virtualItems[0]?.index ?? 0,
        virtualItems[virtualItems.length - 1]?.index ?? 0
    ];

    // Calculate chunks
    const startChunk = Math.floor(start / CHUNK_SIZE);
    const endChunk = Math.floor(end / CHUNK_SIZE);

    const neededChunks: number[] = [];
    for (let c = startChunk; c <= endChunk; c++) {
        const chunkStart = c * CHUNK_SIZE;
        // Check if we have data for this chunk using getRow
        if (!getRow(chunkStart)) {
            neededChunks.push(c);
        }
    }

    if (neededChunks.length > 0) {
        const minChunk = Math.min(...neededChunks);
        const maxChunk = Math.max(...neededChunks);
        
        const fetchStart = minChunk * CHUNK_SIZE;
        const fetchLimit = (maxChunk - minChunk + 1) * CHUNK_SIZE;

        fetchRows(fetchStart, fetchLimit).then(() => {
            // Trigger re-render to show new data
            forceUpdate({});
        });
    }
  }, [rowVirtualizer.getVirtualItems(), rowCount, fetchRows, getRow]);

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
            onFix={(strategy) => onFix(index, strategy)}
          />
        ),
        cell: (info) => info.getValue(),
      })
    );
  }, [schema, onTypeChange, pendingValidation, errors, onFix]);

  const table = useReactTable({
    data: [], // Keep empty to avoid processing all rows
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div 
        ref={parentRef} 
        className="overflow-auto border border-gray-200 rounded-lg h-[600px] w-full relative bg-white"
    >
        {/* We need a container for the virtual height */}
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm" style={{ transform: `translateY(${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px)` }}>
                    {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id} className="flex w-full">
                            {headerGroup.headers.map(header => (
                                <th 
                                    key={header.id} 
                                    className="h-10 px-4 text-left align-middle font-medium text-muted-foreground bg-muted/50 border-b border-border flex-1 min-w-[150px]"
                                    style={{ width: header.getSize() }}
                                >
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody 
                    style={{
                        transform: `translateY(${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px)`, 
                        position: 'absolute', 
                        top: 0, 
                        left: 0,
                        width: '100%'
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map(virtualRow => {
                        const rowIndex = virtualRow.index;
                        const rowData = getRow(rowIndex);
                        
                        return (
                            <tr 
                                key={virtualRow.key} 
                                data-index={virtualRow.index} 
                                ref={rowVirtualizer.measureElement}
                                className="flex w-full border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                style={{ height: `${virtualRow.size}px` }}
                            >
                                {table.getVisibleFlatColumns().map(column => {
                                    const colIndex = parseInt(column.id);
                                    const cellValue = rowData ? rowData[colIndex] : "Loading...";
                                    const isError = errors.get(colIndex)?.has(rowIndex);
                                    
                                    return (
                                        <td
                                            key={column.id}
                                            className={`relative p-2 text-sm border-r border-border truncate flex-1 min-w-[150px] font-mono ${
                                                isError ? 'text-foreground' : 'text-muted-foreground'
                                            }`}
                                            title={isError ? `Error: ${cellValue}` : cellValue}
                                            style={{ width: column.getSize() }}
                                        >
                                            {isError && (
                                                <div className="absolute top-0 right-0 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-destructive" />
                                            )}
                                            {/* We manually render because table.getRowModel is empty */}
                                            {cellValue}
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
