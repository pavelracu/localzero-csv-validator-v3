import { useState, useEffect, useCallback, useRef } from 'react';
import { ColumnSchema, ColumnType, DatasetSummary, Suggestion, SuggestionReport } from '../types';
import DataWorker from '../workers/data.worker?worker';

export type AppStage = 'SCHEMA' | 'INGESTION' | 'PROCESSING' | 'STUDIO';

export interface UseDataStreamReturn {
    isReady: boolean;
    stage: AppStage;
    goToIngestion: () => void;
    schema: ColumnSchema[];
    initialSchema: ColumnSchema[];
    rowCount: number;
    errors: Map<number, Set<number>>;
    pendingValidation: Set<number>;
    /** True while a file is being loaded (parsed locally). No data is uploaded. */
    isLoadingFile: boolean;
    /** Bumps when row data is invalidated (e.g. after apply fix). Table uses this to refetch visible rows. */
    dataVersion: number;
    loadFile: (file: File) => Promise<void>;
    fetchRows: (start: number, limit: number) => Promise<Record<number, string[]>>;
    updateColumnType: (colIdx: number, newType: ColumnType) => Promise<void>;
    getRow: (index: number) => string[] | undefined;
    runBatchValidation: () => Promise<void>;
    applyCorrection: (colIdx: number, strategy: string) => Promise<void>;
    getSuggestions: (colIdx: number) => Promise<SuggestionReport[]>;
    applySuggestion: (colIdx: number, suggestion: Suggestion) => Promise<void>;
    updateCell: (rowIdx: number, colIdx: number, value: string) => Promise<void>;
    confirmSchema: () => Promise<void>;
}

export function useDataStream(): UseDataStreamReturn {
    const [isReady, setIsReady] = useState(false);
    const [stage, setStage] = useState<AppStage>('SCHEMA');
    const [schema, setSchema] = useState<ColumnSchema[]>([]);
    const [initialSchema, setInitialSchema] = useState<ColumnSchema[]>([]);
    const [rowCount, setRowCount] = useState(0);
    const [errors, setErrors] = useState<Map<number, Set<number>>>(new Map());
    const [pendingValidation, setPendingValidation] = useState<Set<number>>(new Set());
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const [dataVersion, setDataVersion] = useState(0);

    const workerRef = useRef<Worker | null>(null);
    const pendingRequests = useRef<Map<string, { resolve: (data: any) => void; reject: (err: any) => void }>>(new Map());
    const rowCache = useRef<Map<number, string[]>>(new Map());
    const inflightChunks = useRef<Set<number>>(new Set());
    const isBatchValidating = useRef(false);

    useEffect(() => {
        const worker = new DataWorker();
        workerRef.current = worker;

        worker.onmessage = (e: MessageEvent) => {
            const { type, id, payload } = e.data;

            if (type === 'INIT_COMPLETE') {
                setIsReady(true);
            } else if (
                type === 'GET_ROWS_COMPLETE' || 
                type === 'VALIDATE_COLUMN_COMPLETE' || 
                type === 'CORRECTION_COMPLETE' ||
                type === 'GET_SUGGESTIONS_COMPLETE' ||
                type === 'SUGGESTION_COMPLETE' ||
                type === 'UPDATE_CELL_COMPLETE'
            ) {
                const request = pendingRequests.current.get(id);
                if (request) {
                    request.resolve(payload);
                    pendingRequests.current.delete(id);
                }
            } else if (type === 'VALIDATION_UPDATE') {
                setErrors(prev => {
                    const next = new Map(prev);
                    if (payload instanceof Map) {
                        payload.forEach((indices, colIdx) => {
                            const set = next.get(colIdx) || new Set();
                            indices.forEach((idx: number) => set.add(idx));
                            next.set(colIdx, set);
                        });
                    } else {
                         // Fallback for object/array
                         // Assuming payload is { colIdx: [indices...] } or similar
                         // If it comes from wasm-bindgen, it might be a Map.
                         // But if it's an object:
                         try {
                             const entries = Object.entries(payload);
                             entries.forEach(([key, val]) => {
                                 const colIdx = Number(key);
                                 const set = next.get(colIdx) || new Set();
                                 if (Array.isArray(val) || val instanceof Uint32Array) {
                                     (val as any).forEach((i: number) => set.add(i));
                                 }
                                 next.set(colIdx, set);
                             });
                         } catch (e) { console.error("Error parsing validation update", e); }
                    }
                    return next;
                });
            } else if (type === 'VALIDATION_COMPLETE') {
                setStage('STUDIO');
            } else if (type === 'ERROR') {
                console.error("Worker Error:", payload);
                const errId = payload?.id;
                if (errId != null) {
                    const request = pendingRequests.current.get(errId);
                    if (request) {
                        request.reject(new Error(payload?.error ?? String(payload)));
                        pendingRequests.current.delete(errId);
                    }
                }
            }
        };

        worker.postMessage({ type: 'INIT' });
        return () => worker.terminate();
    }, []);

    const getRow = useCallback((index: number) => rowCache.current.get(index), []);

    const fetchRows = useCallback(async (start: number, limit: number): Promise<Record<number, string[]>> => {
        if (!workerRef.current || rowCount === 0) return {};

        const result: Record<number, string[]> = {};
        const missingRanges: { start: number; limit: number }[] = [];
        let currentMissingStart = -1;
        let currentMissingCount = 0;

        for (let i = start; i < start + limit; i++) {
            if (i >= rowCount) break;
            if (rowCache.current.has(i)) {
                result[i] = rowCache.current.get(i)!;
                if (currentMissingStart !== -1) {
                    missingRanges.push({ start: currentMissingStart, limit: currentMissingCount });
                    currentMissingStart = -1;
                    currentMissingCount = 0;
                }
            } else {
                if (currentMissingStart === -1) currentMissingStart = i;
                currentMissingCount++;
            }
        }
        if (currentMissingStart !== -1) missingRanges.push({ start: currentMissingStart, limit: currentMissingCount });

        for (const range of missingRanges) {
            if (inflightChunks.current.has(range.start)) {
                continue; // Already fetching this chunk
            }

            const requestId = `fetch_${range.start}_${range.limit}_${Date.now()}`;
            try {
                inflightChunks.current.add(range.start);
                const rows = await new Promise<any[]>((resolve, reject) => {
                    pendingRequests.current.set(requestId, { resolve, reject });
                    workerRef.current!.postMessage({ type: 'GET_ROWS', start: range.start, limit: range.limit, id: requestId });
                });
                rows.forEach((rowObj, idx) => {
                    const absoluteRowIndex = range.start + idx;
                    const rowArray = schema.map(col => {
                        const val = rowObj instanceof Map ? rowObj.get(col.name) : rowObj[col.name];
                        return val || "";
                    });
                    rowCache.current.set(absoluteRowIndex, rowArray);
                    result[absoluteRowIndex] = rowArray;
                });
            } catch (err) { 
                console.error(err); 
            } finally {
                inflightChunks.current.delete(range.start);
            }
        }
        return result;
    }, [rowCount, schema]);

    const loadFile = useCallback(async (file: File) => {
        if (!workerRef.current) return;
        setIsLoadingFile(true);
        setSchema([]);
        setRowCount(0);
        setErrors(new Map());
        rowCache.current.clear();
        setPendingValidation(new Set());

        try {
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            console.log(`Processing ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

            await new Promise<void>((resolve, reject) => {
                const worker = workerRef.current!;
                const handleLoad = (e: MessageEvent) => {
                    if (e.data.type === 'LOAD_COMPLETE') {
                        const summary = e.data.payload as DatasetSummary;
                        setSchema(summary.schema);
                        setRowCount(summary.row_count);
                        worker.removeEventListener('message', handleLoad);
                        resolve();
                    } else if (e.data.type === 'ERROR') {
                        worker.removeEventListener('message', handleLoad);
                        reject(e.data.payload);
                    }
                };
                worker.addEventListener('message', handleLoad);
                worker.postMessage({ type: 'LOAD_FILE', payload: bytes }, [bytes.buffer]);
            });

            // Stay in INGESTION; UI shows mapping when rowCount > 0
        } finally {
            setIsLoadingFile(false);
        }
    }, []);

    const goToIngestion = useCallback(() => {
        setStage('INGESTION');
    }, []);

    const updateColumnType = useCallback(async (colIdx: number, newType: ColumnType) => {
        if (!workerRef.current) return;
        
        setSchema(prev => {
            const next = [...prev];
            next[colIdx] = { ...next[colIdx], detected_type: newType };
            return next;
        });

        if (stage === 'STUDIO') {
             const initialType = initialSchema[colIdx]?.detected_type;
             const isChanged = initialType !== newType;

             setPendingValidation(prev => {
                 const next = new Set(prev);
                 if (isChanged) {
                     next.add(colIdx);
                 } else {
                     next.delete(colIdx);
                 }
                 return next;
             });
        }

        setErrors(prev => {
            const next = new Map(prev);
            next.delete(colIdx);
            return next;
        });
    }, [stage, initialSchema]);

    const validateColumnsSafe = useCallback(async (colIndices: number[]) => {
        if (!workerRef.current || isBatchValidating.current) return;

        isBatchValidating.current = true;
        try {
            console.time(`Validation Batch (${colIndices.length} cols)`); // LOG START
            const results = new Map<number, Set<number>>();
            
            for (const colIdx of colIndices) {
                const col = schema[colIdx];
                if (!col) continue;

                const requestId = `val_${colIdx}_${Date.now()}`;
                try {
                    const invalidRowIndices = await new Promise<Uint32Array>((resolve, reject) => {
                        pendingRequests.current.set(requestId, { resolve, reject });
                        workerRef.current!.postMessage({ type: 'VALIDATE_COLUMN', colIdx, newType: col.detected_type, id: requestId });
                    });
                    if (invalidRowIndices.length > 0) {
                        results.set(colIdx, new Set(invalidRowIndices));
                    }
                } catch (e) { console.error(e); }
            }

            setErrors(prev => {
                const next = new Map(prev);
                colIndices.forEach(idx => next.delete(idx));
                results.forEach((val, key) => next.set(key, val));
                return next;
            });
            console.timeEnd(`Validation Batch (${colIndices.length} cols)`); // LOG END
        } finally {
            isBatchValidating.current = false;
        }
    }, [schema]);

    const runBatchValidation = useCallback(async () => {
        if (!workerRef.current || pendingValidation.size === 0) return;
        console.log(`Running batch validation for ${pendingValidation.size} columns...`);
        await validateColumnsSafe(Array.from(pendingValidation));
        setPendingValidation(new Set());
    }, [pendingValidation, validateColumnsSafe]);

    const confirmSchema = useCallback(async () => {
        setStage('PROCESSING');
        setInitialSchema(JSON.parse(JSON.stringify(schema)));
        setErrors(new Map());
        
        if (workerRef.current) {
            workerRef.current.postMessage({ type: 'UPDATE_SCHEMA', payload: schema });
            workerRef.current.postMessage({ type: 'START_VALIDATION' });
        }
    }, [schema]);

    const applyCorrection = useCallback(async (colIdx: number, strategy: string) => {
         if (!workerRef.current) return;

         const requestId = `fix_${colIdx}_${Date.now()}`;
         try {
             await new Promise<number>((resolve, reject) => {
                 pendingRequests.current.set(requestId, { resolve, reject });
                 workerRef.current!.postMessage({ type: 'APPLY_CORRECTION', colIdx, strategy, id: requestId });
             });
             
             await validateColumnsSafe([colIdx]);
             
             // After applying a fix and re-validating, clear its pending status
             setPendingValidation(prev => {
                 const next = new Set(prev);
                 next.delete(colIdx);
                 return next;
             });

             rowCache.current.clear();
             setDataVersion(v => v + 1);
         } catch (e) { console.error("Fix failed", e); }
    }, [schema, validateColumnsSafe]);

    const getSuggestions = useCallback(async (colIdx: number): Promise<SuggestionReport[]> => {
        if (!workerRef.current) return [];

        const requestId = `getsuggest_${colIdx}_${Date.now()}`;
        console.log('[useDataStream] getSuggestions colIdx=', colIdx, 'requestId=', requestId);
        try {
            const suggestions = await new Promise<SuggestionReport[]>((resolve, reject) => {
                pendingRequests.current.set(requestId, { resolve, reject });
                workerRef.current!.postMessage({ type: 'GET_SUGGESTIONS', colIdx, id: requestId });
            });
            console.log('[useDataStream] getSuggestions resolved count=', Array.isArray(suggestions) ? suggestions.length : 'not-array', suggestions);
            return Array.isArray(suggestions) ? suggestions : [];
        } catch (e) {
            console.error("[useDataStream] getSuggestions failed", e);
            return [];
        }
    }, []);

    const applySuggestion = useCallback(async (colIdx: number, suggestion: Suggestion) => {
        if (!workerRef.current) return;

        const requestId = `applysuggest_${colIdx}_${Date.now()}`;
        try {
            await new Promise<number>((resolve, reject) => {
                pendingRequests.current.set(requestId, { resolve, reject });
                workerRef.current!.postMessage({ type: 'APPLY_SUGGESTION', colIdx, suggestion, id: requestId });
            });
            
            await validateColumnsSafe([colIdx]);
            
            setPendingValidation(prev => {
                const next = new Set(prev);
                next.delete(colIdx);
                return next;
            });

            rowCache.current.clear();
            setDataVersion(v => v + 1);
        } catch (e) {
            console.error("Apply suggestion failed", e);
        }
    }, [schema, validateColumnsSafe]);

    const updateCell = useCallback(async (rowIdx: number, colIdx: number, value: string) => {
        if (!workerRef.current) return;

        const requestId = `updatecell_${rowIdx}_${colIdx}_${Date.now()}`;
        try {
            await new Promise<void>((resolve, reject) => {
                pendingRequests.current.set(requestId, { resolve, reject });
                workerRef.current!.postMessage({ type: 'UPDATE_CELL', rowIdx, colIdx, value, id: requestId });
            });
            
            // Revalidate the column after cell update
            await validateColumnsSafe([colIdx]);
            
            // Clear cache for this row
            rowCache.current.delete(rowIdx);
            setDataVersion(v => v + 1);
        } catch (e) {
            console.error("Update cell failed", e);
            throw e;
        }
    }, [validateColumnsSafe]);

    return { 
        isReady, 
        stage, 
        schema, 
        initialSchema,
        rowCount, 
        errors, 
        pendingValidation, 
        isLoadingFile,
        dataVersion,
        goToIngestion,
        loadFile, 
        fetchRows, 
        updateColumnType, 
        getRow, 
        runBatchValidation, 
        applyCorrection,
        getSuggestions,
        applySuggestion,
        updateCell,
        confirmSchema 
    };
}
