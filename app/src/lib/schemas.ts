import type { ColumnType } from '../types';

export interface SchemaDefinition {
  id: string;
  name: string;
  description: string;
  preVerified?: boolean;
  /** Column name → type hints applied after file load when names match. */
  columnHints?: Record<string, ColumnType>;
}

export const CUSTOM_SCHEMA_ID = 'custom';

/** Predefined validation standards. columnHints can be expanded later with real name→type maps. */
export const SCHEMA_REGISTRY: SchemaDefinition[] = [
  {
    id: CUSTOM_SCHEMA_ID,
    name: 'Custom Standard',
    description: 'Initialize manual mapping logic.',
  },
  {
    id: 'cdisc',
    name: 'Clinical Trial (CDISC)',
    description: 'Regulatory patient data standards.',
    preVerified: true,
    columnHints: {},
  },
  {
    id: 'iso20022',
    name: 'ISO 20022 Financial',
    description: 'Financial messaging and banking data.',
    preVerified: true,
    columnHints: {},
  },
  {
    id: 'gdpr-pii',
    name: 'GDPR PII Audit',
    description: 'Personal identifiable info scrubbing.',
    preVerified: true,
    columnHints: {},
  },
  {
    id: 'kyc',
    name: 'KYC Compliance',
    description: 'Identity verification formatting.',
    preVerified: true,
    columnHints: {},
  },
];

export function getSchemaById(id: string): SchemaDefinition | undefined {
  return SCHEMA_REGISTRY.find((s) => s.id === id);
}
