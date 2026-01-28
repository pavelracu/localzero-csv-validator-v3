import React, { useState } from 'react';
import { ColumnType } from '../../types';
import { FixPanel } from '../mechanic/FixPanel';
import { AlertTriangle, Clock } from 'lucide-react';

interface ColumnHeaderProps {
    name: string;
    type: ColumnType;
    isPending: boolean;
    errorCount: number;
    onTypeChange: (newType: ColumnType) => void;
    onFix: (strategy: string) => void;
}

const TYPES: ColumnType[] = ['Text', 'Integer', 'Float', 'Boolean', 'Email', 'PhoneUS', 'Date'];

export const ColumnHeader: React.FC<ColumnHeaderProps> = ({ 
    name, 
    type, 
    isPending, 
    errorCount, 
    onTypeChange, 
    onFix 
}) => {
    const [showFixPanel, setShowFixPanel] = useState(false);

    return (
        <div className="flex flex-col items-start space-y-1 p-2 border-b border-gray-200 bg-gray-50 h-full relative">
            <div className="flex items-center justify-between w-full">
                <span className="font-bold text-sm text-gray-700 truncate" title={name}>{name}</span>
                
                <div className="flex items-center gap-1">
                    {isPending && (
                        <div className="bg-amber-100 text-amber-700 p-0.5 rounded-full" title="Pending Validation">
                            <Clock size={12} />
                        </div>
                    )}
                    
                    {errorCount > 0 && (
                        <button 
                            onClick={() => setShowFixPanel(!showFixPanel)}
                            className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 hover:bg-red-200 transition-colors"
                        >
                            <AlertTriangle size={10} />
                            {errorCount}
                        </button>
                    )}
                </div>
            </div>

            <select
                value={type}
                onChange={(e) => onTypeChange(e.target.value as ColumnType)}
                className={`text-xs border rounded px-1 py-0.5 bg-white w-full cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    isPending 
                        ? 'border-amber-300 ring-1 ring-amber-100' 
                        : errorCount > 0 
                            ? 'border-red-300 ring-1 ring-red-100' 
                            : 'border-gray-300 hover:border-blue-500'
                }`}
            >
                {TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                ))}
            </select>

            {showFixPanel && (
                <FixPanel 
                    column={{ name, type }}
                    errorCount={errorCount}
                    onFix={(strategy) => {
                        onFix(strategy);
                        setShowFixPanel(false);
                    }}
                    onClose={() => setShowFixPanel(false)}
                />
            )}
        </div>
    );
};
