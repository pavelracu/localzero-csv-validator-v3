// PII & sensitive data detection and redaction (no data leaves the engine).
// Tier 1: Syntax validation (RFC/E.164-style). Tier 2: Format normalization. Tier 3: DNS/MX (skipped — offline).

use std::str::FromStr;
use regex::Regex;
use lazy_static::lazy_static;

lazy_static! {
    /// Email: (?i)[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}
    static ref EMAIL_DETECT: Regex = Regex::new(r"(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}").unwrap();
    /// SSN (US): \b\d{3}-\d{2}-\d{4}\b
    static ref SSN_DETECT: Regex = Regex::new(r"^\s*\d{3}-\d{2}-\d{4}\s*$").unwrap();
    /// IPv4: \b(\d{1,3}\.){3}\d{1,3}\b (each octet 0-255 would need extra check; we accept pattern)
    static ref IPV4_DETECT: Regex = Regex::new(r"^\s*(\d{1,3}\.){3}\d{1,3}\s*$").unwrap();
}

/// Credit card: digits only 13–16, optional spaces/dashes. Luhn check applied separately.
pub fn looks_like_credit_card(s: &str) -> bool {
    let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() < 13 || digits.len() > 16 {
        return false;
    }
    luhn_check(&digits)
}

/// Luhn (mod 10) check for credit card validation.
fn luhn_check(digits: &str) -> bool {
    let mut sum = 0u32;
    for (i, c) in digits.chars().rev().enumerate() {
        let d = c.to_digit(10).unwrap_or(0);
        sum += if i % 2 == 1 {
            let d2 = d * 2;
            d2 / 10 + d2 % 10
        } else {
            d
        };
    }
    sum % 10 == 0
}

pub fn is_email_like(s: &str) -> bool {
    let t = s.trim();
    !t.is_empty() && EMAIL_DETECT.is_match(t)
}

/// Normalize email per RFC 5322 principles: remove duplicate @ (keep first only), trim, lowercase domain.
/// Returns None if result is not valid per email_address crate (RFC-compliant).
pub fn normalize_email(s: &str) -> Option<String> {
    let repaired = email_remove_duplicate_at(s);
    let t = repaired.trim();
    if t.is_empty() {
        return None;
    }
    let parts: Vec<&str> = t.splitn(2, '@').collect();
    if parts.len() != 2 {
        return None;
    }
    let local = parts[0].trim();
    let domain = parts[1].trim().to_lowercase();
    if local.is_empty() || domain.is_empty() {
        return None;
    }
    let normalized = format!("{}@{}", local, domain);
    if email_address::EmailAddress::from_str(&normalized).is_ok() {
        Some(normalized)
    } else {
        None
    }
}

/// Remove duplicate @ (keep first @ only). Does not validate; use for repair before validation.
pub fn email_remove_duplicate_at(s: &str) -> String {
    let t = s.trim();
    if t.is_empty() {
        return String::new();
    }
    let mut first = true;
    let mut out = String::with_capacity(t.len());
    for c in t.chars() {
        if c == '@' {
            if first {
                out.push(c);
                first = false;
            }
        } else {
            out.push(c);
        }
    }
    out
}

pub fn is_ssn_like(s: &str) -> bool {
    SSN_DETECT.is_match(s.trim())
}

pub fn is_ipv4_like(s: &str) -> bool {
    let t = s.trim();
    if !IPV4_DETECT.is_match(t) {
        return false;
    }
    t.split('.').all(|oct| oct.parse::<u8>().is_ok())
}

/// Mask email: j***@gmail.com (first char + *** + @ + domain)
pub fn mask_email(s: &str) -> String {
    let t = s.trim();
    if t.is_empty() {
        return String::new();
    }
    if let Some(at) = t.find('@') {
        let local = &t[..at];
        let domain = &t[at + 1..]; // part after @, so we don't double the @
        let local_c: Vec<char> = local.chars().collect();
        if local_c.is_empty() {
            return "[EMAIL_REDACTED]".to_string();
        }
        format!("{}***@{}", local_c[0], domain)
    } else {
        "[EMAIL_REDACTED]".to_string()
    }
}

/// Redact SSN: XXX-XX-XXXX
pub fn redact_ssn(_s: &str) -> String {
    "XXX-XX-XXXX".to_string()
}

/// Redact credit card: ****-****-****-1234 (last 4 visible)
pub fn redact_credit_card(s: &str) -> String {
    let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() < 4 {
        return "****-****-****-****".to_string();
    }
    let last4 = &digits[digits.len().saturating_sub(4)..];
    "****-****-****-".to_string() + last4
}

/// Zero-out IPv4: 0.0.0.0
pub fn zero_ipv4(_s: &str) -> String {
    "0.0.0.0".to_string()
}
