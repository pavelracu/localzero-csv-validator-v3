use std::collections::HashMap;
use serde::Serialize;
use crate::engine::schema::{ColumnSchema, ColumnType};
use std::io::Cursor;
use csv::StringRecord;

#[derive(Debug, Serialize)]
pub struct DataFrame {
    #[serde(skip)]
    pub raw_data: Vec<u8>,
    #[serde(skip)]
    pub row_indices: Vec<usize>, // Start byte of every row
    pub columns: Vec<ColumnSchema>,
    // Map<RowIndex, Map<ColIndex, NewValue>>
    pub patches: HashMap<usize, HashMap<usize, String>>,
    pub rows: usize,
}

impl DataFrame {
    pub fn new(raw_data: Vec<u8>, row_indices: Vec<usize>, columns: Vec<ColumnSchema>) -> Self {
        let rows = row_indices.len();
        DataFrame {
            raw_data,
            row_indices,
            columns,
            patches: HashMap::new(),
            rows,
        }
    }

    pub fn get_cell(&self, row_idx: usize, col_idx: usize) -> Option<String> {
        // 1. Check Patches
        if let Some(row_patches) = self.patches.get(&row_idx) {
            if let Some(val) = row_patches.get(&col_idx) {
                return Some(val.clone());
            }
        }

        // 2. Check Bounds
        if row_idx >= self.rows || col_idx >= self.columns.len() {
            return None;
        }

        // 3. Get from Raw Data
        let start = self.row_indices[row_idx];
        
        // Slice from 'start' to the end. csv::Reader will read just the first record.
        let slice = &self.raw_data[start..];
        let cursor = Cursor::new(slice);
        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .from_reader(cursor);
        
        let mut record = StringRecord::new();
        // read_record returns true if a record was read
        if reader.read_record(&mut record).unwrap_or(false) {
             return record.get(col_idx).map(|s| s.to_string());
        }

        None
    }
    
    pub fn set_column_type(&mut self, col_idx: usize, new_type: ColumnType) {
        if col_idx < self.columns.len() {
            self.columns[col_idx].detected_type = new_type;
        }
    }

    // Helper to get a full row (merging raw + patches)
    pub fn get_row(&self, row_idx: usize) -> Option<Vec<String>> {
         if row_idx >= self.rows {
            return None;
        }
        
        let mut row_values = Vec::with_capacity(self.columns.len());
        
        // Optimization: We could read the raw row once, then apply patches.
        // But for consistency with get_cell, we can also iterate cols.
        // Let's read raw first to avoid N parsings.
        
        let start = self.row_indices[row_idx];
        let slice = &self.raw_data[start..];
        let cursor = Cursor::new(slice);
        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .from_reader(cursor);
        
        let mut record = StringRecord::new();
        let has_raw = reader.read_record(&mut record).unwrap_or(false);
        
        for col_idx in 0..self.columns.len() {
            // Check patch
            if let Some(row_patches) = self.patches.get(&row_idx) {
                if let Some(val) = row_patches.get(&col_idx) {
                    row_values.push(val.clone());
                    continue;
                }
            }
            
            // Use raw
            if has_raw {
                row_values.push(record.get(col_idx).unwrap_or("").to_string());
            } else {
                row_values.push("".to_string());
            }
        }
        
        Some(row_values)
    }
}
