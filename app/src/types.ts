export type ColumnType = 'Text' | 'Integer' | 'Float' | 'Boolean' | 'Email' | 'PhoneUS' | 'Date' | 'Uuid' | 'Time' | 'Currency' | 'Percentage';

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
    | { NormalizeStateAbbrev: null }
    | 'NormalizeUuid'
    | 'NormalizeTimeToIso'
    | 'NormalizeCurrency'
    | 'NormalizePercentage';

export interface SuggestionReport {
    suggestion: Suggestion;
    description: string;
    affected_rows_count: number;
    example_before: string;
    example_after: string;
}

// --- Issue-type grouping (TRIAGE / Issues panel) ---

export interface IssueColumnInfo {
    colIdx: number;
    name: string;
    errorCount: number;
}

export interface IssueGroup {
    /** Human-readable issue type, e.g. "Invalid US phone format" */
    issueKind: string;
    /** Column type used for grouping (e.g. PhoneUS, Email) */
    columnType: ColumnType;
    columns: IssueColumnInfo[];
    totalErrors: number;
}

// --- Current process (validate & fix phase: loading, validating, applying fix, etc.) ---

export type ProcessPhase =
  | 'idle'
  | 'loading_file'
  | 'validating'
  | 'applying_fix'
  | 'find_replace'
  | 'analyzing_column'
  | 'validating_column';

export interface CurrentProcess {
  phase: ProcessPhase;
  /** User-visible label, e.g. "Validating…", "Applying fix to Email (Work)…" */
  label: string;
  /** Rows processed so far (for validating, find_replace, applying_fix) */
  rowsProcessed?: number;
  /** Total rows (when known) */
  totalRows?: number;
  /** Throughput: rows per second (computed in worker or main) */
  rowsPerSec?: number;
  /** For find_replace: total cells replaced so far */
  cellsReplaced?: number;
  /** Optional detail: file name, column name, etc. */
  detail?: string;
  /** When process started (ms); optional for ETA */
  startedAt?: number;
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