use wasm_bindgen::prelude::*;
use std::sync::Mutex;
use std::time::Instant;
use lazy_static::lazy_static;
use std::collections::HashMap;

mod engine;
use engine::{dataframe::DataFrame, parser::parse_csv, schema::{ColumnType, ColumnSchema}, mechanic, pii, bulk};

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
    match parse_csv(data, Some(|_, _| {})) {
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

/// Load and parse CSV, calling `progress_fn(bytes_processed, total_bytes)` during the byte scan.
/// Use this to drive a progress bar. Progress is reported every ~64KB.
#[wasm_bindgen]
pub fn load_dataset_with_progress(data: &[u8], progress_fn: &js_sys::Function) -> Result<JsValue, JsValue> {
    log(&format!("🚀 Parsing {} bytes (with progress)...", data.len()));
    time("Rust: parse_csv");
    let mut progress_cb = |bytes: usize, total: usize| {
        let _ = progress_fn.call2(
            &JsValue::NULL,
            &JsValue::from(bytes as f64),
            &JsValue::from(total as f64),
        );
    };
    match parse_csv(data, Some(&mut progress_cb)) {
        Ok(df) => {
            timeEnd("Rust: parse_csv");
            let summary = DatasetSummary {
                row_count: df.rows,
                columns: df.columns.clone(),
                file_size_mb: data.len() as f64 / 1_048_576.0,
            };
            let mut store = DATASET.lock().unwrap();
            *store = Some(df);
            Ok(serde_wasm_bindgen::to_value(&summary)?)
        }
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
        // Delegate to DataFrame's optimized zero-copy validator
        let error_flat_list = df.validate_range(start_row, limit);
        
        Ok(serde_wasm_bindgen::to_value(&error_flat_list)?)
    } else {
        Err(JsValue::from_str("No dataset loaded"))
    }
}

#[wasm_bindgen]
pub fn get_suggestions(col_idx: usize) -> Result<JsValue, JsValue> {
    let store = DATASET.lock().unwrap();
    if let Some(df) = &*store {
        let col_type = format!("{:?}", df.columns.get(col_idx).map(|c| c.detected_type));
        log(&format!("[get_suggestions] col_idx={} rows={} col_type={}", col_idx, df.rows, col_type));
        let reports = mechanic::analyze_column(df, col_idx);
        log(&format!("[get_suggestions] returning {} suggestions", reports.len()));
        Ok(serde_wasm_bindgen::to_value(&reports)?)
    } else {
        log("[get_suggestions] no dataset loaded");
        Err(JsValue::from_str("No dataset loaded"))
    }
}

#[wasm_bindgen]
pub fn apply_suggestion(col_idx: usize, suggestion_json: JsValue) -> Result<usize, JsValue> {
    let suggestion: mechanic::Suggestion = serde_wasm_bindgen::from_value(suggestion_json)?;
    let mut store = DATASET.lock().unwrap();
    let start = Instant::now();

    if let Some(df) = store.as_mut() {
        if col_idx >= df.columns.len() {
            return Err(JsValue::from_str("Column index out of bounds"));
        }
        let mut fixed_count = 0;
        let col_type = df.columns[col_idx].detected_type;

        // This is inefficient as it iterates all rows.
        // A better approach would be to iterate only the invalid rows, which we'd need to find first.
        for row_idx in 0..df.rows {
            if let Some(old_val) = df.get_cell(row_idx, col_idx) {
                let (new_val, is_redaction) = match &suggestion {
                    mechanic::Suggestion::TrimWhitespace => (old_val.trim().to_string(), false),
                    mechanic::Suggestion::RemoveChars { chars } => (old_val.replace(chars, ""), false),
                    mechanic::Suggestion::DigitsOnly => (old_val.chars().filter(|c| c.is_ascii_digit()).collect(), false),
                    mechanic::Suggestion::PhoneStripToTenDigits => (mechanic::normalize_phone_to_ten_digits(&old_val), false),
                    mechanic::Suggestion::NormalizeDateToIso => {
                        let trimmed = old_val.trim();
                        let v = if let Ok(d) = chrono::NaiveDate::parse_from_str(trimmed, "%m/%d/%Y") {
                            d.format("%Y-%m-%d").to_string()
                        } else {
                            old_val.clone()
                        };
                        (v, false)
                    },
                    mechanic::Suggestion::NormalizeBooleanCase => (old_val.trim().to_lowercase(), false),
                    mechanic::Suggestion::MaskEmail => (pii::mask_email(&old_val), true),
                    mechanic::Suggestion::RedactSSN => (pii::redact_ssn(&old_val), true),
                    mechanic::Suggestion::RedactCreditCard => (pii::redact_credit_card(&old_val), true),
                    mechanic::Suggestion::ZeroIPv4 => (pii::zero_ipv4(&old_val), true),
                    mechanic::Suggestion::NormalizeBooleanExtended => {
                        let v = mechanic::normalize_boolean_extended(&old_val)
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| old_val.clone());
                        (v, false)
                    },
                    mechanic::Suggestion::NormalizeDateCascade => (mechanic::parse_date_cascade(&old_val), false),
                    mechanic::Suggestion::FuzzyMatchCategorical { master_list, max_distance } => {
                        let v = mechanic::fuzzy_match_best(&old_val, master_list, *max_distance)
                            .unwrap_or_else(|| old_val.clone());
                        (v, false)
                    },
                    mechanic::Suggestion::NormalizeEmail => {
                        let v = pii::normalize_email(&old_val).unwrap_or_else(|| pii::email_remove_duplicate_at(&old_val));
                        (v, false)
                    },
                    mechanic::Suggestion::NormalizePhoneE164 => (
                        mechanic::normalize_phone_e164(&old_val).unwrap_or_else(|| old_val.clone()),
                        false,
                    ),
                    mechanic::Suggestion::FormatPhoneUS => (
                        mechanic::format_phone_us(&old_val).unwrap_or_else(|| old_val.clone()),
                        false,
                    ),
                    mechanic::Suggestion::PadZipLeadingZeros => (
                        mechanic::pad_zip_leading_zeros(&old_val).unwrap_or_else(|| old_val.clone()),
                        false,
                    ),
                    mechanic::Suggestion::NormalizeStateAbbrev => (
                        mechanic::normalize_state_abbrev(&old_val).unwrap_or_else(|| old_val.clone()),
                        false,
                    ),
                    mechanic::Suggestion::NormalizeUuid => (mechanic::normalize_uuid(&old_val), false),
                    mechanic::Suggestion::NormalizeTimeToIso => (
                        mechanic::normalize_time_to_iso(&old_val).unwrap_or_else(|| old_val.clone()),
                        false,
                    ),
                    mechanic::Suggestion::NormalizeCurrency => (mechanic::normalize_currency(&old_val), false),
                    mechanic::Suggestion::NormalizePercentage => (mechanic::normalize_percentage(&old_val), false),
                };

                let should_apply = if is_redaction {
                    let matches = match &suggestion {
                        mechanic::Suggestion::MaskEmail => pii::is_email_like(&old_val),
                        mechanic::Suggestion::RedactSSN => pii::is_ssn_like(&old_val),
                        mechanic::Suggestion::RedactCreditCard => pii::looks_like_credit_card(&old_val),
                        mechanic::Suggestion::ZeroIPv4 => pii::is_ipv4_like(&old_val),
                        _ => false,
                    };
                    matches && new_val != old_val
                } else if matches!(
                    suggestion,
                    mechanic::Suggestion::FuzzyMatchCategorical { .. }
                        | mechanic::Suggestion::NormalizeEmail
                        | mechanic::Suggestion::NormalizePhoneE164
                        | mechanic::Suggestion::PadZipLeadingZeros
                        | mechanic::Suggestion::NormalizeStateAbbrev
                        | mechanic::Suggestion::NormalizeUuid
                        | mechanic::Suggestion::NormalizeTimeToIso
                        | mechanic::Suggestion::NormalizeCurrency
                        | mechanic::Suggestion::NormalizePercentage
                ) {
                    new_val != old_val
                } else {
                    !col_type.is_valid(&old_val) && new_val != old_val && col_type.is_valid(&new_val)
                };

                if should_apply {
                    df.patches
                        .entry(row_idx)
                        .or_insert_with(HashMap::new)
                        .insert(col_idx, new_val);
                    fixed_count += 1;
                }
            }
        }
        let ms = start.elapsed().as_millis();
        log(&format!("[apply_suggestion] col_idx={} rows={} count={} ms={}", col_idx, df.rows, fixed_count, ms));
        Ok(fixed_count)
    } else {
        Err(JsValue::from_str("No dataset loaded"))
    }
}

#[wasm_bindgen]
pub fn apply_bulk_action(col_idx: usize, action_json: JsValue) -> Result<usize, JsValue> {
    let action: bulk::BulkAction = serde_wasm_bindgen::from_value(action_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid bulk action: {}", e)))?;

    // Compile regex once for RegexReplace to avoid O(rows) compilation and OOM
    let compiled_regex = bulk::compile_regex_for_action(&action)
        .map_err(|e| JsValue::from_str(&format!("Invalid regex: {}", e)))?;

    let mut store = DATASET.lock().unwrap();
    let start = Instant::now();
    if let Some(df) = store.as_mut() {
        if col_idx >= df.columns.len() {
            return Err(JsValue::from_str("Column index out of bounds"));
        }
        let mut changed_count = 0;
        for row_idx in 0..df.rows {
            if let Some(old_val) = df.get_cell(row_idx, col_idx) {
                match bulk::apply_to_cell(&old_val, &action, compiled_regex.as_ref()) {
                    Ok(new_val) => {
                        if new_val != old_val {
                            df.patches
                                .entry(row_idx)
                                .or_insert_with(HashMap::new)
                                .insert(col_idx, new_val);
                            changed_count += 1;
                        }
                    }
                    Err(e) => return Err(JsValue::from_str(&format!("Regex error: {}", e))),
                }
            }
        }
        let ms = start.elapsed().as_millis();
        log(&format!("[apply_bulk_action] col_idx={} rows={} count={} ms={}", col_idx, df.rows, changed_count, ms));
        Ok(changed_count)
    } else {
        Err(JsValue::from_str("No dataset loaded"))
    }
}

#[wasm_bindgen]
pub fn apply_correction(col_idx: usize, strategy: &str) -> Result<usize, JsValue> {
    let mut store = DATASET.lock().unwrap();
    let start = Instant::now();

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

        let ms = start.elapsed().as_millis();
        log(&format!("[apply_correction] col_idx={} strategy={} count={} ms={}", col_idx, strategy, fixed_count, ms));
        Ok(fixed_count)
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
            "Uuid" => ColumnType::Uuid,
            "Time" => ColumnType::Time,
            "Currency" => ColumnType::Currency,
            "Percentage" => ColumnType::Percentage,
            _ => return Err(JsValue::from_str(&format!("Unknown type: {}", type_name))),
        };

        // 2. Update the Schema in Memory
        df.set_column_type(col_idx, new_type);

        // 3. Scan the column and find invalid rows
        time("Rust: validate_column_fast");
        let error_indices = df.validate_column_fast(col_idx, new_type);
        timeEnd("Rust: validate_column_fast");
        
        // Return the list of Row IDs that failed
        Ok(error_indices)
    } else {
        Err(JsValue::from_str("No dataset loaded"))
    }
}

#[wasm_bindgen]
pub fn update_schema(schema_js: JsValue) -> Result<(), JsValue> {
    let schema: Vec<ColumnSchema> = serde_wasm_bindgen::from_value(schema_js)
        .map_err(|e| JsValue::from_str(&format!("Failed to deserialize schema: {}", e)))?;
    
    let mut store = DATASET.lock().unwrap();
    if let Some(df) = store.as_mut() {
        if df.columns.len() == schema.len() {
            df.columns = schema;
        } else {
            return Err(JsValue::from_str("Schema length mismatch"));
        }
    }
    Ok(())
}

#[wasm_bindgen]
pub fn update_cell(row_idx: usize, col_idx: usize, value: String) -> Result<(), JsValue> {
    let start = Instant::now();
    let mut store = DATASET.lock().unwrap();
    if let Some(df) = store.as_mut() {
        df.update_cell(row_idx, col_idx, value)
            .map_err(|e| JsValue::from_str(&e))?;
        let ms = start.elapsed().as_millis();
        log(&format!("[update_cell] row={} col={} ms={}", row_idx, col_idx, ms));
        Ok(())
    } else {
        Err(JsValue::from_str("No dataset loaded"))
    }
}

/// Process find/replace for a range of rows only. Used by the worker to chunk work and avoid
/// long-running single calls that can hit "unreachable" (stack/timeout) on large datasets.
/// Uses one CSV Reader per chunk (streaming), like validate_range, instead of one Reader per row.
#[wasm_bindgen]
pub fn find_replace_range(start_row: usize, row_limit: usize, find: &str, replace: &str) -> Result<u32, JsValue> {
    let mut store = DATASET.lock().unwrap();
    if let Some(df) = store.as_mut() {
        df.find_replace_range(start_row, row_limit, find, replace)
            .map_err(|e| JsValue::from_str(&e))
    } else {
        Err(JsValue::from_str("No dataset loaded"))
    }
}

#[wasm_bindgen]
pub fn find_replace_all(find: &str, replace: &str) -> Result<u32, JsValue> {
    let find = find.to_string();
    let replace = replace.to_string();
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        find_replace_all_inner(&find, &replace)
    }));
    match result {
        Ok(Ok(count)) => Ok(count),
        Ok(Err(e)) => Err(e),
        Err(panic_payload) => {
            let msg = format!("find_replace_all panic: {:?}", panic_payload);
            log(&msg);
            Err(JsValue::from_str(&msg))
        }
    }
}

fn find_replace_all_inner(find: &str, replace: &str) -> Result<u32, JsValue> {
    let mut store = DATASET.lock().unwrap();
    if let Some(df) = store.as_mut() {
        let start = Instant::now();
        let rows = df.rows;
        let cols = df.columns.len();
        let total_cells = rows.checked_mul(cols).unwrap_or(0);
        let count = df.find_replace_range(0, rows, find, replace)
            .map_err(|e| JsValue::from_str(&e))?;

        let ms = start.elapsed().as_millis();
        let cells_per_ms = if ms > 0 && total_cells > 0 {
            (total_cells as f64) / (ms as f64)
        } else {
            0.0
        };
        log(&format!(
            "[find_replace_all] rows={} cols={} cells={} replaced={} ms={} cells_per_ms={:.1}",
            rows, cols, total_cells, count, ms, cells_per_ms
        ));
        Ok(count)
    } else {
        Err(JsValue::from_str("No dataset loaded"))
    }
}
