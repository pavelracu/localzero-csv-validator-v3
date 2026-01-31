use serde::{Serialize, Deserialize};
use std::collections::{HashMap, HashSet};
use super::dataframe::DataFrame;
use super::schema::ColumnType;
use super::pii;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Suggestion {
    TrimWhitespace,
    RemoveChars { chars: String },
    DigitsOnly,
    PhoneStripToTenDigits,
    NormalizeDateToIso,
    NormalizeBooleanCase,
    // PII redaction (apply when value matches pattern; result not validated)
    MaskEmail,
    RedactSSN,
    RedactCreditCard,
    ZeroIPv4,
    // Boolean: yes/no/1/0/on/off -> true/false
    NormalizeBooleanExtended,
    // Date: try multiple formats -> ISO; fallback 1970-01-01
    NormalizeDateCascade,
    // Fuzzy: replace with closest master list value if distance <= max_distance
    FuzzyMatchCategorical { master_list: Vec<String>, max_distance: u32 },
    // Tier 2: Format normalization (RFC / E.164 / ISO 8601)
    NormalizeEmail,       // Remove duplicate @, trim, RFC-style
    NormalizePhoneE164,  // E.164: +1XXXXXXXXXX, strip extensions
    FormatPhoneUS,       // Format to US format: (XXX) XXX-XXXX or XXX-XXX-XXXX
    PadZipLeadingZeros,  // US ZIP: pad to 5 digits
    NormalizeStateAbbrev, // US state abbreviation -> full name
    // New standard types (Excel/Sheets-style)
    NormalizeUuid,       // 32 hex -> 8-4-4-4-12 lowercase; hyphenated -> lowercase
    NormalizeTimeToIso,  // HH:MM or 12h -> HH:MM:SS 24h
    NormalizeCurrency,   // Strip $€£,, format to 2 decimals
    NormalizePercentage, // Parse and format as "50" or "50%"
}

/// Boolean extended: true,t,yes,y,1,on,enabled -> true; false,f,no,n,0,off,disabled -> false (case insensitive).
pub fn normalize_boolean_extended(s: &str) -> Option<&'static str> {
    let t = s.trim().to_lowercase();
    if t.is_empty() {
        return None;
    }
    match t.as_str() {
        "true" | "t" | "yes" | "y" | "1" | "on" | "enabled" => Some("true"),
        "false" | "f" | "no" | "n" | "0" | "off" | "disabled" => Some("false"),
        _ => None,
    }
}

/// Date cascade: try YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY, YYYY/MM/DD; fallback 1970-01-01.
pub fn parse_date_cascade(s: &str) -> String {
    let t = s.trim();
    if t.is_empty() {
        return String::new();
    }
    const FORMATS: &[&str] = &["%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d"];
    for fmt in FORMATS {
        if let Ok(d) = chrono::NaiveDate::parse_from_str(t, fmt) {
            return d.format("%Y-%m-%d").to_string();
        }
    }
    "1970-01-01".to_string()
}

/// UUID: 32 hex -> 8-4-4-4-12 lowercase; 36 with hyphens -> lowercase.
pub fn normalize_uuid(s: &str) -> String {
    let s = s.trim();
    if s.is_empty() {
        return String::new();
    }
    let hex: String = s.chars().filter(|c| c.is_ascii_hexdigit()).collect();
    if hex.len() == 32 {
        let lower = hex.to_lowercase();
        format!(
            "{}-{}-{}-{}-{}",
            &lower[0..8],
            &lower[8..12],
            &lower[12..16],
            &lower[16..20],
            &lower[20..32]
        )
    } else if s.len() == 36 && s.as_bytes()[8] == b'-' && s.as_bytes()[13] == b'-' && s.as_bytes()[18] == b'-' && s.as_bytes()[23] == b'-' {
        s.to_lowercase()
    } else {
        s.to_string()
    }
}

/// Time: parse HH:MM, HH:MM:SS, 12h AM/PM -> HH:MM:SS 24h.
pub fn normalize_time_to_iso(s: &str) -> Option<String> {
    let s = s.trim();
    if s.is_empty() {
        return Some(String::new());
    }
    const FORMATS: &[&str] = &["%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M:%S %p"];
    for fmt in FORMATS {
        if let Ok(t) = chrono::NaiveTime::parse_from_str(s, fmt) {
            return Some(t.format("%H:%M:%S").to_string());
        }
    }
    None
}

/// Currency: strip $€£, and spaces; parse and format to 2 decimals.
pub fn normalize_currency(s: &str) -> String {
    let stripped: String = s
        .chars()
        .filter(|c| !matches!(c, '$' | '€' | '£' | '¥' | ',' | ' '))
        .collect();
    let trimmed = stripped.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if let Ok(n) = trimmed.parse::<f64>() {
        format!("{:.2}", n)
    } else {
        s.to_string()
    }
}

/// Percentage: strip %; parse and format as "50" (0-100) or "50%" per policy. We use "50" for consistency.
pub fn normalize_percentage(s: &str) -> String {
    let s = s.trim().trim_end_matches('%').trim();
    if s.is_empty() {
        return String::new();
    }
    if let Ok(n) = s.parse::<f64>() {
        if (0.0..=1.0).contains(&n) {
            format!("{}", (n * 100.0).round())
        } else {
            format!("{}", n.round())
        }
    } else {
        s.to_string()
    }
}

/// Levenshtein distance between two strings.
pub fn levenshtein(a: &str, b: &str) -> u32 {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let n = a.len();
    let m = b.len();
    if n == 0 {
        return m as u32;
    }
    if m == 0 {
        return n as u32;
    }
    let mut prev = (0..=m as u32).collect::<Vec<_>>();
    for (i, &ca) in a.iter().enumerate() {
        let mut curr = vec![i as u32 + 1];
        for (j, &cb) in b.iter().enumerate() {
            let cost = if ca == cb { 0 } else { 1 };
            curr.push((prev[j].saturating_add(cost))
                .min(curr[j].saturating_add(1))
                .min(prev[j + 1].saturating_add(1)));
        }
        prev = curr;
    }
    prev[m]
}

/// Best match from master list (min Levenshtein); None if min distance > max_distance.
pub fn fuzzy_match_best(s: &str, master_list: &[String], max_distance: u32) -> Option<String> {
    let s_lower = s.trim().to_lowercase();
    if s_lower.is_empty() {
        return None;
    }
    let mut best: Option<(String, u32)> = None;
    for m in master_list {
        let d = levenshtein(&s_lower, &m.to_lowercase());
        if d <= max_distance && best.as_ref().map_or(true, |(_, bd)| d < *bd) {
            best = Some((m.clone(), d));
        }
    }
    best.map(|(s, _)| s)
}

/// US state names for fuzzy matching (master list).
const US_STATES: &[&str] = &[
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
    "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
    "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
    "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
    "Wisconsin", "Wyoming",
];

/// Normalize phone to 10 digits only when there are clearly extra digits (extension).
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

/// E.164 normalization: strip non-digits except leading +, default US=1, strip extensions (x, ext.).
/// Output: +1XXXXXXXXXX for US. Extensions stripped (stored separately in real systems).
pub fn normalize_phone_e164(s: &str) -> Option<String> {
    let t = s.trim();
    let lower = t.to_lowercase();
    let ext_markers = [" x", "x", " ext", "ext", "ext.", " extension"];
    let main_str = ext_markers
        .iter()
        .filter_map(|m| lower.find(m).map(|pos| t[..pos].trim()))
        .find(|s| !s.is_empty())
        .unwrap_or(t);
    let has_plus = main_str.starts_with('+');
    let digits: String = main_str.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.is_empty() {
        return None;
    }
    let num = if digits.len() == 10 && !has_plus {
        format!("+1{}", digits)
    } else if digits.len() == 11 && digits.starts_with('1') {
        format!("+{}", digits)
    } else if digits.len() >= 10 && digits.len() <= 11 {
        format!("+{}", digits)
    } else if digits.len() > 11 {
        format!("+{}", &digits[..11])
    } else {
        return None;
    };
    Some(num)
}

/// Format phone number to US format: (XXX) XXX-XXXX or XXX-XXX-XXXX
/// Extracts 10 digits (or 11 starting with 1) and formats them.
pub fn format_phone_us(s: &str) -> Option<String> {
    let t = s.trim();
    let lower = t.to_lowercase();
    // Strip extension markers
    let ext_markers = [" x", "x", " ext", "ext", "ext.", " extension"];
    let main_str = ext_markers
        .iter()
        .filter_map(|m| lower.find(m).map(|pos| t[..pos].trim()))
        .find(|s| !s.is_empty())
        .unwrap_or(t);
    
    // Extract digits
    let digits: String = main_str.chars().filter(|c| c.is_ascii_digit()).collect();
    
    if digits.is_empty() {
        return None;
    }
    
    // Handle 10 or 11 digit numbers
    let ten_digits = if digits.len() == 10 {
        digits.as_str()
    } else if digits.len() == 11 && digits.starts_with('1') {
        &digits[1..]
    } else if digits.len() > 11 {
        // Take first 11 digits, then extract 10
        if digits.starts_with('1') && digits.len() >= 11 {
            &digits[1..11]
        } else if digits.len() >= 10 {
            &digits[..10]
        } else {
            return None;
        }
    } else {
        return None;
    };
    
    if ten_digits.len() != 10 {
        return None;
    }
    
    // Format as (XXX) XXX-XXXX
    Some(format!("({}) {}-{}", &ten_digits[..3], &ten_digits[3..6], &ten_digits[6..]))
}

/// US ZIP: pad with leading zeros to 5 digits (semantic: US ZIP must be 5 digits).
pub fn pad_zip_leading_zeros(s: &str) -> Option<String> {
    let t = s.trim();
    if t.is_empty() {
        return None;
    }
    let digits: String = t.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.is_empty() || digits.len() > 5 {
        return None;
    }
    Some(format!("{:0>5}", digits))
}

lazy_static::lazy_static! {
    static ref US_STATE_ABBREV: std::collections::HashMap<&'static str, &'static str> = {
        let mut m = std::collections::HashMap::new();
        let pairs = [
            ("AL", "Alabama"), ("AK", "Alaska"), ("AZ", "Arizona"), ("AR", "Arkansas"),
            ("CA", "California"), ("CO", "Colorado"), ("CT", "Connecticut"), ("DE", "Delaware"),
            ("FL", "Florida"), ("GA", "Georgia"), ("HI", "Hawaii"), ("ID", "Idaho"),
            ("IL", "Illinois"), ("IN", "Indiana"), ("IA", "Iowa"), ("KS", "Kansas"),
            ("KY", "Kentucky"), ("LA", "Louisiana"), ("ME", "Maine"), ("MD", "Maryland"),
            ("MA", "Massachusetts"), ("MI", "Michigan"), ("MN", "Minnesota"), ("MS", "Mississippi"),
            ("MO", "Missouri"), ("MT", "Montana"), ("NE", "Nebraska"), ("NV", "Nevada"),
            ("NH", "New Hampshire"), ("NJ", "New Jersey"), ("NM", "New Mexico"), ("NY", "New York"),
            ("NC", "North Carolina"), ("ND", "North Dakota"), ("OH", "Ohio"), ("OK", "Oklahoma"),
            ("OR", "Oregon"), ("PA", "Pennsylvania"), ("RI", "Rhode Island"), ("SC", "South Carolina"),
            ("SD", "South Dakota"), ("TN", "Tennessee"), ("TX", "Texas"), ("UT", "Utah"),
            ("VT", "Vermont"), ("VA", "Virginia"), ("WA", "Washington"), ("WV", "West Virginia"),
            ("WI", "Wisconsin"), ("WY", "Wyoming"), ("DC", "District of Columbia"),
        ];
        for (k, v) in pairs {
            m.insert(k, v);
        }
        m
    };
}

pub fn normalize_state_abbrev(s: &str) -> Option<String> {
    let t = s.trim();
    if t.len() != 2 {
        return None;
    }
    let key = t.to_uppercase();
    US_STATE_ABBREV.get(key.as_str()).map(|&v| v.to_string())
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
    let mut phone_format_count: usize = 0;
    let mut date_count: usize = 0;
    let mut bool_count: usize = 0;
    let mut bool_extended_count: usize = 0;
    let mut date_cascade_count: usize = 0;
    let mut ssn_count: usize = 0;
    let mut ipv4_count: usize = 0;
    let mut email_mask_count: usize = 0;
    let mut cc_count: usize = 0;
    let mut fuzzy_states_count: usize = 0;
    let mut email_normalize_count: usize = 0;
    let mut phone_e164_count: usize = 0;
    let mut zip_pad_count: usize = 0;
    let mut state_abbrev_count: usize = 0;
    let mut uuid_normalize_count: usize = 0;
    let mut time_normalize_count: usize = 0;
    let mut currency_normalize_count: usize = 0;
    let mut percentage_normalize_count: usize = 0;

    let col_name_lower = col_schema.name.to_lowercase();
    let looks_like_zip = col_name_lower.contains("zip") || col_name_lower.contains("postal");
    let us_states: Vec<String> = US_STATES.iter().map(|s| s.to_string()).collect();
    let mut trim_example_before = String::new();
    let mut trim_example_after = String::new();
    let mut ssn_example_before = String::new();
    let mut ipv4_example_before = String::new();
    let mut email_mask_example_before = String::new();
    let mut cc_example_before = String::new();
    let mut fuzzy_example_before = String::new();
    let mut fuzzy_example_after = String::new();
    let mut email_norm_example_before = String::new();
    let mut email_norm_example_after = String::new();
    let mut phone_e164_example_before = String::new();
    let mut phone_e164_example_after = String::new();
    let mut zip_pad_example_before = String::new();
    let mut zip_pad_example_after = String::new();
    let mut state_abbrev_example_before = String::new();
    let mut state_abbrev_example_after = String::new();
    let mut uuid_example_before = String::new();
    let mut uuid_example_after = String::new();
    let mut time_example_before = String::new();
    let mut time_example_after = String::new();
    let mut currency_example_before = String::new();
    let mut currency_example_after = String::new();
    let mut percentage_example_before = String::new();
    let mut percentage_example_after = String::new();

    for row_idx in 0..rows_to_scan {
        if invalid_values.len() >= MAX_UNIQUE_INVALID_SAMPLE {
            break;
        }
        if let Some(val) = df.get_cell(row_idx, col_idx) {
            if !val.is_empty() {
                if pii::is_ssn_like(&val) {
                    ssn_count += 1;
                    if ssn_example_before.is_empty() {
                        ssn_example_before = val.clone();
                    }
                }
                if pii::is_ipv4_like(&val) {
                    ipv4_count += 1;
                    if ipv4_example_before.is_empty() {
                        ipv4_example_before = val.clone();
                    }
                }
                if pii::is_email_like(&val) {
                    email_mask_count += 1;
                    if email_mask_example_before.is_empty() {
                        email_mask_example_before = val.clone();
                    }
                }
                if pii::looks_like_credit_card(&val) {
                    cc_count += 1;
                    if cc_example_before.is_empty() {
                        cc_example_before = val.clone();
                    }
                }
                if col_type == ColumnType::Text {
                    if let Some(matched) = fuzzy_match_best(&val, &us_states, 2) {
                        fuzzy_states_count += 1;
                        if fuzzy_example_before.is_empty() {
                            fuzzy_example_before = val.clone();
                            fuzzy_example_after = matched;
                        }
                    }
                    if let Some(full) = normalize_state_abbrev(&val) {
                        state_abbrev_count += 1;
                        if state_abbrev_example_before.is_empty() {
                            state_abbrev_example_before = val.clone();
                            state_abbrev_example_after = full;
                        }
                    }
                }
                if col_type == ColumnType::Email || pii::is_email_like(&val) {
                    if let Some(norm) = pii::normalize_email(&val) {
                        if norm != val {
                            email_normalize_count += 1;
                            if email_norm_example_before.is_empty() {
                                email_norm_example_before = val.clone();
                                email_norm_example_after = norm;
                            }
                        }
                    }
                }
                if col_type == ColumnType::PhoneUS {
                    if let Some(e164) = normalize_phone_e164(&val) {
                        if e164 != val {
                            phone_e164_count += 1;
                            if phone_e164_example_before.is_empty() {
                                phone_e164_example_before = val.clone();
                                phone_e164_example_after = e164;
                            }
                        }
                    }
                }
                if looks_like_zip {
                    if let Some(padded) = pad_zip_leading_zeros(&val) {
                        if padded != val.trim() {
                            zip_pad_count += 1;
                            if zip_pad_example_before.is_empty() {
                                zip_pad_example_before = val.clone();
                                zip_pad_example_after = padded;
                            }
                        }
                    }
                }
            }
            if val.is_empty() || col_type.is_valid(&val) {
                continue;
            }
            invalid_values.insert(val.clone());

            if col_type == ColumnType::Boolean {
                if normalize_boolean_extended(&val).is_some() {
                    bool_extended_count += 1;
                }
            }
            if col_type == ColumnType::Date {
                let cascaded = parse_date_cascade(&val);
                if !cascaded.is_empty() && cascaded != val.trim() {
                    date_cascade_count += 1;
                }
            }

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
                // Check if formatting to US format would fix it
                if let Some(formatted) = format_phone_us(&val) {
                    if formatted != val && col_type.is_valid(&formatted) {
                        phone_format_count += 1;
                    }
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
            if col_type == ColumnType::Uuid {
                let norm = normalize_uuid(&val);
                if norm != val && col_type.is_valid(&norm) {
                    uuid_normalize_count += 1;
                    if uuid_example_before.is_empty() {
                        uuid_example_before = val.clone();
                        uuid_example_after = norm;
                    }
                }
            }
            if col_type == ColumnType::Time {
                if let Some(norm) = normalize_time_to_iso(&val) {
                    if norm != val.trim() && col_type.is_valid(&norm) {
                        time_normalize_count += 1;
                        if time_example_before.is_empty() {
                            time_example_before = val.clone();
                            time_example_after = norm;
                        }
                    }
                }
            }
            if col_type == ColumnType::Currency {
                let norm = normalize_currency(&val);
                if norm != val.trim() && col_type.is_valid(&norm) {
                    currency_normalize_count += 1;
                    if currency_example_before.is_empty() {
                        currency_example_before = val.clone();
                        currency_example_after = norm;
                    }
                }
            }
            if col_type == ColumnType::Percentage {
                let norm = normalize_percentage(&val);
                if norm != val.trim() && col_type.is_valid(&norm) {
                    percentage_normalize_count += 1;
                    if percentage_example_before.is_empty() {
                        percentage_example_before = val.clone();
                        percentage_example_after = norm;
                    }
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
        let mut format_example_before = String::new();
        let mut format_example_after = String::new();
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
            if let Some(formatted) = format_phone_us(val.as_str()) {
                if formatted != *val && col_type.is_valid(&formatted) {
                    if format_example_before.is_empty() {
                        format_example_before = val.clone();
                        format_example_after = formatted;
                    }
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
        if phone_format_count > 0 && !format_example_before.is_empty() {
            suggestions.push(SuggestionReport {
                suggestion: Suggestion::FormatPhoneUS,
                description: format!("Format to US format ((XXX) XXX-XXXX) for {} phone numbers", phone_format_count),
                affected_rows_count: phone_format_count,
                example_before: format_example_before,
                example_after: format_example_after,
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

    if bool_extended_count > 0 {
        let mut example_before = String::new();
        let mut example_after = String::new();
        for val in &invalid_values {
            if let Some(norm) = normalize_boolean_extended(val) {
                example_before = val.clone();
                example_after = norm.to_string();
                break;
            }
        }
        if !example_before.is_empty() {
            suggestions.push(SuggestionReport {
                suggestion: Suggestion::NormalizeBooleanExtended,
                description: format!("Map yes/no/1/0/on/off to true/false in {} cells", bool_extended_count),
                affected_rows_count: bool_extended_count,
                example_before,
                example_after,
            });
        }
    }

    if col_type == ColumnType::Date && date_cascade_count > 0 {
        let mut example_before = String::new();
        let mut example_after = String::new();
        for val in &invalid_values {
            let cascaded = parse_date_cascade(val);
            if !cascaded.is_empty() && cascaded != val.trim() {
                example_before = val.clone();
                example_after = cascaded;
                break;
            }
        }
        if !example_before.is_empty() {
            suggestions.push(SuggestionReport {
                suggestion: Suggestion::NormalizeDateCascade,
                description: format!("Parse multiple date formats → ISO (fallback 1970-01-01) for {} cells", date_cascade_count),
                affected_rows_count: date_cascade_count,
                example_before,
                example_after,
            });
        }
    }

    if ssn_count > 0 && !ssn_example_before.is_empty() {
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::RedactSSN,
            description: format!("Redact SSN (XXX-XX-XXXX) in {} cells", ssn_count),
            affected_rows_count: ssn_count,
            example_before: ssn_example_before.clone(),
            example_after: pii::redact_ssn(&ssn_example_before),
        });
    }
    if ipv4_count > 0 && !ipv4_example_before.is_empty() {
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::ZeroIPv4,
            description: format!("Zero-out IPv4 (0.0.0.0) in {} cells", ipv4_count),
            affected_rows_count: ipv4_count,
            example_before: ipv4_example_before.clone(),
            example_after: pii::zero_ipv4(&ipv4_example_before),
        });
    }
    if email_mask_count > 0 && !email_mask_example_before.is_empty() {
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::MaskEmail,
            description: format!("Mask email (j***@domain.com) in {} cells", email_mask_count),
            affected_rows_count: email_mask_count,
            example_before: email_mask_example_before.clone(),
            example_after: pii::mask_email(&email_mask_example_before),
        });
    }
    if cc_count > 0 && !cc_example_before.is_empty() {
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::RedactCreditCard,
            description: format!("Redact credit card (****-****-****-1234) in {} cells", cc_count),
            affected_rows_count: cc_count,
            example_before: cc_example_before.clone(),
            example_after: pii::redact_credit_card(&cc_example_before),
        });
    }

    if col_type == ColumnType::Text && fuzzy_states_count > 0 && !fuzzy_example_before.is_empty() {
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::FuzzyMatchCategorical {
                master_list: us_states.clone(),
                max_distance: 2,
            },
            description: format!("Fix typos (US States, distance ≤2) in {} cells", fuzzy_states_count),
            affected_rows_count: fuzzy_states_count,
            example_before: fuzzy_example_before.clone(),
            example_after: fuzzy_example_after.clone(),
        });
    }

    if email_normalize_count > 0 && !email_norm_example_before.is_empty() {
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::NormalizeEmail,
            description: format!("Normalize email (remove duplicate @, RFC-style) in {} cells", email_normalize_count),
            affected_rows_count: email_normalize_count,
            example_before: email_norm_example_before.clone(),
            example_after: email_norm_example_after.clone(),
        });
    }
    if col_type == ColumnType::PhoneUS && phone_e164_count > 0 && !phone_e164_example_before.is_empty() {
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::NormalizePhoneE164,
            description: format!("Normalize to E.164 (+1XXXXXXXXXX, strip extensions) in {} cells", phone_e164_count),
            affected_rows_count: phone_e164_count,
            example_before: phone_e164_example_before.clone(),
            example_after: phone_e164_example_after.clone(),
        });
    }
    if looks_like_zip && zip_pad_count > 0 && !zip_pad_example_before.is_empty() {
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::PadZipLeadingZeros,
            description: format!("Pad ZIP with leading zeros (5 digits) in {} cells", zip_pad_count),
            affected_rows_count: zip_pad_count,
            example_before: zip_pad_example_before.clone(),
            example_after: zip_pad_example_after.clone(),
        });
    }
    if col_type == ColumnType::Text && state_abbrev_count > 0 && !state_abbrev_example_before.is_empty() {
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::NormalizeStateAbbrev,
            description: format!("Normalize state abbreviations to full name in {} cells", state_abbrev_count),
            affected_rows_count: state_abbrev_count,
            example_before: state_abbrev_example_before.clone(),
            example_after: state_abbrev_example_after.clone(),
        });
    }

    if col_type == ColumnType::Uuid && uuid_normalize_count > 0 && !uuid_example_before.is_empty() {
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::NormalizeUuid,
            description: format!("Normalize UUID (lowercase, add hyphens if 32 hex) in {} cells", uuid_normalize_count),
            affected_rows_count: uuid_normalize_count,
            example_before: uuid_example_before.clone(),
            example_after: uuid_example_after.clone(),
        });
    }
    if col_type == ColumnType::Time && time_normalize_count > 0 && !time_example_before.is_empty() {
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::NormalizeTimeToIso,
            description: format!("Normalize time to HH:MM:SS in {} cells", time_normalize_count),
            affected_rows_count: time_normalize_count,
            example_before: time_example_before.clone(),
            example_after: time_example_after.clone(),
        });
    }
    if col_type == ColumnType::Currency && currency_normalize_count > 0 && !currency_example_before.is_empty() {
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::NormalizeCurrency,
            description: format!("Normalize currency (strip symbols, 2 decimals) in {} cells", currency_normalize_count),
            affected_rows_count: currency_normalize_count,
            example_before: currency_example_before.clone(),
            example_after: currency_example_after.clone(),
        });
    }
    if col_type == ColumnType::Percentage && percentage_normalize_count > 0 && !percentage_example_before.is_empty() {
        suggestions.push(SuggestionReport {
            suggestion: Suggestion::NormalizePercentage,
            description: format!("Normalize percentage in {} cells", percentage_normalize_count),
            affected_rows_count: percentage_normalize_count,
            example_before: percentage_example_before.clone(),
            example_after: percentage_example_after.clone(),
        });
    }

    suggestions
}