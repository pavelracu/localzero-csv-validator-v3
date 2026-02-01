import type { ColumnSchema, ColumnType, IssueGroup } from '../types';

/** Human-readable label per column type for the Issues panel */
export const ISSUE_TYPE_LABELS: Record<ColumnType, string> = {
    Text: 'Invalid or inconsistent text',
    Integer: 'Invalid integer',
    Float: 'Invalid decimal number',
    Boolean: 'Invalid boolean',
    Email: 'Invalid email format',
    PhoneUS: 'Invalid US phone format',
    Date: 'Invalid date format',
    Uuid: 'Invalid UUID format',
    Time: 'Invalid time format',
    Currency: 'Invalid currency value',
    Percentage: 'Invalid percentage',
};

/**
 * Group errors by column type (issue type). Each group represents one validation
 * problem (e.g. "Invalid US phone format") with all columns that have that type
 * and their error counts.
 */
export function computeIssueGroups(
    schema: ColumnSchema[],
    errors: Map<number, Set<number>>
): IssueGroup[] {
    const byType = new Map<ColumnType, { colIdx: number; name: string; errorCount: number }[]>();

    for (let colIdx = 0; colIdx < schema.length; colIdx++) {
        const col = schema[colIdx];
        const count = errors.get(colIdx)?.size ?? 0;
        if (count === 0) continue;

        const list = byType.get(col.detected_type) ?? [];
        list.push({ colIdx, name: col.name, errorCount: count });
        byType.set(col.detected_type, list);
    }

    return Array.from(byType.entries())
        .map(([columnType, columns]) => {
            const totalErrors = columns.reduce((sum, c) => sum + c.errorCount, 0);
            return {
                issueKind: ISSUE_TYPE_LABELS[columnType],
                columnType,
                columns: columns.sort((a, b) => b.errorCount - a.errorCount),
                totalErrors,
            };
        })
        .sort((a, b) => b.totalErrors - a.totalErrors);
}
