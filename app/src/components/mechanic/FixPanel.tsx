import React from 'react';
import { ColumnType } from '../../types';
import { X, Eraser, RotateCcw, AlertTriangle } from 'lucide-react';

interface FixPanelProps {
    column: { name: string, type: ColumnType };
    errorCount: number;
    onFix: (strategy: 'clear' | 'revert') => void;
    onClose: () => void;
}

export const FixPanel: React.FC<FixPanelProps> = ({ column, errorCount, onFix, onClose }) => {
    return (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden ring-1 ring-black ring-opacity-5">
            <div className="bg-red-50 p-3 border-b border-red-100 flex items-start justify-between">
                <div className="flex items-center gap-2 text-red-800">
                    <AlertTriangle size={16} />
                    <span className="font-semibold text-sm">The Mechanic</span>
                </div>
                <button onClick={onClose} className="text-red-400 hover:text-red-600">
                    <X size={16} />
                </button>
            </div>
            
            <div className="p-4 space-y-4">
                <p className="text-sm text-gray-600">
                    Found <strong className="text-gray-900">{errorCount}</strong> errors in <br/>
                    <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">{column.name}</span>
                </p>

                <div className="space-y-2">
                    <button 
                        onClick={() => onFix('clear')}
                        className="w-full flex items-center justify-between p-2 text-left text-sm rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors group"
                    >
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gray-100 rounded text-gray-500 group-hover:text-blue-600 group-hover:bg-blue-50">
                                <Eraser size={16} />
                            </div>
                            <div>
                                <div className="font-medium text-gray-900">Clear Invalid</div>
                                <div className="text-xs text-gray-500">Set to empty string</div>
                            </div>
                        </div>
                    </button>

                    <button 
                        onClick={() => onFix('revert')}
                        className="w-full flex items-center justify-between p-2 text-left text-sm rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors group"
                    >
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gray-100 rounded text-gray-500 group-hover:text-amber-600 group-hover:bg-amber-50">
                                <RotateCcw size={16} />
                            </div>
                            <div>
                                <div className="font-medium text-gray-900">Reset to Original</div>
                                <div className="text-xs text-gray-500">Revert changes</div>
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};
