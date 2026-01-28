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
        if value.is_empty() {
            return true; // Assume empty is valid for now, or handled separately
        }
        match self {
            ColumnType::Text => true,
            ColumnType::Integer => value.parse::<i64>().is_ok(),
            ColumnType::Float => value.parse::<f64>().is_ok(),
            ColumnType::Boolean => {
                let v = value.to_lowercase();
                matches!(v.as_str(), "true" | "false" | "1" | "0" | "yes" | "no")
            },
            ColumnType::Email => EMAIL_REGEX.is_match(value),
            ColumnType::PhoneUS => PHONE_US_REGEX.is_match(value),
            ColumnType::Date => {
                 // Try parsing strict ISO 8601 first, then common formats
                 // Using chrono's strict parsing for now or specific formats
                 if chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok() { return true; }
                 if chrono::NaiveDate::parse_from_str(value, "%m/%d/%Y").is_ok() { return true; }
                 false
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnSchema {
    pub name: String,
    pub detected_type: ColumnType,
}
