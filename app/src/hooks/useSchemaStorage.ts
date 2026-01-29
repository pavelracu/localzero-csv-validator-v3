import { useCallback } from 'react';
import { ColumnSchema } from '../types';

const STORAGE_KEY = 'localzero:saved-schemas';

interface SavedSchemas {
  [name: string]: ColumnSchema[];
}

function readSchemas(): SavedSchemas {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch (error) {
        console.error("Failed to read schemas from localStorage", error);
        return {};
    }
}

function writeSchemas(schemas: SavedSchemas) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(schemas));
    } catch (error) {
        console.error("Failed to write schemas to localStorage", error);
    }
}

export function useSchemaStorage() {
  const getSavedSchemas = useCallback((): { name: string; schema: ColumnSchema[] }[] => {
    const schemas = readSchemas();
    return Object.entries(schemas).map(([name, schema]) => ({ name, schema }));
  }, []);

  const saveSchema = useCallback((name: string, schema: ColumnSchema[]): boolean => {
    if (!name || !schema || schema.length === 0) {
        return false;
    }
    const allSchemas = readSchemas();
    allSchemas[name] = schema;
    writeSchemas(allSchemas);
    return true;
  }, []);

  const loadSchema = useCallback((name: string): ColumnSchema[] | null => {
    const allSchemas = readSchemas();
    return allSchemas[name] || null;
  }, []);

  const deleteSchema = useCallback((name: string): boolean => {
    const allSchemas = readSchemas();
    if (allSchemas[name]) {
      delete allSchemas[name];
      writeSchemas(allSchemas);
      return true;
    }
    return false;
  }, []);

  return { saveSchema, loadSchema, getSavedSchemas, deleteSchema };
}
