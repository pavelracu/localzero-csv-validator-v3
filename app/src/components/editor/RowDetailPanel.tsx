import React, { useState, useEffect, useMemo } from 'react';
import { ColumnType } from '../../types';
import { AlertCircle, Save, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface RowDetailPanelProps {
    rowIndex: number;
    rowData: string[];
    schema: { name: string, detected_type: ColumnType }[];
    errors: Map<number, Set<number>>;
    onUpdateCell: (rowIdx: number, colIdx: number, value: string) => Promise<void>;
    onClose: () => void;
    open: boolean;
}

function getErrorMessage(value: string, columnType: ColumnType): string {
    // Empty values are valid for all types, so if there's an error, the value must be non-empty
    switch (columnType) {
        case 'Integer':
            return `"${value}" is not a valid integer. Expected a whole number (e.g., 123, -45).`;
        case 'Float':
            return `"${value}" is not a valid decimal number. Expected a number with optional decimal point (e.g., 123.45, -0.5).`;
        case 'Boolean':
            return `"${value}" is not a valid boolean. Expected exactly "true" or "false" (case-sensitive).`;
        case 'Email':
            return `"${value}" is not a valid email address. Expected format: user@example.com`;
        case 'PhoneUS':
            // Check if it's an area code issue (second digit is 9)
            const digits = value.replace(/\D/g, '');
            if (digits.length >= 11 && digits.startsWith('1')) {
                const areaCode = digits.substring(1, 4);
                if (areaCode.length === 3 && areaCode[1] === '9') {
                    return `"${value}" is not a valid US phone number. Area code "${areaCode}" is invalid - the middle digit cannot be 9 (reserved for future use). Expected format: (XXX) XXX-XXXX where area code middle digit is 0-8.`;
                }
            } else if (digits.length >= 10) {
                const areaCode = digits.substring(0, 3);
                if (areaCode.length === 3 && areaCode[1] === '9') {
                    return `"${value}" is not a valid US phone number. Area code "${areaCode}" is invalid - the middle digit cannot be 9 (reserved for future use). Expected format: (XXX) XXX-XXXX where area code middle digit is 0-8.`;
                }
            }
            return `"${value}" is not a valid US phone number. Expected format: (XXX) XXX-XXXX or XXX-XXX-XXXX. Area code must start with 2-9 and have middle digit 0-8.`;
        case 'Date':
            return `"${value}" is not a valid date. Expected formats: YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY, or YYYY/MM/DD`;
        case 'Uuid':
            return `"${value}" is not a valid UUID. Expected format: 550e8400-e29b-41d4-a716-446655440000 (with or without hyphens).`;
        case 'Time':
            return `"${value}" is not a valid time. Expected HH:MM or HH:MM:SS (24h or 12h with AM/PM).`;
        case 'Currency':
            return `"${value}" is not a valid currency value. Expected a number, optionally with $, €, or commas.`;
        case 'Percentage':
            return `"${value}" is not a valid percentage. Expected a number, optionally with %.`;
        case 'Text':
        default:
            return 'Invalid value';
    }
}

export const RowDetailPanel: React.FC<RowDetailPanelProps> = ({ 
    rowIndex, 
    rowData, 
    schema, 
    errors,
    onUpdateCell,
    onClose, 
    open 
}) => {
    const [editedValues, setEditedValues] = useState<string[]>(rowData);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Calculate error count for this row
    const errorCount = useMemo(() => {
        let count = 0;
        errors.forEach((rowIndices) => {
            if (rowIndices.has(rowIndex)) {
                count++;
            }
        });
        return count;
    }, [errors, rowIndex]);

    useEffect(() => {
        if (open) {
            setEditedValues(rowData);
            setHasChanges(false);
            setIsSaving(false);
        }
    }, [open, rowData]);

    const handleCellChange = (colIdx: number, newValue: string) => {
        const updated = [...editedValues];
        updated[colIdx] = newValue;
        setEditedValues(updated);
        
        // Check if there are any changes
        const changed = updated.some((val, idx) => val !== (rowData[idx] || ''));
        setHasChanges(changed);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save all changed cells
            const savePromises: Promise<void>[] = [];
            for (let colIdx = 0; colIdx < editedValues.length; colIdx++) {
                const newValue = editedValues[colIdx] || '';
                const oldValue = rowData[colIdx] || '';
                if (newValue !== oldValue) {
                    savePromises.push(onUpdateCell(rowIndex, colIdx, newValue));
                }
            }
            
            await Promise.all(savePromises);
            setHasChanges(false);
        } catch (error) {
            console.error('Failed to save changes:', error);
            // Revert on error
            setEditedValues(rowData);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
            <SheetContent className="w-[500px] sm:w-[600px] flex flex-col p-0">
                {/* Fixed Header */}
                <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0">
                    <SheetHeader className="mb-4">
                        <SheetTitle className="flex items-center justify-between">
                            <span>Row {rowIndex + 1} Details</span>
                            {errorCount > 0 && (
                                <span className="text-sm font-normal text-destructive">
                                    {errorCount} error{errorCount !== 1 ? 's' : ''}
                                </span>
                            )}
                        </SheetTitle>
                        <SheetDescription>
                            Edit cell values below. Click Save to apply all changes.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 size={16} className="mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={16} className="mr-2" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="space-y-4">
                        {schema.map((column, colIdx) => {
                            const value = editedValues[colIdx] || '';
                            const hasError = errors.get(colIdx)?.has(rowIndex) ?? false;
                            const columnType = column.detected_type;
                            const hasChanged = value !== (rowData[colIdx] || '');

                            return (
                                <div key={colIdx} className="space-y-2">
                                    <Label htmlFor={`cell-${colIdx}`} className="text-sm font-medium">
                                        {column.name}
                                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                                            ({columnType})
                                        </span>
                                        {hasChanged && (
                                            <span className="ml-2 text-xs text-primary font-normal">
                                                (modified)
                                            </span>
                                        )}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id={`cell-${colIdx}`}
                                            value={value}
                                            onChange={(e) => handleCellChange(colIdx, e.target.value)}
                                            className={hasError ? 'border-destructive focus-visible:ring-destructive' : ''}
                                            disabled={isSaving}
                                        />
                                    </div>
                                    {hasError && (
                                        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                                            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                            <span>{getErrorMessage(value, columnType)}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
};
