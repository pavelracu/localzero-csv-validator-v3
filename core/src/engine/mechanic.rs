use serde::{Serialize, Deserialize};
use std::collections::{HashMap, HashSet};
use super::dataframe::DataFrame;
use super::schema::ColumnType;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Suggestion {
    TrimWhitespace,
    RemoveChars { chars: String },
    DigitsOnly,
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

    // 1. Get all unique invalid values
    let mut invalid_values = HashSet::new();
    for row_idx in 0..df.rows {
        if let Some(val) = df.get_cell(row_idx, col_idx) {
            if !val.is_empty() && !col_type.is_valid(&val) {
                invalid_values.insert(val);
            }
        }
    }

    if invalid_values.is_empty() {
        return suggestions;
    }

    // --- HEURISTICS ---

    // 2. Whitespace heuristic
    let mut whitespace_affected_rows = 0;
    let mut whitespace_example_before = String::new();
    let mut whitespace_example_after = String::new();

    for val in &invalid_values {
        let trimmed = val.trim();
        if !trimmed.is_empty() && trimmed != val && col_type.is_valid(trimmed) {
            if whitespace_example_before.is_empty() {
                whitespace_example_before = val.clone();
                whitespace_example_after = trimmed.to_string();
            }
            whitespace_affected_rows += 1;
        }
    }

    if whitespace_affected_rows > 0 {
        // Now, we need to count the total number of affected rows, not just unique values.
        let mut total_affected = 0;
        for row_idx in 0..df.rows {
            if let Some(val) = df.get_cell(row_idx, col_idx) {
                let trimmed = val.trim();
                if !trimmed.is_empty() && trimmed != val && col_type.is_valid(trimmed) {
                    total_affected += 1;
                }
            }
        }
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::TrimWhitespace,
            description: format!("Trim whitespace from {} cells", total_affected),
            affected_rows_count: total_affected,
            example_before: whitespace_example_before,
            example_after: whitespace_example_after,
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
                for row_idx in 0..df.rows {
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

    // 4. Email: remove spaces
    if col_type == ColumnType::Email {
        let char_to_remove = ' ';
        let mut example_before = String::new();
        let mut example_after = String::new();
        let mut affected_unique_values = 0;
        for val in &invalid_values {
            if val.contains(char_to_remove) {
                let after = val.replace(char_to_remove, "");
                if col_type.is_valid(&after) {
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
            for row_idx in 0..df.rows {
                 if let Some(val) = df.get_cell(row_idx, col_idx) {
                     if val.contains(char_to_remove) {
                         let after = val.replace(char_to_remove, "");
                         if col_type.is_valid(&after) {
                             total_affected += 1;
                         }
                     }
                 }
            }
            if total_affected > 0 {
                suggestions.push(SuggestionReport {
                    suggestion: Suggestion::RemoveChars { chars: char_to_remove.to_string() },
                    description: format!("Remove spaces from {} emails", total_affected),
                    affected_rows_count: total_affected,
                    example_before,
                    example_after,
                });
            }
        }
    }

    // 5. Phone: keep only digits
    if col_type == ColumnType::PhoneUS {
        let mut example_before = String::new();
        let mut example_after = String::new();
        let mut affected_unique_values = 0;

        for val in &invalid_values {
            let after: String = val.chars().filter(|c| c.is_ascii_digit()).collect();
            if after != *val && col_type.is_valid(&after) {
                if example_before.is_empty() {
                    example_before = val.clone();
                    example_after = after;
                }
                affected_unique_values += 1;
            }
        }

        if affected_unique_values > 0 {
            let mut total_affected = 0;
            for row_idx in 0..df.rows {
                if let Some(val) = df.get_cell(row_idx, col_idx) {
                    let after: String = val.chars().filter(|c| c.is_ascii_digit()).collect();
                    if after != *val && col_type.is_valid(&after) {
                        total_affected += 1;
                    }
                }
            }
             if total_affected > 0 {
                suggestions.push(SuggestionReport {
                    suggestion: Suggestion::DigitsOnly,
                    description: format!("Remove formatting from {} phone numbers", total_affected),
                    affected_rows_count: total_affected,
                    example_before,
                    example_after,
                });
            }
        }
    }

    suggestions
}