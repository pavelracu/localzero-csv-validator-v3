import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ColumnSchema, ColumnType, SchemaPreset } from '../../types';
import { Calendar, Hash, ToggleLeft, AlignLeft, Mail, Phone, Check, FileType, Save, FolderOpen, Search } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface MappingProps {
    schema: ColumnSchema[];
    sampleRows: Record<number, string[]>;
    onTypeChange: (colIndex: number, newType: ColumnType) => void;
    onConfirm: () => void;
    onSavePreset: (name: string) => void;
    onLoadPreset: (preset: SchemaPreset) => void;
    presets: SchemaPreset[];
    /** Optional column name → type hints from selected schema; applied once when schema is set. */
    schemaHints?: Record<string, ColumnType>;
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
    onSavePreset,
    onLoadPreset,
    presets,
    schemaHints,
}) => {
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [saveSchemaName, setSaveSchemaName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const hasAppliedHints = useRef(false);

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

    return (
        <div className="h-full flex flex-col">
            {/* Top Pane: Raw Preview (compact) */}
            <div className="h-[28%] min-h-[160px] flex flex-col border-b bg-muted/10">
                <div className="px-4 py-2 border-b bg-background flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <FileType size={16} /> Raw Data Preview
                    </h3>
                    <span className="text-xs text-muted-foreground">First 10 rows</span>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-muted sticky top-0 z-10 text-muted-foreground font-medium">
                            <tr>
                                <th className="p-2 border-b w-12 text-center">#</th>
                                {schema.slice(0, 20).map((col, idx) => (
                                    <th key={idx} className="p-2 border-b border-l font-normal truncate max-w-[160px]">
                                        {col.name}
                                    </th>
                                ))}
                                {schema.length > 20 && (
                                    <th className="p-2 border-b border-l text-muted-foreground">+{schema.length - 20}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(sampleRows).slice(0, 5).map(([rowIndex, row]) => (
                                <tr key={rowIndex} className="border-b hover:bg-muted/50">
                                    <td className="p-2 text-center text-muted-foreground">{parseInt(rowIndex) + 1}</td>
                                    {row.slice(0, 20).map((cell, cellIndex) => (
                                        <td key={cellIndex} className="p-2 border-l font-mono text-muted-foreground truncate max-w-[160px]">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom Pane: Column Mapper with virtualized list */}
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
                <div className="px-4 py-3 border-b flex items-center justify-between bg-background z-20 shadow-sm flex-wrap gap-2">
                    <div>
                        <h2 className="text-lg font-bold">Map Columns</h2>
                        <p className="text-xs text-muted-foreground">Define data types for validation</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative w-[200px]">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <Input
                                placeholder="Search column..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 h-9 text-sm"
                            />
                        </div>
                        {(presets.length > 0) && (
                            <Select
                                onValueChange={(id) => {
                                    const preset = presets.find(p => p.id === id);
                                    if (preset) onLoadPreset(preset);
                                }}
                            >
                                <SelectTrigger className="w-[180px] h-9 gap-2">
                                    <FolderOpen size={14} className="shrink-0" />
                                    <SelectValue placeholder="Load schema" />
                                </SelectTrigger>
                                <SelectContent>
                                    {presets.map((preset) => (
                                        <SelectItem key={preset.id} value={preset.id}>
                                            {preset.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
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
                        <Button
                            onClick={onConfirm}
                            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9 px-4"
                        >
                            <Check size={16} />
                            Confirm Schema
                        </Button>
                    </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col p-4 bg-muted/5">
                    <div className="grid grid-cols-[1fr_140px_1fr] gap-3 text-xs font-medium text-muted-foreground border-b pb-2 mb-2 shrink-0">
                        <span>Column</span>
                        <span>Type</span>
                        <span>Sample</span>
                    </div>
                    <div ref={parentRef} className="flex-1 overflow-auto min-h-0 rounded-md border border-border bg-background">
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
                    </div>
                    {searchQuery && (
                        <p className="text-xs text-muted-foreground mt-2 shrink-0">
                            Showing {filteredSchema.length} of {schema.length} columns
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
