import React from 'react';
import { ColumnSchema, ColumnType } from '../../types';
import { Type, Calendar, Hash, ToggleLeft, AlignLeft, Mail, Phone, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

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
    
    // Helper to get first few non-empty values for preview
    const getSampleValues = (colIndex: number) => {
        const values: string[] = [];
        // Iterate through first 5 rows (assuming sampleRows has keys 0,1,2...)
        for (let i = 0; i < 5; i++) {
            if (sampleRows[i] && sampleRows[i][colIndex]) {
                values.push(sampleRows[i][colIndex]);
            }
        }
        return values.slice(0, 3).join(', ');
    };

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col h-[calc(100vh-100px)]">
             <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Schema Architect</h2>
                <p className="text-muted-foreground">Review detected column types before processing</p>
             </div>

             <Card className="flex-1 overflow-hidden flex flex-col border-border shadow-sm">
                 <div className="bg-muted/50 px-6 py-3 border-b border-border grid grid-cols-12 gap-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                     <div className="col-span-4">Column Name</div>
                     <div className="col-span-3">Data Type</div>
                     <div className="col-span-5">Preview</div>
                 </div>
                 
                 <div className="overflow-y-auto flex-1 p-0">
                     {schema.map((col, idx) => (
                         <div key={idx} className="px-6 py-4 border-b border-border grid grid-cols-12 gap-4 items-center hover:bg-muted/50 transition-colors">
                             
                             {/* Column Name */}
                             <div className="col-span-4 flex items-center gap-3">
                                 <div className="text-muted-foreground">
                                     {TYPE_ICONS[col.detected_type] || <Type size={16} />}
                                 </div>
                                 <span className="font-medium text-foreground truncate" title={col.name}>
                                     {col.name}
                                 </span>
                             </div>

                             {/* Type Selector */}
                             <div className="col-span-3">
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

                             {/* Preview */}
                             <div className="col-span-5 text-sm text-muted-foreground truncate font-mono">
                                 {getSampleValues(idx) || <span className="italic text-muted-foreground/50">Empty</span>}
                             </div>
                         </div>
                     ))}
                 </div>

                 <div className="p-4 border-t border-border bg-muted/50 flex justify-end">
                     <Button
                         onClick={onConfirm}
                         size="lg"
                         className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                     >
                         <Check size={20} />
                         Confirm & Process
                     </Button>
                 </div>
             </Card>
        </div>
    );
};
