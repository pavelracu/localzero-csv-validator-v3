import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDataStream } from './hooks/useDataStream';
import { VirtualizedTable } from './components/grid/VirtualizedTable';
import { IssuesPanel } from './components/editor/IssuesPanel';
import { Import } from './components/wizard/Import';
import { Mapping } from './components/wizard/Mapping';
import { SchemaSelect } from './components/wizard/SchemaSelect';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/workspace/Layout';
import { SchemaStorage } from './lib/storage';
import { putWorkspace, addTriageLogEntry, updateSchemaSnapshot } from './lib/workspaceDb';
import { useWorkspace } from './contexts/WorkspaceContext';
import { SchemaPreset, type ColumnType, type Suggestion } from './types';
import { CUSTOM_SCHEMA_ID, getSchemaById } from './lib/schemas';
import type { SchemaDefinition } from './lib/schemas';

function formatProgressCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function App() {
  const {
    setActiveWorkspace,
    setFileMetadata,
    setPrivacyShieldStatus,
    bumpWorkspaceListVersion,
    activeWorkspaceId,
    fileMetadata,
  } = useWorkspace();

  const {
    isReady,
    stage,
    schema,
    rowCount,
    errors,
    pendingValidation,
    isLoadingFile,
    loadProgress,
    currentProcess,
    dataVersion,
    goToIngestion,
    loadFile,
    fetchRows,
    updateColumnType,
    runBatchValidation,
    applyCorrection: applyCorrectionBase,
    getSuggestions,
    applySuggestion: applySuggestionBase,
    getRow,
    updateCell,
    confirmSchema: confirmSchemaBase,
    findReplaceAll: findReplaceAllBase,
  } = useDataStream();

  const [selectedSchema, setSelectedSchema] = useState<SchemaDefinition | null>(() => getSchemaById(CUSTOM_SCHEMA_ID) ?? null);
  const [selectedPreset, setSelectedPreset] = useState<SchemaPreset | null>(null);

  const [isValidating, setIsValidating] = useState(false);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [schemaSamples, setSchemaSamples] = useState<Record<number, string[]>>({});
  const [fixingColumn, setFixingColumn] = useState<number | null>(null);

  const totalErrorCount = useMemo(() => {
    let sum = 0;
    errors.forEach((set) => { sum += set.size; });
    return sum;
  }, [errors]);

  useEffect(() => {
    if ((stage === 'INGESTION' || stage === 'SCHEMA') && rowCount > 0) {
        fetchRows(0, 10).then(rows => setSchemaSamples(rows));
    }
  }, [stage, rowCount, fetchRows]);

  const [presets, setPresets] = useState<SchemaPreset[]>(SchemaStorage.list());

  const handleSavePreset = (name: string) => {
    if (!name?.trim()) return;
    SchemaStorage.save(name.trim(), schema);
    setPresets(SchemaStorage.list());
  };

  const handleDeletePreset = useCallback((preset: SchemaPreset) => {
    SchemaStorage.remove(preset.id);
    setPresets(SchemaStorage.list());
    if (selectedPreset?.id === preset.id) {
      setSelectedPreset(null);
      setSelectedSchema(getSchemaById(CUSTOM_SCHEMA_ID) ?? null);
    }
  }, [selectedPreset?.id]);


  const handleFileSelect = useCallback(
    async (file: File) => {
      try {
        await loadFile(file);
        setIsSavingWorkspace(true);
        setIsPersisting(true);
        const id = crypto.randomUUID();
        const now = Date.now();
        const fileMetadata = { name: file.name, size: file.size };
        await putWorkspace({
          id,
          createdAt: now,
          updatedAt: now,
          fileMetadata,
          schemaSnapshot: {},
          triageLog: [],
        });
        setActiveWorkspace(id);
        setFileMetadata(fileMetadata);
        setPrivacyShieldStatus('local-only');
        bumpWorkspaceListVersion();
      } catch (err) {
        console.error('Workspace initialization failed', err);
        throw err;
      } finally {
        setIsSavingWorkspace(false);
        setIsPersisting(false);
      }
    },
    [loadFile, setActiveWorkspace, setFileMetadata, setPrivacyShieldStatus, bumpWorkspaceListVersion]
  );

  const applyCorrection = useCallback(
    async (colIdx: number, strategy: string) => {
      await applyCorrectionBase(colIdx, strategy);
      if (activeWorkspaceId) {
        await addTriageLogEntry(activeWorkspaceId, {
          at: Date.now(),
          colIdx,
          action: 'applyCorrection',
          suggestion: strategy,
        });
      }
    },
    [applyCorrectionBase, activeWorkspaceId]
  );

  const applySuggestion = useCallback(
    async (colIdx: number, suggestion: Suggestion) => {
      await applySuggestionBase(colIdx, suggestion);
      if (activeWorkspaceId) {
        await addTriageLogEntry(activeWorkspaceId, {
          at: Date.now(),
          colIdx,
          action: 'applySuggestion',
          suggestion: JSON.stringify(suggestion),
        });
      }
    },
    [applySuggestionBase, activeWorkspaceId]
  );

  const confirmSchema = useCallback(async () => {
    await confirmSchemaBase();
    if (activeWorkspaceId) {
      const schemaSnapshot = schema.reduce(
        (acc, col) => {
          acc[col.name] = col.detected_type;
          return acc;
        },
        {} as Record<string, ColumnType>
      );
      await updateSchemaSnapshot(activeWorkspaceId, schemaSnapshot);
    }
  }, [confirmSchemaBase, activeWorkspaceId, schema]);

  const findReplaceAll = useCallback(
    async (find: string, replace: string) => {
      const count = await findReplaceAllBase(find, replace);
      if (activeWorkspaceId) {
        await addTriageLogEntry(activeWorkspaceId, {
          at: Date.now(),
          colIdx: -1,
          action: 'findReplaceAll',
          suggestion: JSON.stringify({ find, replace, count }),
        });
      }
      return count;
    },
    [findReplaceAllBase, activeWorkspaceId]
  );

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
    <Layout
      isReady={isReady}
      stage={stage}
      rowCount={rowCount}
      errorCount={totalErrorCount}
      schema={schema}
      isSavingWorkspace={isSavingWorkspace}
      isPersisting={isPersisting}
      pendingValidationCount={pendingValidation.size}
      isValidating={isValidating}
      onRunValidation={async () => {
        setIsValidating(true);
        await runBatchValidation();
        setIsValidating(false);
      }}
      onExport={handleExportCSV}
      canExport={stage === 'STUDIO' && rowCount > 0}
    >
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {stage === 'SCHEMA' && (
          <SchemaSelect
            presets={presets}
            selectedId={selectedPreset?.id ?? selectedSchema?.id ?? null}
            onSelectSchema={(schema) => {
              setSelectedSchema(schema);
              setSelectedPreset(null);
            }}
            onSelectPreset={(preset) => {
              setSelectedPreset(preset);
              setSelectedSchema(null);
            }}
            onDeletePreset={handleDeletePreset}
            onContinue={goToIngestion}
          />
        )}

        {stage === 'INGESTION' && rowCount === 0 && (
          <Import
            onFileSelect={handleFileSelect}
            isReady={isReady}
            isLoadingFile={isLoadingFile}
            loadProgress={loadProgress}
          />
        )}

        {stage === 'INGESTION' && rowCount > 0 && (
          <Mapping
            schema={schema}
            sampleRows={schemaSamples}
            onTypeChange={updateColumnType}
            onConfirm={confirmSchema}
            onSavePreset={handleSavePreset}
            schemaHints={selectedPreset?.mapping ?? selectedSchema?.columnHints}
            fileName={fileMetadata?.name}
            rowCount={rowCount}
          />
        )}

        {stage === 'STUDIO' && (
          <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
            <IssuesPanel
              schema={schema}
              errors={errors}
              getSuggestions={getSuggestions}
              applySuggestion={applySuggestion}
              onOpenColumnFix={setFixingColumn}
            />
            <div className="flex-1 min-w-0 min-h-0 relative">
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
              updateCell={updateCell}
              findReplaceAll={findReplaceAll}
              fixingColumn={fixingColumn}
              onOpenFixPanel={setFixingColumn}
              onCloseFixPanel={() => setFixingColumn(null)}
            />
            </div>
          </div>
        )}

        {stage === 'PROCESSING' && (
          <div className="h-full flex flex-col items-center justify-center gap-6 px-6">
            <Loader2 className="h-10 w-10 animate-spin text-primary shrink-0" aria-hidden />
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-foreground">
                {currentProcess?.label ?? 'Validating…'}
              </p>
              {currentProcess && (currentProcess.rowsProcessed != null || currentProcess.rowsPerSec != null) && (
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground tabular-nums">
                  {currentProcess.totalRows != null && currentProcess.rowsProcessed != null && (
                    <span>
                      {formatProgressCount(currentProcess.rowsProcessed)} / {formatProgressCount(currentProcess.totalRows)} rows
                    </span>
                  )}
                  {currentProcess.rowsPerSec != null && currentProcess.rowsPerSec > 0 && (
                    <span>{formatProgressCount(currentProcess.rowsPerSec)} rows/s</span>
                  )}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Validation runs locally — no data is uploaded.
              </p>
            </div>
            {currentProcess?.totalRows != null && currentProcess.totalRows > 0 && (currentProcess.rowsProcessed ?? 0) >= 0 && (
              <div
                className="w-full max-w-md h-2 rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.min(100, Math.round(((currentProcess.rowsProcessed ?? 0) / currentProcess.totalRows) * 100))}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Validation progress"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                  style={{
                    width: `${Math.min(100, ((currentProcess.rowsProcessed ?? 0) / currentProcess.totalRows) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default App;