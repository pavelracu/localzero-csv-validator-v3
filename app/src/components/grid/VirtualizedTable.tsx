import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { ColumnSchema, ColumnType } from '../../types';
import { ColumnHeader } from './ColumnHeader';

interface VirtualizedTableProps {
  data: string[][]; // Array of arrays
  schema: ColumnSchema[];
  errors: Map<number, Set<number>>; // colIndex -> Set<rowIndex>
  onTypeChange: (colIndex: number, newType: ColumnType) => void;
}

export const VirtualizedTable: React.FC<VirtualizedTableProps> = ({
  data,
  schema,
  errors,
  onTypeChange,
}) => {
  const columnHelper = createColumnHelper<string[]>();

  const columns = useMemo(() => {
    return schema.map((col, index) => 
      columnHelper.accessor((row) => row[index], {
        id: index.toString(),
        header: () => (
          <ColumnHeader
            name={col.name}
            type={col.detected_type}
            onTypeChange={(newType) => onTypeChange(index, newType)}
          />
        ),
        cell: (info) => info.getValue(),
      })
    );
  }, [schema, onTypeChange]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-auto border border-gray-200 rounded-lg h-[600px] w-full relative">
      <table className="min-w-full text-left border-collapse">
        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} className="p-0 border-r border-b border-gray-200 min-w-[150px] align-top">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => {
                const colIndex = parseInt(cell.column.id);
                const rowIndex = row.index;
                const isError = errors.get(colIndex)?.has(rowIndex);
                
                return (
                  <td
                    key={cell.id}
                    className={`p-2 text-sm border-r border-gray-100 truncate max-w-[200px] ${
                      isError 
                        ? 'bg-red-50 text-red-900 border-b border-red-100 decoration-red-500 underline decoration-wavy' 
                        : 'text-gray-600'
                    }`}
                    title={cell.getValue() as string}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
