import React from 'react';
import { ColumnSchema, ColumnType } from '../../types';
import { Type, Calendar, Hash, ToggleLeft, AlignLeft, Mail, Phone, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface SchemaArchitectProps {
    schema: ColumnSchema[];
    sampleRows: Record<number, string[]>;
    onTypeChange: (colIndex: number, newType: ColumnType) => void;
    onConfirm: () => void;
}

const TYPE_ICONS: Record<ColumnType, React.ReactNode> = {
    'Text': <AlignLeft size={16} />,
    'Integer': <Hash size={16} />,
    'Float': <Hash size={16} />,
    'Boolean': <ToggleLeft size={16} />,
    'Date': <Calendar size={16} />,
    'Email': <Mail size={16} />,
    'PhoneUS': <Phone size={16} />
};

const TYPES: ColumnType[] = ['Text', 'Integer', 'Float', 'Boolean', 'Email', 'PhoneUS', 'Date'];

export const SchemaArchitect: React.FC<SchemaArchitectProps> = ({ 
    schema, 
    sampleRows, 
    onTypeChange, 
    onConfirm 
}) => {
    
    const getSampleValues = (colIndex: number) => {
        const values: string[] = [];
        for (let i = 0; i < 3; i++) {
            if (sampleRows[i] && sampleRows[i][colIndex]) {
                values.push(sampleRows[i][colIndex]);
            }
        }
        return values.join(', ');
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Schema Architect</h2>
                <p className="text-muted-foreground">Review detected columns and data types before processing the file.</p>
            </div>

            {/* Top Pane: Raw Preview */}
            <div className="flex-[0_0_40%] border-b border-border overflow-auto">
                <div className="p-4 bg-muted/50 border-b border-border sticky top-0 z-10">
                    <h3 className="text-base font-semibold">Raw Data Preview (First 10 Rows)</h3>
                </div>
                <div className="overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted z-10">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold text-muted-foreground w-12 text-center">#</th>
                                {schema.map((col, idx) => (
                                    <th key={idx} className="px-4 py-2 text-left font-semibold text-muted-foreground border-l border-border truncate max-w-48" title={col.name}>
                                        {col.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(sampleRows).map(([rowIndex, row]) => (
                                <tr key={rowIndex} className="border-b border-border bg-background hover:bg-muted/50">
                                    <td className="px-4 py-2 text-muted-foreground text-center">{parseInt(rowIndex) + 1}</td>
                                    {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className="px-4 py-2 font-mono text-xs border-l border-border truncate max-w-48" title={cell}>
                                            {cell || <span className="italic text-muted-foreground/60">null</span>}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom Pane: Mapper */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 bg-muted/50 border-b border-border">
                    <h3 className="text-base font-semibold">Column Mapper</h3>
                </div>
                <div className="flex-1 overflow-x-auto">
                    <div className="flex p-4 gap-4 h-full">
                        {schema.map((col, idx) => (
                            <Card key={idx} className="w-72 shrink-0 flex flex-col shadow-md">
                                <CardHeader>
                                    <div className="flex items-start gap-3">
                                        <div className="text-muted-foreground mt-1">{TYPE_ICONS[col.detected_type] || <Type size={16} />}</div>
                                        <CardTitle className="truncate text-base" title={col.name}>{col.name}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 flex flex-col gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Data Type</label>
                                        <Select
                                            value={col.detected_type}
                                            onValueChange={(val) => onTypeChange(idx, val as ColumnType)}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TYPES.map(t => (
                                                    <SelectItem key={t} value={t}>
                                                        <div className="flex items-center gap-2">
                                                            {TYPE_ICONS[t]}
                                                            <span>{t}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground">Preview</label>
                                        <div className="mt-1 p-2 bg-muted/80 rounded-md text-sm text-muted-foreground truncate font-mono h-9 flex items-center">
                                            {getSampleValues(idx) || <span className="italic text-muted-foreground/50">Empty</span>}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t border-border bg-muted/50 flex justify-end shrink-0">
                     <Button
                         onClick={onConfirm}
                         size="lg"
                         className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                     >
                         <Check size={20} />
                         Confirm & Process
                     </Button>
                 </div>
            </div>
        </div>
    );
};
