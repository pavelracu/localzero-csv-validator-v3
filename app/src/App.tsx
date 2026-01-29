import { useState, useEffect } from 'react';
import { useDataStream } from './hooks/useDataStream';
import { VirtualizedTable } from './components/grid/VirtualizedTable';
import { Import } from './components/wizard/Import';
import { Mapping } from './components/wizard/Mapping';
import { Loader2 } from 'lucide-react';
import { AppHeader } from './components/layout/AppHeader';
import { StatusBar } from './components/layout/StatusBar';
import { StepIndicator } from './components/layout/StepIndicator';
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
    isLoadingFile,
    dataVersion,
    loadFile, 
    fetchRows, 
    updateColumnType,
    runBatchValidation,
    applyCorrection,
    getSuggestions,
    applySuggestion,
    getRow,
    confirmSchema
  } = useDataStream();

  const [isValidating, setIsValidating] = useState(false);
  const [schemaSamples, setSchemaSamples] = useState<Record<number, string[]>>({});

  useEffect(() => {
    if (stage === 'SCHEMA' && rowCount > 0) {
        fetchRows(0, 10).then(rows => setSchemaSamples(rows));
    }
  }, [stage, rowCount, fetchRows]);

  const [presets, setPresets] = useState<SchemaPreset[]>(SchemaStorage.list());

  const handleSavePreset = (name: string) => {
    if (!name?.trim()) return;
    SchemaStorage.save(name.trim(), schema);
    setPresets(SchemaStorage.list());
  };

  const handleApplyPreset = (preset: SchemaPreset) => {
    schema.forEach((col, idx) => {
        const savedType = preset.mapping[col.name];
        if (savedType) updateColumnType(idx, savedType);
    });
  };

  const handleExportCSV = async () => {
    if (rowCount === 0 || schema.length === 0) return;
    
    // Build CSV header
    const header = schema.map(col => col.name).join(',');
    const rows: string[] = [header];
    
    // Fetch all rows in chunks
    const chunkSize = 1000;
    for (let start = 0; start < rowCount; start += chunkSize) {
      await fetchRows(start, Math.min(chunkSize, rowCount - start));
      for (let i = start; i < start + chunkSize && i < rowCount; i++) {
        const row = getRow(i);
        if (row) {
          // Escape CSV values (handle commas, quotes, newlines)
          const escapedRow = row.map(val => {
            const str = String(val || '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          });
          rows.push(escapedRow.join(','));
        }
      }
    }
    
    // Create blob and download
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `localzero-export-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
        onExport={handleExportCSV}
        canExport={stage === 'STUDIO' && rowCount > 0}
      />
      
      {stage !== 'IMPORT' && <StepIndicator currentStage={stage} />}
      
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {stage === 'IMPORT' && (
          <Import 
            onFileSelect={loadFile}
            isReady={isReady}
            isLoadingFile={isLoadingFile}
          />
        )}

        {stage === 'SCHEMA' && (
        <Mapping
          schema={schema}
          sampleRows={schemaSamples}
          onTypeChange={updateColumnType}
          onConfirm={confirmSchema}
          onSavePreset={handleSavePreset}
          onLoadPreset={handleApplyPreset}
          presets={presets}
        />
      )}

        {stage === 'STUDIO' && (
          <VirtualizedTable 
            rowCount={rowCount}
            schema={schema}
            errors={errors}
            pendingValidation={pendingValidation}
            dataVersion={dataVersion}
            getRow={getRow}
            fetchRows={fetchRows}
            onTypeChange={updateColumnType}
            getSuggestions={getSuggestions}
            applySuggestion={applySuggestion}
            applyCorrection={applyCorrection}
          />
        )}

        {stage === 'PROCESSING' && (
           <div className="h-full flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-primary mb-2" />
              <p className="text-lg font-medium mb-1">Validating {rowCount.toLocaleString()} rows...</p>
              <p className="text-sm text-muted-foreground">Validation runs locally — no data is uploaded.</p>
           </div>
        )}
      </main>

      {['SCHEMA', 'STUDIO'].includes(stage) && (
        <StatusBar rowCount={rowCount} errorCount={errors.size} />
      )}
    </div>
  );
}

export default App;