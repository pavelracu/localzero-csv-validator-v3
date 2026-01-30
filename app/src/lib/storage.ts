import { SchemaPreset, ColumnType, ColumnSchema } from '../types';

const PRESETS_KEY = 'localzero_presets_v1';

export const SchemaStorage = {
    save: (name: string, schema: ColumnSchema[]) => {
        const presets = SchemaStorage.list();
        const mapping = schema.reduce((acc, col) => {
            acc[col.name] = col.detected_type;
            return acc;
        }, {} as Record<string, ColumnType>);

        const newPreset: SchemaPreset = {
            id: crypto.randomUUID(),
            name,
            mapping,
            lastUsed: Date.now()
        };

        localStorage.setItem(PRESETS_KEY, JSON.stringify([...presets, newPreset]));
        return newPreset;
    },

    list: (): SchemaPreset[] => {
        const data = localStorage.getItem(PRESETS_KEY);
        try {
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    remove: (id: string) => {
        const presets = SchemaStorage.list().filter((p) => p.id !== id);
        localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    },
};