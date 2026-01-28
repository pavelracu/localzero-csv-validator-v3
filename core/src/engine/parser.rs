use std::error::Error;
use csv::ReaderBuilder;
use super::schema::{ColumnType, ColumnSchema};
use super::dataframe::DataFrame;

pub fn infer_schema(headers: &csv::StringRecord, records: &[csv::StringRecord]) -> Vec<ColumnSchema> {
    let mut schema = Vec::new();
    let row_count = records.len();
    let sample_size = std::cmp::min(row_count, 100);
    let sample = &records[..sample_size];

    for (i, name) in headers.iter().enumerate() {
        let mut detected_type = ColumnType::Text;

        // Candidate types to check, in order of precedence
        let candidates = [
            ColumnType::Boolean,
            ColumnType::Integer,
            ColumnType::Float,
            ColumnType::Date,
            ColumnType::Email,
            ColumnType::PhoneUS,
        ];

        for &candidate in &candidates {
            let mut valid_count = 0;
            let mut non_empty_count = 0;

            for record in sample {
                if let Some(value) = record.get(i) {
                    if !value.trim().is_empty() {
                        non_empty_count += 1;
                        if candidate.is_valid(value) {
                            valid_count += 1;
                        }
                    }
                }
            }

            if non_empty_count > 0 {
                let ratio = valid_count as f64 / non_empty_count as f64;
                if ratio >= 0.9 {
                    detected_type = candidate;
                    break;
                }
            }
        }

        schema.push(ColumnSchema {
            name: name.to_string(),
            detected_type,
        });
    }

    schema
}

pub fn parse_csv(data: &[u8]) -> Result<DataFrame, Box<dyn Error>> {
    let mut reader = ReaderBuilder::new()
        .has_headers(true)
        .from_reader(data);

    let headers = reader.headers()?.clone();
    let records: Result<Vec<_>, _> = reader.records().collect();
    let records = records?;

    let schema = infer_schema(&headers, &records);

    Ok(DataFrame::new(headers, records, schema))
}
