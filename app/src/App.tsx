import { useState, useEffect } from 'react';
import { useDataStream } from './hooks/useDataStream';
import { VirtualizedTable } from './components/grid/VirtualizedTable';
import { ImportHub } from './components/wizard/ImportHub';
import { SchemaArchitect } from './components/wizard/SchemaArchitect';
import { Loader2 } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { AppHeader } from './components/layout/AppHeader';
import { StatusBar } from './components/layout/StatusBar';
import { FixSidebar } from './components/mechanic/FixSidebar';

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
      
      <main className="flex-1 flex flex-col overflow-auto">
         {stage === 'IMPORT' && (
             <ImportHub 
                onFileSelect={handleFileSelect} 
                onPresetSelect={handlePresetSelect} 
                isReady={isReady} 
             />
         )}

         {stage === 'ARCHITECT' && (
             <SchemaArchitect 
                schema={schema} 
                sampleRows={architectSamples}
                onTypeChange={updateColumnType}
                onConfirm={confirmSchema}
             />
         )}

         {stage === 'PROCESSING' && (
             <div className="flex-1 flex items-center justify-center">
                <Card className="flex flex-col items-center justify-center p-8">
                     <Loader2 size={48} className="text-primary animate-spin mb-4" />
                     <h3 className="text-xl font-semibold text-foreground">Validating Data...</h3>
                     <p className="text-muted-foreground">Processing {rowCount.toLocaleString()} rows against your schema</p>
                </Card>
             </div>
         )}

         {stage === 'STUDIO' && (
            <div className="flex-1 flex min-h-0">
               <div className="flex-1 relative">
                 <VirtualizedTable 
                    rowCount={rowCount}
                    schema={schema}
                    errors={errors}
                    pendingValidation={pendingValidation}
                    fetchRows={fetchRows}
                    onTypeChange={updateColumnType}
                    onSelectFix={setFixingColumn}
                    getRow={getRow}
                 />
               </div>
                {fixingColumn !== null && (
                    <div className="w-[400px] border-l border-border flex-shrink-0">
                        <FixSidebar 
                            selectedColumn={selectedColumnForFix}
                            onCorrection={applyCorrection}
                            onGetSuggestions={getSuggestions}
                            onApplySuggestion={applySuggestion}
                            onClose={() => setFixingColumn(null)}
                        />
                   </div>
                )}
            </div>
         )}
      </main>

      {showStatusBar && <StatusBar rowCount={rowCount} errorCount={errors.size} />}
    </div>
  );
}

export default App;
