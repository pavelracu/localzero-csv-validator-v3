use crate::engine::dataframe::DataFrame;
use crate::engine::schema::{ColumnType, ColumnSchema};
use std::io::Cursor;
use csv::ReaderBuilder;

/// Progress report: call every PROGRESS_INTERVAL bytes during byte scan.
/// Larger interval = fewer JS callbacks and less parse overhead (WASM↔JS is costly).
/// 8MB keeps progress bar smooth (~40–75 updates for 300–600MB) while avoiding 3s+ slowdown.
const PROGRESS_INTERVAL: usize = 8_388_608; // 8MB

/// Parse raw bytes into a DataFrame and infer types using a lazy scan approach.
/// If `progress` is Some, it is called during the byte scan with (bytes_scanned, total_bytes).
pub fn parse_csv<F: FnMut(usize, usize)>(data: &[u8], mut progress: Option<F>) -> Result<DataFrame, Box<dyn std::error::Error>> {
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
    let total = data.len();

    // Find end of header
    while current_pos < data.len() {
        if data[current_pos] == b'\n' {
            current_pos += 1;
            break;
        }
        current_pos += 1;
    }
    if let Some(ref mut p) = progress {
        p(current_pos, total);
    }
    let mut last_progress_at = current_pos;
    
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
        if let Some(ref mut p) = progress {
            if current_pos.saturating_sub(last_progress_at) >= PROGRESS_INTERVAL {
                p(current_pos, total);
                last_progress_at = current_pos;
            }
        }
    }
    if let Some(ref mut p) = progress {
        p(total, total);
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
        ColumnType::Uuid,
        ColumnType::Time,
        ColumnType::Date,
        ColumnType::Email,
        ColumnType::PhoneUS,
        ColumnType::Currency,
        ColumnType::Percentage,
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
