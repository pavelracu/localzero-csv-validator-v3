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
    | { RemoveChars: { chars: string } };

export interface SuggestionReport {
    suggestion: Suggestion;
    description: string;
    affected_rows_count: number;
    example_before: string;
    example_after: string;
}
