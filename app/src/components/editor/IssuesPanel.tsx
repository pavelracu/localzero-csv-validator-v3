import { useMemo, useState } from 'react';
import { ColumnSchema, ColumnType, IssueGroup, Suggestion, SuggestionReport } from '../../types';
import { computeIssueGroups } from '../../lib/issueGroups';
import { AlertTriangle, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface IssuesPanelProps {
    schema: ColumnSchema[];
    errors: Map<number, Set<number>>;
    getSuggestions: (colIdx: number) => Promise<SuggestionReport[]>;
    applySuggestion: (colIdx: number, suggestion: Suggestion) => Promise<void>;
    /** Optional: open Fix panel for a specific column (e.g. from table) */
    onOpenColumnFix?: (colIdx: number) => void;
}

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toLocaleString();
}

export function IssuesPanel({
    schema,
    errors,
    getSuggestions,
    applySuggestion,
    onOpenColumnFix,
}: IssuesPanelProps) {
    const groups = useMemo(() => computeIssueGroups(schema, errors), [schema, errors]);
    const [applyingType, setApplyingType] = useState<ColumnType | null>(null);

    const totalErrors = useMemo(() => {
        let sum = 0;
        errors.forEach((set) => { sum += set.size; });
        return sum;
    }, [errors]);

    const handleApplyToAll = async (group: IssueGroup) => {
        setApplyingType(group.columnType);
        try {
            for (const col of group.columns) {
                const reports = await getSuggestions(col.colIdx);
                if (reports.length > 0) {
                    await applySuggestion(col.colIdx, reports[0].suggestion);
                }
            }
        } catch (e) {
            console.error('Apply to all failed', e);
        } finally {
            setApplyingType(null);
        }
    };

    if (groups.length === 0) {
        return (
            <div className="w-[300px] shrink-0 border-r border-border bg-muted/20 flex flex-col items-center justify-center p-6 text-center">
                <div className="rounded-full bg-[var(--success)]/20 p-3 mb-3">
                    <Wand2 size={24} className="text-[var(--success)]" />
                </div>
                <p className="text-sm font-medium text-foreground">No validation errors</p>
                <p className="text-xs text-muted-foreground mt-1">Data is ready to export.</p>
            </div>
        );
    }

    return (
        <div className="w-[320px] shrink-0 border-r border-border bg-muted/10 flex flex-col min-h-0">
            <div className="px-3 py-3 border-b border-border shrink-0">
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wide text-foreground flex items-center gap-2">
                    <AlertTriangle size={14} className="text-destructive" />
                    Issues by type
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                    {totalErrors.toLocaleString()} error{totalErrors !== 1 ? 's' : ''} in {groups.length} type{groups.length !== 1 ? 's' : ''}
                </p>
            </div>
            <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 space-y-3">
                    {groups.map((group) => {
                        const isApplying = applyingType === group.columnType;
                        return (
                            <div
                                key={group.columnType}
                                className={cn(
                                    'rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden',
                                    group.totalErrors > 0 && 'border-destructive/30'
                                )}
                            >
                                <div className="p-3">
                                    <div className="font-medium text-sm text-foreground">
                                        {group.issueKind}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        {formatCount(group.totalErrors)} errors in {group.columns.length} column{group.columns.length !== 1 ? 's' : ''}
                                    </div>
                                    <ul className="mt-2 space-y-1.5">
                                        {group.columns.map((col) => (
                                            <li
                                                key={col.colIdx}
                                                className="flex items-center gap-2 text-xs min-w-0"
                                            >
                                                <span className="truncate text-muted-foreground flex-1" title={col.name}>
                                                    {col.name}
                                                </span>
                                                <span className="tabular-nums text-destructive font-medium shrink-0">
                                                    {col.errorCount.toLocaleString()}
                                                </span>
                                                {onOpenColumnFix && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-1.5 text-xs shrink-0"
                                                        onClick={() => onOpenColumnFix(col.colIdx)}
                                                    >
                                                        Fix
                                                    </Button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                    <Button
                                        size="sm"
                                        className="w-full mt-3 gap-2"
                                        disabled={isApplying}
                                        onClick={() => handleApplyToAll(group)}
                                    >
                                        {isApplying ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                Applying…
                                            </>
                                        ) : (
                                            <>
                                                <Wand2 size={14} />
                                                Apply to all
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}
