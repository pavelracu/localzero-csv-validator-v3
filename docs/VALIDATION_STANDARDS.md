# Validation & Resolution Standards

## Tiered Validation Approach

1. **Tier 1 — Syntax (RFC / E.164)**  
   - **Email:** RFC 5322–style validation via `email_address`; duplicate `@` removed before validation.  
   - **Phone:** E.164-style (digits, optional leading `+`); US default country code `1`; extensions stripped (x, ext.).  
   - **Date:** ISO 8601, US (MM/DD/YYYY), EU (DD-MM-YYYY), YYYY/MM/DD.  
   - **ZIP (US):** 5 digits; padded with leading zeros.

2. **Tier 2 — Format Normalization**  
   - **Email:** Remove duplicate `@`, trim, lowercase domain; output valid per `email_address`.  
   - **Phone:** Normalize to E.164 (+1XXXXXXXXXX for US); strip extensions.  
   - **Date:** Parse cascade → ISO 8601 (YYYY-MM-DD); fallback 1970-01-01.  
   - **States:** 2-letter abbreviation → full name (e.g. CA → California).  
   - **ZIP:** Pad to 5 digits (US).

3. **Tier 3 — Domain / Carrier (not implemented)**  
   - DNS MX lookups and carrier checks would require network access.  
   - LocalZero is offline-first; no data leaves the device, so Tier 3 is intentionally skipped.

## Libraries Used

- **email_address** — RFC 5322–style email validation.  
- **chrono** — Date parsing and ISO 8601 formatting.  
- **regex** — Pattern detection (SSN, IPv4, etc.).  
- Phone E.164 logic is implemented in-tree (no `phonenumber` crate) to keep Wasm small and avoid extra deps.

## ISO 8000–Style Principles

- **Master data:** State names and abbreviations, date formats, E.164 rules.  
- **Single source of truth:** Normalized output (E.164, ISO 8601, RFC-style email).  
- **Semantic validation:** US ZIP length, US phone length, etc.
