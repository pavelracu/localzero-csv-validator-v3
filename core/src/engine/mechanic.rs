use serde::{Serialize, Deserialize};
use std::collections::{HashMap, HashSet};
use super::dataframe::DataFrame;
use super::schema::ColumnType;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Suggestion {
    TrimWhitespace,
    RemoveChars { chars: String },
    DigitsOnly,
    /// Strip to digits then take 10 digits (drop country code 1 and/or extension)
    PhoneStripToTenDigits,
    NormalizeDateToIso,
    NormalizeBooleanCase,
}

/// Normalize phone to 10 digits only when there are clearly extra digits (extension).
/// High-confidence: we only take first 10 when len > 11 (obvious extension, e.g. x46270).
/// We do NOT transform 11-digit numbers (could be 1+10 or 10+extension) — that would be guessing.
pub fn normalize_phone_to_ten_digits(s: &str) -> String {
    let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() == 10 {
        digits
    } else if digits.len() > 11 {
        digits[..10].to_string()
    } else {
        s.to_string()
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct SuggestionReport {
    pub suggestion: Suggestion,
    pub description: String,
    pub affected_rows_count: usize,
    pub example_before: String,
    pub example_after: String,
}

pub fn analyze_column(df: &DataFrame, col_idx: usize) -> Vec<SuggestionReport> {
    let mut suggestions = Vec::new();
    let col_schema = &df.columns[col_idx];
    let col_type = col_schema.detected_type;

    // 1. Single pass: sample invalid values and count per-heuristic fixes (avoids 4+ full scans)
    const MAX_UNIQUE_INVALID_SAMPLE: usize = 30_000;
    const MAX_ROWS_TO_SCAN: usize = 50_000; // Cap so suggestions appear quickly
    let mut invalid_values = HashSet::new();
    let rows_to_scan = df.rows.min(MAX_ROWS_TO_SCAN);

    let mut trim_count: usize = 0;
    let mut email_space_count: usize = 0;
    let mut phone_digits_count: usize = 0;
    let mut phone_strip_count: usize = 0;
    let mut date_count: usize = 0;
    let mut bool_count: usize = 0;

    let mut trim_example_before = String::new();
    let mut trim_example_after = String::new();

    for row_idx in 0..rows_to_scan {
        if invalid_values.len() >= MAX_UNIQUE_INVALID_SAMPLE {
            break;
        }
        if let Some(val) = df.get_cell(row_idx, col_idx) {
            if val.is_empty() || col_type.is_valid(&val) {
                continue;
            }
            invalid_values.insert(val.clone());

            let trimmed = val.trim();
            if !trimmed.is_empty() && trimmed != val && col_type.is_valid(trimmed) {
                trim_count += 1;
                if trim_example_before.is_empty() {
                    trim_example_before = val.clone();
                    trim_example_after = trimmed.to_string();
                }
            }
            if col_type == ColumnType::Email && val.contains(' ') {
                let after = val.replace(' ', "");
                if col_type.is_valid(&after) {
                    email_space_count += 1;
                }
            }
            if col_type == ColumnType::PhoneUS {
                let digits: String = val.chars().filter(|c| c.is_ascii_digit()).collect();
                if digits != val && col_type.is_valid(&digits) {
                    phone_digits_count += 1;
                }
                let strip = normalize_phone_to_ten_digits(&val);
                if strip != val && col_type.is_valid(&strip) {
                    phone_strip_count += 1;
                }
            }
            if col_type == ColumnType::Date {
                if let Ok(d) = chrono::NaiveDate::parse_from_str(trimmed, "%m/%d/%Y") {
                    let iso = d.format("%Y-%m-%d").to_string();
                    if col_type.is_valid(&iso) && iso != trimmed {
                        date_count += 1;
                    }
                }
            }
            if col_type == ColumnType::Boolean {
                let lower = trimmed.to_lowercase();
                if (lower == "true" || lower == "false") && lower != trimmed {
                    bool_count += 1;
                }
            }
        }
    }

    if invalid_values.is_empty() {
        return suggestions;
    }

    // --- HEURISTICS (examples from invalid_values, counts from single pass above) ---

    if trim_count > 0 && !trim_example_before.is_empty() {
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::TrimWhitespace,
            description: format!("Trim whitespace from {} cells", trim_count),
            affected_rows_count: trim_count,
            example_before: trim_example_before,
            example_after: trim_example_after,
        });
    }

    // 3. Numeric character removal heuristic
    if col_type == ColumnType::Integer || col_type == ColumnType::Float {
        let mut char_counts = HashMap::new();
        for val in &invalid_values {
            for ch in val.chars().filter(|c| !c.is_alphanumeric() && !c.is_whitespace() && *c != '.' && *c != '-') {
                 *char_counts.entry(ch).or_insert(0) += 1;
            }
        }

        // Sort by frequency
        let mut sorted_chars: Vec<_> = char_counts.into_iter().collect();
        sorted_chars.sort_by(|a, b| b.1.cmp(&a.1));

        // Create suggestions for the top 3 most common invalid chars
        for (char_to_remove, _) in sorted_chars.iter().take(3) {
            let mut example_before = String::new();
            let mut example_after = String::new();
            let mut affected_unique_values = 0;

            for val in &invalid_values {
                if val.contains(*char_to_remove) {
                    let after = val.replace(*char_to_remove, "");
                    if !after.is_empty() && col_type.is_valid(&after) {
                        if example_before.is_empty() {
                            example_before = val.clone();
                            example_after = after;
                        }
                        affected_unique_values += 1;
                    }
                }
            }

            if affected_unique_values > 0 {
                let mut total_affected = 0;
                for row_idx in 0..rows_to_scan {
                     if let Some(val) = df.get_cell(row_idx, col_idx) {
                         if val.contains(*char_to_remove) {
                             let after = val.replace(*char_to_remove, "");
                             if !after.is_empty() && col_type.is_valid(&after) {
                                 total_affected += 1;
                             }
                         }
                     }
                }
                if total_affected > 0 {
                    suggestions.push(SuggestionReport {
                        suggestion: Suggestion::RemoveChars { chars: char_to_remove.to_string() },
                        description: format!("Remove character '{}' from {} cells", char_to_remove, total_affected),
                        affected_rows_count: total_affected,
                        example_before,
                        example_after,
                    });
                }
            }
        }
    }

    if col_type == ColumnType::Email && email_space_count > 0 {
        let mut example_before = String::new();
        let mut example_after = String::new();
        for val in &invalid_values {
            if val.contains(' ') {
                let after = val.replace(' ', "");
                if col_type.is_valid(&after) {
                    example_before = val.clone();
                    example_after = after;
                    break;
                }
            }
        }
        if !example_before.is_empty() {
            suggestions.push(SuggestionReport {
                suggestion: Suggestion::RemoveChars { chars: " ".to_string() },
                description: format!("Remove spaces from {} emails", email_space_count),
                affected_rows_count: email_space_count,
                example_before,
                example_after,
            });
        }
    }

    if col_type == ColumnType::PhoneUS {
        let mut digits_example_before = String::new();
        let mut digits_example_after = String::new();
        let mut strip_example_before = String::new();
        let mut strip_example_after = String::new();
        for val in &invalid_values {
            let after_d: String = val.chars().filter(|c| c.is_ascii_digit()).collect();
            if after_d != *val && col_type.is_valid(&after_d) {
                if digits_example_before.is_empty() {
                    digits_example_before = val.clone();
                    digits_example_after = after_d;
                }
            }
            let after_s = normalize_phone_to_ten_digits(val.as_str());
            if after_s != *val && col_type.is_valid(&after_s) {
                if strip_example_before.is_empty() {
                    strip_example_before = val.clone();
                    strip_example_after = after_s;
                }
            }
        }
        if phone_digits_count > 0 && !digits_example_before.is_empty() {
            suggestions.push(SuggestionReport {
                suggestion: Suggestion::DigitsOnly,
                description: format!("Remove formatting from {} phone numbers", phone_digits_count),
                affected_rows_count: phone_digits_count,
                example_before: digits_example_before,
                example_after: digits_example_after,
            });
        }
        if phone_strip_count > 0 && !strip_example_before.is_empty() {
            suggestions.push(SuggestionReport {
                suggestion: Suggestion::PhoneStripToTenDigits,
                description: format!("Strip to 10 digits (drop extension) for {} phone numbers", phone_strip_count),
                affected_rows_count: phone_strip_count,
                example_before: strip_example_before,
                example_after: strip_example_after,
            });
        }
    }

    if col_type == ColumnType::Date && date_count > 0 {
        let mut example_before = String::new();
        let mut example_after = String::new();
        for val in &invalid_values {
            let trimmed = val.trim();
            if let Ok(d) = chrono::NaiveDate::parse_from_str(trimmed, "%m/%d/%Y") {
                let iso = d.format("%Y-%m-%d").to_string();
                if col_type.is_valid(&iso) && iso != trimmed {
                    example_before = val.clone();
                    example_after = iso;
                    break;
                }
            }
        }
        if !example_before.is_empty() {
            suggestions.push(SuggestionReport {
                suggestion: Suggestion::NormalizeDateToIso,
                description: format!("Convert dates from MM/DD/YYYY to ISO (YYYY-MM-DD) for {} cells", date_count),
                affected_rows_count: date_count,
                example_before,
                example_after,
            });
        }
    }

    if col_type == ColumnType::Boolean && bool_count > 0 {
        let mut example_before = String::new();
        let mut example_after = String::new();
        for val in &invalid_values {
            let lower = val.trim().to_lowercase();
            if (lower == "true" || lower == "false") && lower != val.trim() {
                example_before = val.clone();
                example_after = lower;
                break;
            }
        }
        if !example_before.is_empty() {
            suggestions.push(SuggestionReport {
                suggestion: Suggestion::NormalizeBooleanCase,
                description: format!("Normalize true/false casing in {} cells", bool_count),
                affected_rows_count: bool_count,
                example_before,
                example_after,
            });
        }
    }

    suggestions
}