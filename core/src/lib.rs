use wasm_bindgen::prelude::*;
use std::sync::Mutex;
use lazy_static::lazy_static;
use std::collections::HashMap;

mod engine;
use engine::{dataframe::DataFrame, parser::parse_csv, schema::{ColumnType, ColumnSchema}};

// GLOBAL STATE (The "Database" in Memory)
lazy_static! {
    static ref DATASET: Mutex<Option<DataFrame>> = Mutex::new(None);
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    fn time(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    fn timeEnd(s: &str);
}

#[derive(serde::Serialize)]
pub struct DatasetSummary {
    pub row_count: usize,
    #[serde(rename = "schema")]
    pub columns: Vec<ColumnSchema>,
    pub file_size_mb: f64,
}

#[wasm_bindgen]
pub fn load_dataset(data: &[u8]) -> Result<JsValue, JsValue> {
    log(&format!("🚀 Parsing {} bytes...", data.len()));

    // 1. Parse and Infer
    time("Rust: parse_csv");
    match parse_csv(data) {
        Ok(df) => {
            timeEnd("Rust: parse_csv");
            let summary = DatasetSummary {
                row_count: df.rows,
                columns: df.columns.clone(),
                file_size_mb: data.len() as f64 / 1_048_576.0,
            };

            // 2. Store in Global Mutex
            let mut store = DATASET.lock().unwrap();
            *store = Some(df);

            // 3. Return Summary to JS
            Ok(serde_wasm_bindgen::to_value(&summary)?)
        },
        Err(e) => {
            timeEnd("Rust: parse_csv");
            Err(JsValue::from_str(&format!("Parse error: {}", e)))
        }
    }
}

// NEW: Fetch a slice of rows for the Virtual Table
#[wasm_bindgen]
pub fn get_rows(start: usize, limit: usize) -> Result<JsValue, JsValue> {
    let store = DATASET.lock().unwrap();
    if let Some(df) = &*store {
        let end = std::cmp::min(start + limit, df.rows);
        let mut result = Vec::new();

        // Build array of objects for JS: [{ "id": "1", "name": "Alice" }, ...]
        for i in start..end {
            // Use get_row helper which handles raw data + patches
            if let Some(row_vec) = df.get_row(i) {
                // Map column names to values
                let mut row_obj = serde_json::Map::new();
                for (col_idx, val) in row_vec.iter().enumerate() {
                    let col_name = &df.columns[col_idx].name;
                    row_obj.insert(col_name.clone(), serde_json::Value::String(val.clone()));
                }
                result.push(serde_json::Value::Object(row_obj));
            }
        }
        Ok(serde_wasm_bindgen::to_value(&result)?)
    } else {
        Ok(JsValue::NULL)
    }
}

#[wasm_bindgen]
pub fn validate_chunk(start_row: usize, limit: usize) -> Result<JsValue, JsValue> {
    let store = DATASET.lock().unwrap();
    if let Some(df) = &*store {
        let end = std::cmp::min(start_row + limit, df.rows);
        // Map<ColIndex, Vec<RowIndex>>
        let mut col_errors: HashMap<usize, Vec<usize>> = HashMap::new();

        for row_idx in start_row..end {
            for col_idx in 0..df.columns.len() {
                 if let Some(val) = df.get_cell(row_idx, col_idx) {
                     let col_type = &df.columns[col_idx].detected_type;
                     if !col_type.is_valid(&val) {
                         col_errors.entry(col_idx).or_insert_with(Vec::new).push(row_idx);
                     }
                 }
            }
        }
        
        Ok(serde_wasm_bindgen::to_value(&col_errors)?)
    } else {
        Err(JsValue::from_str("No dataset loaded"))
    }
}

#[wasm_bindgen]
pub fn apply_correction(col_idx: usize, strategy: &str) -> Result<usize, JsValue> {
    let mut store = DATASET.lock().unwrap();
    
    if let Some(df) = store.as_mut() {
        let mut fixed_count = 0;
        let col_type = df.columns[col_idx].detected_type;

        // We need to collect indices first to avoid borrowing conflict (mutable borrow of patches vs immutable borrow for get_cell)
        // Actually, get_cell borrows self immutably. modifying patches borrows self mutably.
        // So we must do this in two passes or be clever.
        // Pass 1: Find invalid rows
        let mut invalid_rows = Vec::new();
        for row_idx in 0..df.rows {
            if let Some(val) = df.get_cell(row_idx, col_idx) {
                if !col_type.is_valid(&val) {
                    invalid_rows.push(row_idx);
                }
            }
        }

        // Pass 2: Apply fixes
        for row_idx in invalid_rows {
            match strategy {
                "clear" => {
                    // Set to empty string
                    df.patches
                        .entry(row_idx)
                        .or_insert_with(HashMap::new)
                        .insert(col_idx, "".to_string());
                    fixed_count += 1;
                },
                "revert" => {
                    // Remove from patches (if exists)
                    if let Some(row_patches) = df.patches.get_mut(&row_idx) {
                        if row_patches.remove(&col_idx).is_some() {
                             fixed_count += 1;
                        }
                        // Clean up empty row map if needed? Not strictly necessary but good for memory.
                        if row_patches.is_empty() {
                            df.patches.remove(&row_idx);
                        }
                    }
                },
                _ => return Err(JsValue::from_str(&format!("Unknown strategy: {}", strategy))),
            }
        }

        Ok(fixed_count)
    } else {
        Err(JsValue::from_str("No dataset loaded"))
    }
}

#[wasm_bindgen]
pub fn update_cell(row_idx: usize, col_idx: usize, value: String) -> Result<bool, JsValue> {
    let mut store = DATASET.lock().unwrap();
    if let Some(df) = store.as_mut() {
        // 1. Update Patch
        df.patches
            .entry(row_idx)
            .or_insert_with(HashMap::new)
            .insert(col_idx, value.clone());
            
        // 2. Validate
        let col_type = &df.columns[col_idx].detected_type;
        let is_valid = col_type.is_valid(&value);
        
        Ok(is_valid)
    } else {
         Err(JsValue::from_str("No dataset loaded"))
    }
}

#[wasm_bindgen]
pub fn validate_column(col_idx: usize, type_name: &str) -> Result<Vec<usize>, JsValue> {
    let mut store = DATASET.lock().unwrap();
    
    if let Some(df) = store.as_mut() {
        // 1. Map the string from JS ("Integer") to our Rust Enum
        let new_type = match type_name {
            "Text" => ColumnType::Text,
            "Integer" => ColumnType::Integer,
            "Float" => ColumnType::Float,
            "Boolean" => ColumnType::Boolean,
            "Email" => ColumnType::Email,
            "PhoneUS" => ColumnType::PhoneUS,
            "Date" => ColumnType::Date,
            _ => return Err(JsValue::from_str(&format!("Unknown type: {}", type_name))),
        };

        // 2. Update the Schema in Memory
        df.set_column_type(col_idx, new_type);

        // 3. Scan the column and find invalid rows
        let mut error_indices = Vec::new();
        
        // Iterate over all rows (lazy scan)
        for row_idx in 0..df.rows {
            if let Some(val) = df.get_cell(row_idx, col_idx) {
                if !new_type.is_valid(&val) {
                    error_indices.push(row_idx);
                }
            }
        }
        
        // Return the list of Row IDs that failed
        Ok(error_indices)
    } else {
        Err(JsValue::from_str("No dataset loaded"))
    }
}
