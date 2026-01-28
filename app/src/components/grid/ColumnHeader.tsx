import React from 'react';
import { ColumnType } from '../../types';

interface ColumnHeaderProps {
    name: string;
    type: ColumnType;
    onTypeChange: (newType: ColumnType) => void;
}

const TYPES: ColumnType[] = ['Text', 'Integer', 'Float', 'Boolean', 'Email', 'PhoneUS', 'Date'];

export const ColumnHeader: React.FC<ColumnHeaderProps> = ({ name, type, onTypeChange }) => {
    return (
        <div className="flex flex-col items-start space-y-1 p-2 border-b border-gray-200 bg-gray-50 h-full">
            <span className="font-bold text-sm text-gray-700 truncate w-full" title={name}>{name}</span>
            <select
                value={type}
                onChange={(e) => onTypeChange(e.target.value as ColumnType)}
                className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white w-full cursor-pointer hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
                {TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                ))}
            </select>
        </div>
    );
};
