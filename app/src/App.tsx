import { useState, useEffect } from 'react';
import { useDataStream } from './hooks/useDataStream';
import { VirtualizedTable } from './components/grid/VirtualizedTable';
import { ImportHub } from './components/wizard/ImportHub';
import { SchemaArchitect } from './components/wizard/SchemaArchitect';
import { FileType, CheckCircle, AlertTriangle, Play, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

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
    applyFix,
    getRow,
    confirmSchema
  } = useDataStream();

  const [isValidating, setIsValidating] = useState(false);
  const [architectSamples, setArchitectSamples] = useState<Record<number, string[]>>({});

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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start p-8 font-sans">
      <div className="w-full max-w-[1600px] space-y-6">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">LocalZero Schema Engine</h1>
            <Badge variant={isReady ? "secondary" : "warning"} className="tracking-wide">
                {stage === 'IMPORT' ? 'READY' : stage}
            </Badge>
          </div>
          
          {stage === 'STUDIO' && (
             <div className="flex items-center gap-4">
                {pendingValidation.size > 0 && (
                    <Button
                        onClick={async () => {
                            setIsValidating(true);
                            await runBatchValidation();
                            setIsValidating(false);
                        }}
                        disabled={isValidating}
                        className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-none"
                    >
                        {isValidating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                        Validate {pendingValidation.size} Changes
                    </Button>
                )}

                <div className="flex items-center gap-6 text-sm text-muted-foreground bg-background px-4 py-2 rounded-lg border border-border shadow-sm">
                    <div className="flex items-center gap-2">
                    <FileType size={16} />
                    <span>{rowCount.toLocaleString()} rows</span>
                    </div>
                    <div className="h-4 w-px bg-border"></div>
                    <div className="flex items-center gap-2">
                    {errors.size > 0 ? (
                        <>
                            <AlertTriangle size={16} className="text-amber-500" />
                            <span className="font-medium text-amber-700">{errors.size} columns with errors</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle size={16} className="text-emerald-500" />
                            <span className="font-medium text-emerald-700">All Valid</span>
                        </>
                    )}
                    </div>
                </div>
             </div>
          )}
        </div>

        <main className="w-full">
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
               <Card className="flex flex-col items-center justify-center min-h-[400px]">
                   <Loader2 size={48} className="text-primary animate-spin mb-4" />
                   <h3 className="text-xl font-semibold text-foreground">Validating Data...</h3>
                   <p className="text-muted-foreground">Processing {rowCount.toLocaleString()} rows against your schema</p>
               </Card>
           )}

           {stage === 'STUDIO' && (
              <div className="bg-background rounded-xl shadow-sm border border-border overflow-hidden">
                 <VirtualizedTable 
                    rowCount={rowCount}
                    schema={schema}
                    errors={errors}
                    pendingValidation={pendingValidation}
                    fetchRows={fetchRows}
                    onTypeChange={updateColumnType}
                    onFix={applyFix}
                    getRow={getRow}
                 />
              </div>
           )}
        </main>

      </div>
    </div>
  );
}

export default App;
