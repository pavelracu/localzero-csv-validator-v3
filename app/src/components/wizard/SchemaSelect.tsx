import React, { useState } from 'react';
import { Plus, Settings2, Check, FolderOpen, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { SCHEMA_REGISTRY, CUSTOM_SCHEMA_ID } from '@/lib/schemas';
import type { SchemaDefinition } from '@/lib/schemas';
import type { SchemaPreset } from '@/types';

interface SchemaSelectProps {
  presets: SchemaPreset[];
  onSelectSchema: (schema: SchemaDefinition) => void;
  onSelectPreset: (preset: SchemaPreset) => void;
  onDeletePreset: (preset: SchemaPreset) => void;
  onContinue: () => void;
  /** Id of the selected item (schema id or preset id). */
  selectedId: string | null;
}

export const SchemaSelect: React.FC<SchemaSelectProps> = ({
  presets,
  onSelectSchema,
  onSelectPreset,
  onDeletePreset,
  onContinue,
  selectedId,
}) => {
  const [presetToDelete, setPresetToDelete] = useState<SchemaPreset | null>(null);

  const handleSelectSchema = (schema: SchemaDefinition) => {
    onSelectSchema(schema);
  };

  const handleSelectPreset = (preset: SchemaPreset) => {
    onSelectPreset(preset);
  };

  const handleDeleteClick = (e: React.MouseEvent, preset: SchemaPreset) => {
    e.stopPropagation();
    setPresetToDelete(preset);
  };

  const handleConfirmDelete = () => {
    if (presetToDelete) {
      onDeletePreset(presetToDelete);
      setPresetToDelete(null);
    }
  };

  return (
    <div className="h-full w-full min-h-0 flex flex-col overflow-auto bg-muted/10 p-6">
      <div className="w-full max-w-4xl mx-auto flex-shrink-0 space-y-8 pb-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Select schema
          </h2>
          <p className="text-muted-foreground">
            Choose a predefined standard, a saved schema, or start with a custom mapping.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SCHEMA_REGISTRY.map((schema) => {
            const isCustom = schema.id === CUSTOM_SCHEMA_ID;
            const isSelected = selectedId === schema.id;

            return (
              <Card
                key={schema.id}
                onClick={() => handleSelectSchema(schema)}
                className={`
                  cursor-pointer transition-all duration-200 border-2
                  hover:border-primary/50 hover:shadow-md
                  ${isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-border'}
                `}
              >
                <CardContent className="p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`
                        p-2.5 rounded-md shrink-0
                        ${isCustom ? 'bg-muted' : 'bg-primary/10 text-primary'}
                      `}
                    >
                      {isCustom ? (
                        <Plus size={24} className="text-muted-foreground" />
                      ) : (
                        <Settings2 size={24} />
                      )}
                    </div>
                    {schema.preVerified && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        PRE-VERIFIED
                        <Check size={12} className="text-[var(--success)]" />
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    {schema.name.toUpperCase()}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {schema.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
          {presets.map((preset) => {
            const isSelected = selectedId === preset.id;
            const colCount = Object.keys(preset.mapping).length;

            return (
              <Card
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`
                  cursor-pointer transition-all duration-200 border-2
                  hover:border-primary/50 hover:shadow-md
                  ${isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-border'}
                `}
              >
                <CardContent className="p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2.5 rounded-md shrink-0 bg-primary/10 text-primary">
                      <FolderOpen size={24} />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        SAVED
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, preset)}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label={`Delete schema ${preset.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    {preset.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {colCount} column{colCount !== 1 ? 's' : ''} · mapping will be applied after you load a file
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-center">
          <Button
            onClick={onContinue}
            disabled={!selectedId}
            className="gap-2 bg-[var(--success)] hover:opacity-90 text-white px-6"
          >
            Continue
          </Button>
        </div>
      </div>

      <Dialog open={!!presetToDelete} onOpenChange={(open) => !open && setPresetToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete schema</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete &quot;{presetToDelete?.name}&quot;? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPresetToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
