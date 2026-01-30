import type { ColumnType } from '../types';

/**
 * Suggests a ColumnType from a column name (case-insensitive, partial match).
 * Used to auto-map more columns when core inference left them as Text.
 * Returns null if no confident suggestion.
 */
export function suggestTypeFromColumnName(columnName: string): ColumnType | null {
  const n = columnName.toLowerCase().trim().replace(/[\s_\-().]+/g, ' ');
  const tokens = n.split(/\s+/).filter(Boolean);

  if (tokens.some((t) => t === 'email' || t === 'e-mail' || t === 'mail')) return 'Email';
  if (tokens.some((t) => t === 'phone' || t === 'mobile' || t === 'tel' || t === 'cell' || t === 'fax')) return 'PhoneUS';
  if (tokens.some((t) => t === 'date' || t === 'dob' || t === 'birth' || t === 'created' || t === 'updated' || t === 'modified')) return 'Date';
  if (tokens.some((t) => t === 'count' || t === 'num' || t === 'number' || t === 'id') && !tokens.includes('guid')) return 'Integer';
  if (tokens.some((t) => t === 'amount' || t === 'price' || t === 'rate' || t === 'percent')) return 'Float';
  if (tokens.some((t) => t === 'active' || t === 'flag' || t.startsWith('is_') || t.startsWith('has_'))) return 'Boolean';

  return null;
}
