export type ColumnType = 'Text' | 'Integer' | 'Float' | 'Boolean' | 'Email' | 'PhoneUS' | 'Date';

export interface ColumnSchema {
    name: string;
    detected_type: ColumnType;
}

export interface DatasetSummary {
    row_count: number;
    file_size_mb: number;
    schema: ColumnSchema[];
}

export type Suggestion =
    | 'TrimWhitespace'
    | { RemoveChars: { chars: string } }
    | { DigitsOnly: null }
    | { PhoneStripToTenDigits: null }
    | { NormalizeDateToIso: null }
    | { NormalizeBooleanCase: null }
    | { MaskEmail: null }
    | { RedactSSN: null }
    | { RedactCreditCard: null }
    | { ZeroIPv4: null }
    | { NormalizeBooleanExtended: null }
    | { NormalizeDateCascade: null }
    | { FuzzyMatchCategorical: { master_list: string[]; max_distance: number } }
    | { NormalizeEmail: null }
    | { NormalizePhoneE164: null }
    | { FormatPhoneUS: null }
    | { PadZipLeadingZeros: null }
    | { NormalizeStateAbbrev: null };

export interface SuggestionReport {
    suggestion: Suggestion;
    description: string;
    affected_rows_count: number;
    example_before: string;
    example_after: string;
}

export interface SchemaPreset {
    id: string;
    name: string;
    mapping: Record<string, ColumnType>; // ColumnName -> Type mapping
    lastUsed: number;
}

// --- Workspace / session persistence (metadata only, no file content) ---

export interface FileMetadata {
    name: string;
    size: number;
    hash?: string;
}

export interface TriageLogEntry {
    at: number;       // timestamp
    colIdx: number;
    action: string;   // e.g. 'applyCorrection' | 'applySuggestion' | 'updateCell'
    suggestion?: string;
}

export interface WorkspaceMeta {
    id: string;
    createdAt: number;
    updatedAt: number;
    fileMetadata: FileMetadata;
    schemaSnapshot: Record<string, ColumnType>;
    triageLog: TriageLogEntry[];
    /** Permanently rejected row indices (excluded from export / triage). */
    rejectedRowIndices?: number[];
    /** Placeholder for JS-composed primitive predicates (e.g. Equals, MatchesRegex). */
    customRules?: unknown[];
}