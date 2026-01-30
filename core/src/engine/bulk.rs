//! Bulk column actions: FindReplace and RegexReplace.
//! Uses copy-on-write via patches; only changed cells allocate.

use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum BulkAction {
    FindReplace {
        search: String,
        replace: String,
    },
    RegexReplace {
        pattern: String,
        replacement: String,
    },
}

/// Apply a bulk action to a single cell value.
/// For `RegexReplace`, `compiled_regex` must be `Some(regex)` compiled from the action's pattern.
/// Returns an error only for invalid regex (caller compiles once before the loop).
pub fn apply_to_cell(
    value: &str,
    action: &BulkAction,
    compiled_regex: Option<&Regex>,
) -> Result<String, regex::Error> {
    let result = match action {
        BulkAction::FindReplace { search, replace } => value.replace(search, replace),
        BulkAction::RegexReplace { replacement, .. } => {
            let re = compiled_regex.expect("RegexReplace requires compiled_regex");
            re.replace_all(value, replacement.as_str()).into_owned()
        }
    };
    Ok(result)
}

/// Compile the regex for a RegexReplace action. Call once before iterating rows.
pub fn compile_regex_for_action(action: &BulkAction) -> Result<Option<Regex>, regex::Error> {
    match action {
        BulkAction::FindReplace { .. } => Ok(None),
        BulkAction::RegexReplace { pattern, .. } => Regex::new(pattern).map(Some),
    }
}
