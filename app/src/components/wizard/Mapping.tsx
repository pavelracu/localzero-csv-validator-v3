import React from 'react';
import { ColumnSchema, ColumnType } from '../../types';
import { Calendar, Hash, ToggleLeft, AlignLeft, Mail, Phone, Check, FileType, Save } from 'lucide-react'; // Added Save
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface MappingProps {
    schema: ColumnSchema[];
    sampleRows: Record<number, string[]>;
    onTypeChange: (colIndex: number, newType: ColumnType) => void;
    onConfirm: () => void;
    onSavePreset: () => void; // Added prop
}

const TYPE_ICONS: Record<ColumnType, React.ReactNode> = {
    'Text': <AlignLeft size={14} />,
    'Integer': <Hash size={14} />,
    'Float': <Hash size={14} />,
    'Boolean': <ToggleLeft size={14} />,
    'Date': <Calendar size={14} />,
    'Email': <Mail size={14} />,
    'PhoneUS': <Phone size={14} />
};

const TYPES: ColumnType[] = ['Text', 'Integer', 'Float', 'Boolean', 'Email', 'PhoneUS', 'Date'];

export const Mapping: React.FC<MappingProps> = ({ 
    schema, 
    sampleRows, 
    onTypeChange, 
    onConfirm,
    onSavePreset // Destructure prop
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
            {/* Top Pane: Raw Preview */}
            <div className="h-[35%] min-h-[200px] flex flex-col border-b bg-muted/10">
                <div className="px-4 py-2 border-b bg-background flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <FileType size={16} /> Raw Data Preview
                    </h3>
                    <span className="text-xs text-muted-foreground">Showing first 10 rows</span>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-muted sticky top-0 z-10 text-muted-foreground font-medium">
                            <tr>
                                <th className="p-2 border-b w-12 text-center">#</th>
                                {schema.map((col, idx) => (
                                    <th key={idx} className="p-2 border-b border-l font-normal truncate max-w-[200px]">
                                        {col.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(sampleRows).map(([rowIndex, row]) => (
                                <tr key={rowIndex} className="border-b hover:bg-muted/50">
                                    <td className="p-2 text-center text-muted-foreground">{parseInt(rowIndex) + 1}</td>
                                    {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className="p-2 border-l font-mono text-muted-foreground truncate max-w-[200px]">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom Pane: Column Mapper */}
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
                <div className="px-4 py-3 border-b flex items-center justify-between bg-background z-20 shadow-sm">
                    <div>
                        <h2 className="text-lg font-bold">Map Columns</h2>
                        <p className="text-xs text-muted-foreground">Define data types for validation</p>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={onSavePreset} 
                            className="gap-2 h-9"
                        >
                            <Save size={16} />
                            Save as Preset
                        </Button>
                        <Button 
                            onClick={onConfirm} 
                            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9 px-4"
                        >
                            <Check size={16} />
                            Confirm Schema
                        </Button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-x-auto min-h-0 p-4 bg-muted/5">
                    <div className="flex gap-4 h-full pb-2">
                        {schema.map((col, idx) => (
                            <Card key={idx} className="w-[280px] shrink-0 flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-bold truncate flex items-center gap-2" title={col.name}>
                                        <div className="p-1 bg-primary/10 rounded text-primary">
                                            {TYPE_ICONS[col.detected_type]}
                                        </div>
                                        {col.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-2 flex-1 flex flex-col gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Type</label>
                                        <Select 
                                            value={col.detected_type} 
                                            onValueChange={(val) => onTypeChange(idx, val as ColumnType)}
                                        >
                                            <SelectTrigger className="h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TYPES.map(t => (
                                                    <SelectItem key={t} value={t}>
                                                        <div className="flex items-center gap-2">
                                                            {TYPE_ICONS[t]} {t}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div className="space-y-1.5 flex-1">
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Sample Data</label>
                                        <div className="bg-muted/50 rounded-md p-2 text-xs font-mono text-muted-foreground h-full overflow-hidden break-words whitespace-pre-wrap">
                                            {getSampleValues(idx)}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};