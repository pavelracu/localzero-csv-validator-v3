import { useState, useEffect } from 'react';
import { useDataStream } from './hooks/useDataStream';
import { VirtualizedTable } from './components/grid/VirtualizedTable';
import { Import } from './components/wizard/Import';
import { Mapping } from './components/wizard/Mapping';
import { Loader2 } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { AppHeader } from './components/layout/AppHeader';
import { StatusBar } from './components/layout/StatusBar';
import { SchemaStorage } from './lib/storage';
import { SchemaPreset } from './types';

function App() {
  const { 
    isReady, 
    stage,
    schema, 
    rowCount, 
    errors, 
    pendingValidation,
    loadFile, 
    fetchRows, 
    updateColumnType,
    runBatchValidation,
    applyCorrection,
    getRow,
    confirmSchema
  } = useDataStream();

  const [isValidating, setIsValidating] = useState(false);
  const [architectSamples, setArchitectSamples] = useState<Record<number, string[]>>({});

  useEffect(() => {
    if (stage === 'ARCHITECT' && rowCount > 0) {
        fetchRows(0, 10).then(rows => setArchitectSamples(rows));
    }
  }, [stage, rowCount, fetchRows]);

  const [presets, setPresets] = useState<SchemaPreset[]>(SchemaStorage.list());

  // Update the save handler
  const handleSavePreset = () => {
    const name = prompt("Name this preset (e.g., 'Monthly Sales'):");
    if (name) {
      SchemaStorage.save(name, schema);
      // Update local state instead of reloading the page
      setPresets(SchemaStorage.list()); 
      alert("Preset saved locally.");
    }
  };

  const handleApplyPreset = (preset: SchemaPreset) => {
    schema.forEach((col, idx) => {
        const savedType = preset.mapping[col.name];
        if (savedType) updateColumnType(idx, savedType);
    });
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background">
      <AppHeader 
        isReady={isReady}
        stage={stage}
        pendingValidationCount={pendingValidation.size}
        isValidating={isValidating}
        onRunValidation={async () => {
          setIsValidating(true);
          await runBatchValidation();
          setIsValidating(false);
        }}
        onSavePreset={handleSavePreset}
        onLoadPreset={handleApplyPreset}
        presets={presets} // Use the state variable here
      />
      
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {stage === 'IMPORT' && (
          <Import 
            onFileSelect={loadFile}
            onPresetSelect={handleApplyPreset} // Use the actual application logic
            isReady={isReady}
            presets={presets} // Pass the dynamic list from state
          />
        )}

        {stage === 'ARCHITECT' && (
        <Mapping
          schema={schema}
          sampleRows={architectSamples}
          onTypeChange={updateColumnType}
          onConfirm={confirmSchema}
          onSavePreset={handleSavePreset} // Pass it here
        />
      )}

        {stage === 'STUDIO' && (
          <VirtualizedTable 
            rowCount={rowCount}
            schema={schema}
            errors={errors}
            pendingValidation={pendingValidation}
            getRow={getRow}
            fetchRows={fetchRows}
            onTypeChange={updateColumnType}
            onSelectFix={(idx) => console.log('Fixing col:', idx)}
          />
        )}

        {stage === 'PROCESSING' && (
           <div className="h-full flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-primary mb-2" />
              <p>Validating {rowCount.toLocaleString()} rows...</p>
           </div>
        )}
      </main>

      {['ARCHITECT', 'STUDIO'].includes(stage) && (
        <StatusBar rowCount={rowCount} errorCount={errors.size} />
      )}
    </div>
  );
}

export default App;