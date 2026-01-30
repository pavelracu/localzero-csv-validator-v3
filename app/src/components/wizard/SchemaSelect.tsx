import React from 'react';
import { Plus, Settings2, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SCHEMA_REGISTRY, CUSTOM_SCHEMA_ID } from '@/lib/schemas';
import type { SchemaDefinition } from '@/lib/schemas';

interface SchemaSelectProps {
  onSelect: (schema: SchemaDefinition) => void;
  onContinue: () => void;
  selectedId: string | null;
}

export const SchemaSelect: React.FC<SchemaSelectProps> = ({
  onSelect,
  onContinue,
  selectedId,
}) => {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-muted/10 p-6 overflow-auto">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Select schema
          </h2>
          <p className="text-muted-foreground">
            Initialize local data sandbox with a compliance standard.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SCHEMA_REGISTRY.map((schema) => {
            const isCustom = schema.id === CUSTOM_SCHEMA_ID;
            const isSelected = selectedId === schema.id;

            return (
              <Card
                key={schema.id}
                onClick={() => onSelect(schema)}
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
    </div>
  );
};
