import React from 'react';
import { ColumnType } from '../../types';
import { AlertTriangle, Clock } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ColumnHeaderProps {
    name: string;
    type: ColumnType;
    isPending: boolean;
    errorCount: number;
    onTypeChange: (newType: ColumnType) => void;
    onSelectFix: () => void;
}

const TYPES: ColumnType[] = ['Text', 'Integer', 'Float', 'Boolean', 'Email', 'PhoneUS', 'Date', 'Uuid', 'Time', 'Currency', 'Percentage'];

export const ColumnHeader: React.FC<ColumnHeaderProps> = ({ 
    name, 
    type, 
    isPending, 
    errorCount, 
    onTypeChange, 
    onSelectFix,
}) => {
    return (
        <div className={`flex flex-col items-stretch justify-center gap-2 p-2 min-h-[56px] w-full box-border relative transition-colors ${
            isPending 
                ? 'bg-amber-50 border-t-4 border-t-amber-400 border-b-amber-200' 
                : errorCount > 0 
                    ? 'bg-destructive/5 border-b-destructive/20' 
                    : 'bg-muted/30 border-b-border'
        }`}>
            <div className="flex items-center justify-between w-full gap-2 min-h-5">
                <span className={`font-bold text-sm truncate shrink min-w-0 ${
                    isPending ? 'text-amber-900' : errorCount > 0 ? 'text-destructive' : 'text-foreground'
                }`} title={name}>{name}</span>
                <div className="flex items-center gap-1 shrink-0">
                    {isPending && (
                        <div className="bg-amber-100 text-amber-700 p-0.5 rounded-full" title="Pending Validation">
                            <Clock size={12} />
                        </div>
                    )}
                    {errorCount > 0 && (
                        <Badge 
                            variant="destructive" 
                            className="cursor-pointer hover:opacity-80 px-1.5 py-0.5 text-[10px] flex items-center gap-1 h-5"
                            onClick={onSelectFix}
                        >
                            <AlertTriangle size={10} />
                            {errorCount}
                        </Badge>
                    )}
                </div>
            </div>
            <Select
                value={type}
                onValueChange={(val) => onTypeChange(val as ColumnType)}
            >
                <SelectTrigger className={`h-7 text-xs w-full ${
                    isPending 
                        ? 'border-amber-300 ring-amber-100' 
                        : errorCount > 0 
                            ? 'border-destructive/30' 
                            : ''
                }`}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50 max-h-[200px]">
                    {TYPES.map(t => (
                        <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};