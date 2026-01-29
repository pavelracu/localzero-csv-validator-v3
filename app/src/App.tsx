import { useState, useEffect } from 'react';
import { useDataStream } from './hooks/useDataStream';
import { VirtualizedTable } from './components/grid/VirtualizedTable';
import { Import } from './components/wizard/Import';
import { Mapping } from './components/wizard/Mapping';
import { Loader2 } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { AppHeader } from './components/layout/AppHeader';
import { StatusBar } from './components/layout/StatusBar';

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
    getSuggestions,
    applySuggestion,
    getRow,
    confirmSchema
  } = useDataStream();

  const [isValidating, setIsValidating] = useState(false);
  const [architectSamples, setArchitectSamples] = useState<Record<number, string[]>>({});
  const [fixingColumn, setFixingColumn] = useState<number | null>(null);

  useEffect(() => {
    if (stage === 'ARCHITECT' && rowCount > 0) {
        fetchRows(0, 10).then(rows => {
            setArchitectSamples(rows);
        });
    }
  }, [stage, rowCount, fetchRows]);

  const handleFileSelect = async (file: File) => {
    try {
      await loadFile(file);
    } catch (err) {
      console.error("Error loading file:", err);
      alert("Failed to parse CSV file.");
    }
  };

  const handlePresetSelect = async (presetId: string) => {
     alert(`Preset ${presetId} selected (Functionality mocked)`);
     console.log("Preset selected:", presetId);
  };
  
  const handleRunValidation = async () => {
    setIsValidating(true);
    await runBatchValidation();
    setIsValidating(false);
  };

  const showStatusBar = stage === 'ARCHITECT' || stage === 'STUDIO' || stage === 'PROCESSING';

  const selectedColumnForFix = fixingColumn !== null && schema[fixingColumn]
  ? { 
      index: fixingColumn, 
      schema: schema[fixingColumn],
      errorCount: errors.get(fixingColumn)?.size || 0,
    } 
  : null;


  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background font-sans">
      <AppHeader 
        isReady={isReady}
        stage={stage}
        pendingValidationCount={pendingValidation.size}
        isValidating={isValidating}
        onRunValidation={handleRunValidation}
      />
      
     <main className="flex-1 overflow-hidden relative flex flex-col">
  
  {/* Stage 1: Import */}
  {stage === 'IMPORT' && (
    <div className="h-full w-full">
      <Import 
        onFileSelect={handleFileSelect}
        onPresetSelect={handlePresetSelect}
        isReady={isReady}
      />
    </div>
  )}

  {/* Stage 2: Mapping (Was SchemaArchitect) */}
  {stage === 'ARCHITECT' && (
    <div className="h-full w-full overflow-hidden">
       <Mapping
          schema={schema}
          sampleRows={architectSamples} // Ensure this matches your hook's return value
          onTypeChange={updateColumnType}
          onConfirm={confirmSchema} // Ensure this matches your hook's return value
       />
    </div>
  )}

  {/* Stage 3: Editor (Was Studio) */}
  {stage === 'STUDIO' && (
    <div className="h-full w-full">
<VirtualizedTable 
   rowCount={rowCount}
   schema={schema}
   errors={errors}
   pendingValidation={pendingValidation} // Pass this from hook
   getRow={getRow} // Critical
   fetchRows={fetchRows}
   onTypeChange={updateColumnType}
   onSelectFix={setFixingColumn} // Handled internally by Table now, or lift state up
/>
    </div>
  )}

  {/* Processing State */}
  {stage === 'PROCESSING' && (
     <div className="h-full flex flex-col items-center justify-center">
        <Card className="p-8 flex flex-col items-center">
          <Loader2 size={32} className="animate-spin mb-4 text-primary"/>
          <p>Processing {rowCount.toLocaleString()} rows...</p>
        </Card>
     </div>
  )}
</main>

      {showStatusBar && <StatusBar rowCount={rowCount} errorCount={errors.size} />}
    </div>
  );
}

export default App;
