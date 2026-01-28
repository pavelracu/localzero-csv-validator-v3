use wasm_bindgen::prelude::*;
use std::sync::Mutex;
use lazy_static::lazy_static;
use engine::schema::{ColumnType, ColumnSchema};
use engine::dataframe::DataFrame;

mod engine;
mod rules; // Assuming rules existed before, or I should comment it out if not needed.
// The file listing showed 'rules' directory.

lazy_static! {
    static ref DATASET: Mutex<Option<DataFrame>> = Mutex::new(None);
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub struct DatasetSummary {
    pub row_count: usize,
    pub file_size_mb: f64,
    schema: JsValue,
}

#[wasm_bindgen]
impl DatasetSummary {
    #[wasm_bindgen(getter)]
    pub fn schema(&self) -> JsValue {
        self.schema.clone()
    }
}

#[wasm_bindgen]
pub fn load_dataset(data: &[u8]) -> Result<DatasetSummary, JsValue> {
    let size_mb = data.len() as f64 / 1_024.0 / 1_024.0;
    log(&format!("🚀 Rust received {} bytes ({:.2} MB)", data.len(), size_mb));

    match engine::parser::parse_csv(data) {
        Ok(df) => {
            let row_count = df.rows_count();
            let schema_val = serde_wasm_bindgen::to_value(&df.schema)
                .map_err(|e| JsValue::from_str(&e.to_string()))?;

            let mut global_df = DATASET.lock().map_err(|_| JsValue::from_str("Failed to lock dataset"))?;
            *global_df = Some(df);

            Ok(DatasetSummary {
                row_count,
                file_size_mb: size_mb,
                schema: schema_val,
            })
        },
        Err(e) => {
            log(&format!("Error parsing CSV: {}", e));
            Err(JsValue::from_str(&format!("Parsing error: {}", e)))
        }
    }
}

#[wasm_bindgen]
pub fn get_rows(start: usize, count: usize) -> Result<JsValue, JsValue> {
    let global_df = DATASET.lock().map_err(|_| JsValue::from_str("Failed to lock dataset"))?;
    
    if let Some(df) = &*global_df {
        let end = std::cmp::min(start + count, df.records.len());
        if start >= df.records.len() {
             return Ok(serde_wasm_bindgen::to_value(&Vec::<Vec<String>>::new()).unwrap());
        }

        let slice = &df.records[start..end];
        // Convert to Vec<Vec<String>> or Vec<Object>
        // Let's return Vec<Vec<String>> (array of arrays) for simplicity/speed
        // Or better, Vec<Object> (key-value) if the table expects it.
        // TanStack table usually wants objects, but array of arrays is fine if mapped.
        // Let's do Array of Arrays for raw speed and simplicity here.
        
        // Wait, VirtualizedTable needs to know which index is which column.
        // Array of arrays is safest.
        
        let mut result = Vec::with_capacity(end - start);
        for record in slice {
            let row: Vec<String> = record.iter().map(|s| s.to_string()).collect();
            result.push(row);
        }
        
        serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
    } else {
        Err(JsValue::from_str("No dataset loaded"))
    }
}

#[wasm_bindgen]
pub fn validate_column(col_index: usize, new_type_str: &str) -> Result<Vec<usize>, JsValue> {
    // Parse new_type string to ColumnType
    // We need to implement FromStr or just match string
    let new_type = match new_type_str {
        "Text" => ColumnType::Text,
        "Integer" => ColumnType::Integer,
        "Float" => ColumnType::Float,
        "Boolean" => ColumnType::Boolean,
        "Email" => ColumnType::Email,
        "PhoneUS" => ColumnType::PhoneUS,
        "Date" => ColumnType::Date,
        _ => return Err(JsValue::from_str("Invalid column type")),
    };

    let mut global_df = DATASET.lock().map_err(|_| JsValue::from_str("Failed to lock dataset"))?;
    
    if let Some(df) = &mut *global_df {
        if col_index >= df.schema.len() {
            return Err(JsValue::from_str("Column index out of bounds"));
        }

        // Update schema
        df.schema[col_index].detected_type = new_type;

        // Validate
        let mut invalid_rows = Vec::new();
        for (row_idx, record) in df.records.iter().enumerate() {
            if let Some(val) = record.get(col_index) {
                // Skip empty values? The is_valid implementation assumes empty is valid.
                // If we want to enforce required, that's a separate rule.
                if !new_type.is_valid(val) {
                    invalid_rows.push(row_idx);
                }
            }
        }
        
        // Return indices as Uint32Array or similar? Vec<usize> converts to array.
        Ok(invalid_rows)
    } else {
        Err(JsValue::from_str("No dataset loaded"))
    }
}
