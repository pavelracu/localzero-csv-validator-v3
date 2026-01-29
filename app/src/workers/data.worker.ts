import init, { load_dataset, get_rows, validate_column, validate_chunk, apply_correction, get_suggestions, apply_suggestion, update_schema } from '../wasm/localzero_core';

type WorkerMessage = 
  | { type: 'INIT' }
  | { type: 'LOAD_FILE'; payload: Uint8Array }
  | { type: 'UPDATE_SCHEMA'; payload: any }
  | { type: 'GET_ROWS'; start: number; limit: number; id: string }
  | { type: 'VALIDATE_COLUMN'; colIdx: number; newType: string; id: string }
  | { type: 'VALIDATE_CHUNK'; start: number; limit: number; id: string }
  | { type: 'START_VALIDATION' }
  | { type: 'APPLY_CORRECTION'; colIdx: number; strategy: string; id: string }
  | { type: 'GET_SUGGESTIONS'; colIdx: number; id: string }
  | { type: 'APPLY_SUGGESTION'; colIdx: number; suggestion: any; id: string };

let isWasmReady = false;
let totalRows = 0;

let validationJob: { 
  active: boolean; 
  currentStart: number; 
  chunkSize: number; 
  startTime: number; 
} | null = null;

function processValidationChunk() {
  if (!validationJob || !validationJob.active) return;

  const start = performance.now();
  const { currentStart, chunkSize } = validationJob;
  
  // 1. Run Wasm validation (The work)
  const errorFlatList = validate_chunk(currentStart, chunkSize);
  
  // Reconstruct Map for the UI
  const errors = new Map();
  for (let i = 0; i < errorFlatList.length; i += 2) {
      const row = errorFlatList[i];
      const col = errorFlatList[i+1];
      
      if (!errors.has(col)) errors.set(col, new Set());
      errors.get(col).add(row);
  }
  
  // 2. Measure & Log Chunk
  const duration = performance.now() - start;
  if (duration > 10) { // Only log slow chunks to avoid spam
     console.log(`[Worker] Chunk ${currentStart}-${currentStart+chunkSize}: ${duration.toFixed(2)}ms`);
  }

  // 3. Report progress
  if (errors.size > 0) {
     self.postMessage({ type: 'VALIDATION_UPDATE', payload: errors });
  }

  // 4. Schedule next
  validationJob.currentStart += chunkSize;
  
  if (validationJob.currentStart < totalRows) {
    // CRITICAL: setTimeout(..., 0) releases the thread!
    setTimeout(processValidationChunk, 0); 
  } else {
    const totalTime = performance.now() - validationJob.startTime;
    console.log(`[Worker] ✅ Validation Complete. Total: ${(totalTime/1000).toFixed(2)}s`);
    self.postMessage({ type: 'VALIDATION_COMPLETE' });
    validationJob = null;
  }
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type } = e.data;

  try {
    if (!isWasmReady && type !== 'INIT') {
      await init();
      isWasmReady = true;
    }

    switch (type) {
      case 'INIT': {
        await init();
        isWasmReady = true;
        self.postMessage({ type: 'INIT_COMPLETE' });
        break;
      }
      case 'LOAD_FILE': {
        const bytes = (e.data as any).payload;
        const summary = load_dataset(bytes); 
        totalRows = summary.row_count;
        self.postMessage({ type: 'LOAD_COMPLETE', payload: summary });
        break;
      }
      case 'UPDATE_SCHEMA': {
        update_schema(e.data.payload);
        break;
      }
      case 'START_VALIDATION': {
        validationJob = {
            active: true,
            currentStart: 0,
            chunkSize: 50000,
            startTime: performance.now()
        };
        processValidationChunk();
        break;
      }
      case 'GET_ROWS': {
        const startTs = performance.now();
        const { start, limit, id } = e.data as any;
        const rows = get_rows(start, limit);
        const dur = performance.now() - startTs;
        console.log(`[Worker] Fetch Rows: ${dur.toFixed(2)}ms`);
        self.postMessage({ type: 'GET_ROWS_COMPLETE', id, payload: rows });
        break;
      }
      case 'VALIDATE_COLUMN': {
        const { colIdx, newType, id } = e.data as any;
        const invalidIndices = validate_column(colIdx, newType);
        self.postMessage({ type: 'VALIDATE_COLUMN_COMPLETE', id, payload: invalidIndices });
        break;
      }
      case 'VALIDATE_CHUNK': {
        const { start, limit, id } = e.data as any;
        const errorFlatList = validate_chunk(start, limit);
        
        // Reconstruct Map for the UI
        const errors = new Map();
        for (let i = 0; i < errorFlatList.length; i += 2) {
            const row = errorFlatList[i];
            const col = errorFlatList[i+1];
            
            if (!errors.has(col)) errors.set(col, new Set());
            errors.get(col).add(row);
        }

        self.postMessage({ type: 'VALIDATE_CHUNK_COMPLETE', id, payload: errors });
        break;
      }
      case 'APPLY_CORRECTION': {
        const { colIdx, strategy, id } = e.data as any;
        const count = apply_correction(colIdx, strategy);
        self.postMessage({ type: 'CORRECTION_COMPLETE', id, payload: count });
        break;
      }
      case 'GET_SUGGESTIONS': {
        const { colIdx, id } = e.data as any;
        const suggestions = get_suggestions(colIdx);
        self.postMessage({ type: 'GET_SUGGESTIONS_COMPLETE', id, payload: suggestions });
        break;
      }
      case 'APPLY_SUGGESTION': {
        const { colIdx, suggestion, id } = e.data as any;
        const count = apply_suggestion(colIdx, suggestion);
        self.postMessage({ type: 'SUGGESTION_COMPLETE', id, payload: count });
        break;
      }
    }
  } catch (err) {
    console.error("Worker Error:", err);
    self.postMessage({ type: 'ERROR', payload: String(err) });
  }
};
