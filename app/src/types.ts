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
