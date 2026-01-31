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

        // 3. Get from Raw Data (use get to avoid panic on bad index)
        let start = match self.row_indices.get(row_idx) {
            Some(&s) => s,
            None => return None,
        };

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

    pub fn update_cell(&mut self, row_idx: usize, col_idx: usize, value: String) -> Result<(), String> {
        if row_idx >= self.rows {
            return Err(format!("Row index {} out of bounds (max: {})", row_idx, self.rows - 1));
        }
        if col_idx >= self.columns.len() {
            return Err(format!("Column index {} out of bounds (max: {})", col_idx, self.columns.len() - 1));
        }
        
        self.patches
            .entry(row_idx)
            .or_insert_with(HashMap::new)
            .insert(col_idx, value);
        
        Ok(())
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

    pub fn validate_range(&self, start_row: usize, limit: usize) -> Vec<usize> {
        let mut errors = Vec::new();
        if start_row >= self.rows {
            return errors;
        }

        let start_byte = self.row_indices[start_row];
        let slice = &self.raw_data[start_byte..];
        let cursor = Cursor::new(slice);
        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .from_reader(cursor);
        
        let mut record = StringRecord::new();
        
        for i in 0..limit {
            let current_row = start_row + i;
            if current_row >= self.rows {
                break;
            }
            
            // Read into reusable record
            if !reader.read_record(&mut record).unwrap_or(false) {
                break;
            }

            for (col_idx, column) in self.columns.iter().enumerate() {
                // 1. Check Patch
                let mut is_patched = false;
                if let Some(row_patches) = self.patches.get(&current_row) {
                     if let Some(patch_val) = row_patches.get(&col_idx) {
                         is_patched = true;
                         if !column.detected_type.is_valid_fast(patch_val) {
                             errors.push(current_row);
                             errors.push(col_idx);
                         }
                     }
                }

                // 2. Check Raw
                if !is_patched {
                    if let Some(val) = record.get(col_idx) {
                        if !column.detected_type.is_valid_fast(val) {
                            errors.push(current_row);
                            errors.push(col_idx);
                        }
                    }
                }
            }
        }
        errors
    }

    /// Find/replace over a range of rows using one CSV Reader (streaming), like validate_range.
    /// Returns the number of cells updated.
    pub fn find_replace_range(&mut self, start_row: usize, row_limit: usize, find: &str, replace: &str) -> Result<u32, String> {
        if start_row >= self.rows {
            return Ok(0);
        }
        let cols = self.columns.len();
        let end_row = std::cmp::min(start_row.saturating_add(row_limit), self.rows);

        let start_byte = match self.row_indices.get(start_row) {
            Some(&b) => b,
            None => return Ok(0),
        };
        let slice = &self.raw_data[start_byte..];
        let cursor = Cursor::new(slice);
        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .from_reader(cursor);

        let mut record = StringRecord::new();
        let mut updates: Vec<(usize, usize, String)> = Vec::new();

        for i in 0..(end_row - start_row) {
            let current_row = start_row + i;
            if !reader.read_record(&mut record).unwrap_or(false) {
                break;
            }

            for col_idx in 0..cols {
                let val: String = if let Some(row_patches) = self.patches.get(&current_row) {
                    if let Some(patched) = row_patches.get(&col_idx) {
                        patched.clone()
                    } else {
                        record.get(col_idx).map(|s| s.to_string()).unwrap_or_default()
                    }
                } else {
                    record.get(col_idx).map(|s| s.to_string()).unwrap_or_default()
                };
                let new_val = val.replace(find, replace);
                if new_val != val {
                    updates.push((current_row, col_idx, new_val));
                }
            }
        }

        let count = updates.len() as u32;
        for (row, col, val) in updates {
            self.update_cell(row, col, val)?;
        }
        Ok(count)
    }

    pub fn validate_column_fast(&self, col_idx: usize, col_type: ColumnType) -> Vec<usize> {
        let mut error_indices = Vec::new();

        let cursor = Cursor::new(&self.raw_data);
        let mut reader = csv::ReaderBuilder::new()
            .has_headers(true) // Assumes headers are present, adjust if needed
            .from_reader(cursor);

        // We iterate with an index to get the row number
        for (row_idx, result) in reader.records().enumerate() {
            match result {
                Ok(record) => {
                    let mut is_valid = true;
                    let mut is_patched = false;

                    // 1. Check Patches first
                    if let Some(row_patches) = self.patches.get(&row_idx) {
                        if let Some(patch_val) = row_patches.get(&col_idx) {
                            is_patched = true;
                            if !col_type.is_valid_fast(patch_val) {
                                is_valid = false;
                            }
                        }
                    }

                    // 2. Check Raw if not patched
                    if !is_patched {
                        if let Some(val) = record.get(col_idx) {
                            if !col_type.is_valid_fast(val) {
                                is_valid = false;
                            }
                        } else {
                            // This case means the record has fewer columns than col_idx, which is an error
                            is_valid = false;
                        }
                    }

                    if !is_valid {
                        error_indices.push(row_idx);
                    }
                }
                Err(_) => {
                    // This row is malformed, so it's an error.
                    error_indices.push(row_idx);
                }
            }
        }

        error_indices
    }
}
