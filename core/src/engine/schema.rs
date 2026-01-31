use std::str::FromStr;
use serde::{Deserialize, Serialize};
use regex::Regex;
use lazy_static::lazy_static;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Copy)]
pub enum ColumnType {
    Text,
    Integer,
    Float,
    Boolean,
    Email,
    PhoneUS,
    Date,
    Uuid,
    Time,
    Currency,
    Percentage,
}

impl Default for ColumnType {
    fn default() -> Self {
        ColumnType::Text
    }
}

lazy_static! {
    static ref EMAIL_REGEX: Regex = Regex::new(r"(?i)^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$").unwrap();
    static ref PHONE_US_REGEX: Regex = Regex::new(r"^\D*1?\D*([2-9][0-8][0-9])\D*([2-9][0-9]{2})\D*([0-9]{4})\D*$").unwrap();
}

impl ColumnType {
    pub fn is_valid(&self, value: &str) -> bool {
        self.is_valid_fast(value)
    }

    pub fn is_valid_fast(&self, value: &str) -> bool {
        if value.is_empty() {
            return true;
        }
        match self {
            ColumnType::Text => true,
            ColumnType::Integer => value.trim().parse::<i64>().is_ok(),
            ColumnType::Float => value.trim().parse::<f64>().is_ok(),
            ColumnType::Boolean => {
                // Optimized check: "true" or "false" only, case-sensitive per instructions
                // "Ensure Boolean checks are simple string comparisons ("true"/"false")."
                value == "true" || value == "false"
            },
            ColumnType::Email => {
                email_address::EmailAddress::from_str(value.trim()).is_ok()
                    || EMAIL_REGEX.is_match(value)
            },
            ColumnType::PhoneUS => PHONE_US_REGEX.is_match(value),
            ColumnType::Date => {
                 if chrono::NaiveDate::parse_from_str(value.trim(), "%Y-%m-%d").is_ok() { return true; }
                 if chrono::NaiveDate::parse_from_str(value.trim(), "%m/%d/%Y").is_ok() { return true; }
                 if chrono::NaiveDate::parse_from_str(value.trim(), "%d-%m-%Y").is_ok() { return true; }
                 if chrono::NaiveDate::parse_from_str(value.trim(), "%Y/%m/%d").is_ok() { return true; }
                 false
            }
            ColumnType::Uuid => is_valid_uuid(value),
            ColumnType::Time => is_valid_time(value),
            ColumnType::Currency => is_valid_currency(value),
            ColumnType::Percentage => is_valid_percentage(value),
        }
    }
}

/// UUID: 36 chars with hyphens (8-4-4-4-12) or 32 hex chars. No regex.
fn is_valid_uuid(value: &str) -> bool {
    let s = value.trim();
    if s.is_empty() {
        return true;
    }
    let b = s.as_bytes();
    if b.len() == 32 {
        return b.iter().all(|&c| c.is_ascii_hexdigit());
    }
    if b.len() != 36 {
        return false;
    }
    if b[8] != b'-' || b[13] != b'-' || b[18] != b'-' || b[23] != b'-' {
        return false;
    }
    for (i, &c) in b.iter().enumerate() {
        if i == 8 || i == 13 || i == 18 || i == 23 {
            continue;
        }
        if !c.is_ascii_hexdigit() {
            return false;
        }
    }
    // Version nibble (index 14 = first char of third group): 1-5
    let version = b[14];
    if !matches!(version, b'1'..=b'5') {
        return false;
    }
    // Variant nibble (index 19 = first char of fourth group): 8,9,a,b
    let variant = b[19];
    if !matches!(variant, b'8' | b'9' | b'a' | b'A' | b'b' | b'B') {
        return false;
    }
    true
}

/// Time: HH:MM, HH:MM:SS (24h), or 12h with AM/PM. Use chrono.
fn is_valid_time(value: &str) -> bool {
    let s = value.trim();
    if s.is_empty() {
        return true;
    }
    const FORMATS: &[&str] = &[
        "%H:%M",
        "%H:%M:%S",
        "%I:%M %p",
        "%I:%M:%S %p",
    ];
    for fmt in FORMATS {
        if chrono::NaiveTime::parse_from_str(s, fmt).is_ok() {
            return true;
        }
    }
    false
}

/// Currency: strip $€£, and spaces; parse as f64.
fn is_valid_currency(value: &str) -> bool {
    let s = value.trim();
    if s.is_empty() {
        return true;
    }
    let stripped: String = s
        .chars()
        .filter(|c| !matches!(c, '$' | '€' | '£' | '¥' | ',' | ' '))
        .collect();
    stripped.parse::<f64>().is_ok()
}

/// Percentage: strip trailing %; parse as f64; valid if in [0, 100] or [0, 1].
fn is_valid_percentage(value: &str) -> bool {
    let s = value.trim().trim_end_matches('%').trim();
    if s.is_empty() {
        return true;
    }
    if let Ok(n) = s.parse::<f64>() {
        (0.0..=100.0).contains(&n) || (0.0..=1.0).contains(&n)
    } else {
        false
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnSchema {
    pub name: String,
    pub detected_type: ColumnType,
}
