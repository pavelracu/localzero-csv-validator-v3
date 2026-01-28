use crate::engine::dataframe::DataFrame;
use crate::engine::schema::{ColumnType, ColumnSchema};
use std::io::Cursor;
use csv::ReaderBuilder;

/// Parse raw bytes into a DataFrame and infer types using a lazy scan approach
pub fn parse_csv(data: &[u8]) -> Result<DataFrame, Box<dyn std::error::Error>> {
    // 1. Extract Headers (Parse first line)
    let cursor = Cursor::new(data);
    let mut rdr = ReaderBuilder::new()
        .has_headers(true)
        .from_reader(cursor);

    let headers: Vec<String> = rdr.headers()?.iter().map(|s| s.to_string()).collect();
    
    // Initialize columns
    let columns: Vec<ColumnSchema> = headers.into_iter()
        .map(|name| ColumnSchema {
            name,
            detected_type: ColumnType::Text,
        })
        .collect();

    // 2. Fast Scan for Row Indices
    // We need to skip the header line.
    // Let's find where the first record starts.
    // The reader has read the header. The underlying reader position might be at the start of data?
    // csv::Reader doesn't easily give byte offset of the data start.
    // So we'll scan manually for the first newline.
    
    let mut row_indices = Vec::new();
    let mut current_pos = 0;
    
    // Find end of header
    // Assuming \n or \r\n.
    while current_pos < data.len() {
        if data[current_pos] == b'\n' {
            current_pos += 1;
            break;
        }
        current_pos += 1;
    }
    
    // current_pos is now at the start of the first data row
    if current_pos < data.len() {
        row_indices.push(current_pos);
    }
    
    // Scan the rest
    while current_pos < data.len() {
        if data[current_pos] == b'\n' {
            let next_start = current_pos + 1;
            if next_start < data.len() {
                row_indices.push(next_start);
            }
        }
        current_pos += 1;
    }

    // 3. Create DataFrame
    // We clone the data here. The prompt says "Store raw_data: Vec<u8>". 
    // data is &[u8]. So we must clone.
    let mut df = DataFrame::new(data.to_vec(), row_indices, columns);

    // 4. Infer Types (First 100 rows)
    let col_count = df.columns.len();
    let rows_to_scan = std::cmp::min(df.rows, 100);
    
    for i in 0..col_count {
        let mut sample_values = Vec::new();
        for r in 0..rows_to_scan {
            if let Some(val) = df.get_cell(r, i) {
                sample_values.push(val);
            }
        }
        
        let inferred_type = infer_column_type(&sample_values);
        df.set_column_type(i, inferred_type);
    }

    Ok(df)
}

/// Sample values to guess the type
fn infer_column_type(sample: &[String]) -> ColumnType {
    // We check against these types in order of specificity
    let candidates = [
        ColumnType::Boolean,
        ColumnType::Integer,
        ColumnType::Float,
        ColumnType::Date,
        ColumnType::Email,
        ColumnType::PhoneUS,
    ];

    let non_empty_count = sample.iter().filter(|v| !v.trim().is_empty()).count();

    if non_empty_count == 0 {
        return ColumnType::Text; // Default for empty cols
    }

    for candidate in candidates {
        let match_count = sample.iter()
            .filter(|v| !v.trim().is_empty())
            .filter(|v| candidate.is_valid(v))
            .count();

        // If 90% of non-empty values match, we lock it in
        if (match_count as f64 / non_empty_count as f64) > 0.9 {
            return candidate;
        }
    }

    ColumnType::Text // Fallback
}
