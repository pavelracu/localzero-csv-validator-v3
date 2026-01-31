import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ColumnSchema, ColumnType } from '../../types';
import { Calendar, Hash, ToggleLeft, AlignLeft, Mail, Phone, Check, Save, Search, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { suggestTypeFromColumnName } from '@/lib/columnNameHints';

interface MappingProps {
    schema: ColumnSchema[];
    sampleRows: Record<number, string[]>;
    onTypeChange: (colIndex: number, newType: ColumnType) => void;
    onConfirm: () => void;
    onSavePreset: (name: string) => void;
    /** Mapping from selected schema (predefined or saved) on screen 1; applied once when schema is set. */
    schemaHints?: Record<string, ColumnType>;
    /** File name and row count for header context. */
    fileName?: string;
    rowCount: number;
}

const TYPE_ICONS: Record<ColumnType, React.ReactNode> = {
    'Text': <AlignLeft size={14} />,
    'Integer': <Hash size={14} />,
    'Float': <Hash size={14} />,
    'Boolean': <ToggleLeft size={14} />,
    'Date': <Calendar size={14} />,
    'Email': <Mail size={14} />,
    'PhoneUS': <Phone size={14} />,
    'Uuid': <Hash size={14} />,
    'Time': <Calendar size={14} />,
    'Currency': <Hash size={14} />,
    'Percentage': <Hash size={14} />,
};

const TYPES: ColumnType[] = ['Text', 'Integer', 'Float', 'Boolean', 'Email', 'PhoneUS', 'Date', 'Uuid', 'Time', 'Currency', 'Percentage'];

export const Mapping: React.FC<MappingProps> = ({
    schema,
    sampleRows,
    onTypeChange,
    onConfirm,
    onSavePreset,
    schemaHints,
    fileName,
    rowCount,
}) => {
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [saveSchemaName, setSaveSchemaName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const hasAppliedHints = useRef(false);
    const hasAppliedNameHints = useRef(false);

    const handleOpenSaveDialog = () => {
        setSaveSchemaName('');
        setSaveDialogOpen(true);
    };

    const handleSaveSchemaSubmit = () => {
        const name = saveSchemaName.trim();
        if (!name) return;
        onSavePreset(name);
        setSaveDialogOpen(false);
        setSaveSchemaName('');
    };

    const getSampleValues = (colIndex: number) => {
        const values: string[] = [];
        for (let i = 0; i < 3; i++) {
            if (sampleRows[i] && sampleRows[i][colIndex]) {
                values.push(sampleRows[i][colIndex]);
            }
        }
        return values.join(', ');
    };

    // Apply schema hints once when schema is set and we have hints
    useEffect(() => {
        if (!schemaHints || Object.keys(schemaHints).length === 0 || hasAppliedHints.current || schema.length === 0) return;
        hasAppliedHints.current = true;
        schema.forEach((col, idx) => {
            const hint = schemaHints[col.name];
            if (hint && hint !== col.detected_type) {
                onTypeChange(idx, hint);
            }
        });
    }, [schema, schemaHints, onTypeChange]);

    // Apply name-based type hints for columns still Text (skip if schema hint exists for that column)
    useEffect(() => {
        if (hasAppliedNameHints.current || schema.length === 0) return;
        hasAppliedNameHints.current = true;
        schema.forEach((col, idx) => {
            if (col.detected_type !== 'Text') return;
            if (schemaHints?.[col.name]) return;
            const suggested = suggestTypeFromColumnName(col.name);
            if (suggested && suggested !== 'Text') {
                onTypeChange(idx, suggested);
            }
        });
    }, [schema, schemaHints, onTypeChange]);

    const filteredSchema = useMemo(() => {
        if (!searchQuery.trim()) return schema;
        const q = searchQuery.toLowerCase().trim();
        return schema.filter((col) => col.name.toLowerCase().includes(q));
    }, [schema, searchQuery]);

    const parentRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: filteredSchema.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 48,
        overscan: 10,
    });

    const typeSummary = useMemo(() => {
        const counts: Record<ColumnType, number> = {} as Record<ColumnType, number>;
        TYPES.forEach((t) => { counts[t] = 0; });
        schema.forEach((col) => {
            counts[col.detected_type] = (counts[col.detected_type] ?? 0) + 1;
        });
        return Object.entries(counts)
            .filter(([, n]) => n > 0)
            .map(([type, n]) => `${n} ${type}`)
            .join(', ');
    }, [schema]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
                <div className="px-4 py-3 border-b flex items-center justify-between bg-background z-20 shadow-sm flex-wrap gap-2">
                    <div>
                        <h2 className="text-lg font-bold">Map Columns</h2>
                        <p className="text-xs text-muted-foreground">
                            {fileName
                                ? `${fileName} · ${rowCount.toLocaleString()} rows · ${schema.length} columns`
                                : 'Define data types for validation'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative w-[200px]">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <Input
                                placeholder="Search column..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 pr-8 h-9 text-sm"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                                    aria-label="Clear search"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenSaveDialog}
                            className="gap-2 h-9"
                        >
                            <Save size={16} />
                            Save schema
                        </Button>
                        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Save schema</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="schema-name">Name</Label>
                                        <Input
                                            id="schema-name"
                                            placeholder="e.g. Monthly Sales"
                                            value={saveSchemaName}
                                            onChange={(e) => setSaveSchemaName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveSchemaSubmit()}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
                                    <Button onClick={handleSaveSchemaSubmit} disabled={!saveSchemaName.trim()} className="gap-2">
                                        <Save size={14} />
                                        Save
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <div className="flex items-center gap-2">
                            {typeSummary && (
                                <span className="text-xs text-muted-foreground hidden sm:inline">
                                    {typeSummary}
                                </span>
                            )}
                            <Button
                                onClick={onConfirm}
                                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9 px-4"
                            >
                                <Check size={16} />
                                Confirm Schema
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col p-4 bg-muted/5">
                    <div className="grid grid-cols-[1fr_140px_1fr] gap-3 text-xs font-medium text-muted-foreground border-b pb-2 mb-2 shrink-0">
                        <span>Column</span>
                        <span>Type</span>
                        <span>Sample</span>
                    </div>
                    <div ref={parentRef} className="flex-1 overflow-auto min-h-0 rounded-md border border-border bg-background">
                        {filteredSchema.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <p className="text-sm text-muted-foreground">
                                    {searchQuery
                                        ? `No columns match "${searchQuery}".`
                                        : 'No columns to show.'}
                                </p>
                                {searchQuery && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-3"
                                        onClick={() => setSearchQuery('')}
                                    >
                                        Clear search
                                    </Button>
                                )}
                            </div>
                        ) : (
                        <div
                            style={{
                                height: `${virtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {virtualizer.getVirtualItems().map((virtualRow) => {
                                const col = filteredSchema[virtualRow.index];
                                const originalIdx = schema.findIndex((c) => c.name === col.name);
                                if (originalIdx < 0) return null;
                                return (
                                    <div
                                        key={col.name}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                        className="grid grid-cols-[1fr_140px_1fr] gap-3 items-center px-2 py-1.5 border-b border-border/50 hover:bg-muted/30"
                                    >
                                        <span className="truncate font-mono text-foreground" title={col.name}>
                                            {col.name}
                                        </span>
                                        <Select
                                            value={col.detected_type}
                                            onValueChange={(val) => onTypeChange(originalIdx, val as ColumnType)}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
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
                                        <span className="truncate font-mono text-muted-foreground text-[11px]">
                                            {getSampleValues(originalIdx) || '—'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        )}
                    </div>
                    {searchQuery && filteredSchema.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2 shrink-0">
                            Showing {filteredSchema.length} of {schema.length} columns
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
