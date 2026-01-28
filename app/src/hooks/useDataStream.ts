import { useState, useEffect, useCallback, useRef } from 'react';
import { ColumnSchema, ColumnType, DatasetSummary } from '../types';
import DataWorker from '../workers/data.worker?worker';

export type AppStage = 'IMPORT' | 'ARCHITECT' | 'PROCESSING' | 'STUDIO';

export interface UseDataStreamReturn {
    isReady: boolean;
    stage: AppStage;
    schema: ColumnSchema[];
    initialSchema: ColumnSchema[];
    rowCount: number;
    errors: Map<number, Set<number>>;
    pendingValidation: Set<number>;
    loadFile: (file: File) => Promise<void>;
    fetchRows: (start: number, limit: number) => Promise<Record<number, string[]>>;
    updateColumnType: (colIdx: number, newType: ColumnType) => Promise<void>;
    getRow: (index: number) => string[] | undefined;
    runBatchValidation: () => Promise<void>;
    applyFix: (colIdx: number, strategy: string) => Promise<void>;
    confirmSchema: () => Promise<void>;
}

export function useDataStream(): UseDataStreamReturn {
    const [isReady, setIsReady] = useState(false);
    const [stage, setStage] = useState<AppStage>('IMPORT');
    const [schema, setSchema] = useState<ColumnSchema[]>([]);
    const [initialSchema, setInitialSchema] = useState<ColumnSchema[]>([]);
    const [rowCount, setRowCount] = useState(0);
    const [errors, setErrors] = useState<Map<number, Set<number>>>(new Map());
    const [pendingValidation, setPendingValidation] = useState<Set<number>>(new Set());
    
    const workerRef = useRef<Worker | null>(null);
    const pendingRequests = useRef<Map<string, { resolve: (data: any) => void; reject: (err: any) => void }>>(new Map());
    const rowCache = useRef<Map<number, string[]>>(new Map());

    useEffect(() => {
        const worker = new DataWorker();
        workerRef.current = worker;

        worker.onmessage = (e: MessageEvent) => {
            const { type, id, payload } = e.data;

            if (type === 'INIT_COMPLETE') {
                setIsReady(true);
            } else if (type === 'GET_ROWS_COMPLETE' || type === 'VALIDATE_COLUMN_COMPLETE' || type === 'CORRECTION_COMPLETE') {
                const request = pendingRequests.current.get(id);
                if (request) {
                    request.resolve(payload);
                    pendingRequests.current.delete(id);
                }
            } else if (type === 'ERROR') {
                console.error("Worker Error:", payload);
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
            const requestId = `fetch_${range.start}_${range.limit}_${Date.now()}`;
            try {
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
            } catch (err) { console.error(err); }
        }
        return result;
    }, [rowCount, schema]);

    const loadFile = useCallback(async (file: File) => {
        if (!workerRef.current) return;
        setSchema([]);
        setRowCount(0);
        setErrors(new Map());
        rowCache.current.clear();
        setPendingValidation(new Set());

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
        
        setStage('ARCHITECT');
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
        if (!workerRef.current) return;

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
        
        const allIndices = schema.map((_, i) => i);
        await validateColumnsSafe(allIndices);
        
        setStage('STUDIO');
    }, [schema, validateColumnsSafe]);

    const applyFix = useCallback(async (colIdx: number, strategy: string) => {
         if (!workerRef.current) return;

         const requestId = `fix_${colIdx}_${Date.now()}`;
         try {
             await new Promise<number>((resolve, reject) => {
                 pendingRequests.current.set(requestId, { resolve, reject });
                 workerRef.current!.postMessage({ type: 'APPLY_CORRECTION', colIdx, strategy, id: requestId });
             });
             
             await validateColumnsSafe([colIdx]);
             rowCache.current.clear();
             
         } catch (e) { console.error("Fix failed", e); }
    }, [schema, validateColumnsSafe]);

    return { 
        isReady, 
        stage, 
        schema, 
        initialSchema,
        rowCount, 
        errors, 
        pendingValidation, 
        loadFile, 
        fetchRows, 
        updateColumnType, 
        getRow, 
        runBatchValidation, 
        applyFix, 
        confirmSchema 
    };
}
