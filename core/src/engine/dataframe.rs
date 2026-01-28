use csv::StringRecord;
use super::schema::ColumnSchema;

#[derive(Debug)]
pub struct DataFrame {
    pub headers: StringRecord,
    pub records: Vec<StringRecord>,
    pub schema: Vec<ColumnSchema>,
}

impl DataFrame {
    pub fn new(headers: StringRecord, records: Vec<StringRecord>, schema: Vec<ColumnSchema>) -> Self {
        DataFrame {
            headers,
            records,
            schema,
        }
    }

    pub fn rows_count(&self) -> usize {
        self.records.len()
    }

    pub fn columns_count(&self) -> usize {
        self.headers.len()
    }
}
