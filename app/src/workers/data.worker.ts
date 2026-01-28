import init, { load_dataset, get_rows, validate_column, validate_chunk } from '../wasm/localzero_core';

type WorkerMessage = 
  | { type: 'INIT' }
  | { type: 'LOAD_FILE'; payload: Uint8Array }
  | { type: 'GET_ROWS'; start: number; limit: number; id: string }
  | { type: 'VALIDATE_COLUMN'; colIdx: number; newType: string; id: string }
  | { type: 'VALIDATE_CHUNK'; start: number; limit: number; id: string };

let isWasmReady = false;

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
        self.postMessage({ type: 'LOAD_COMPLETE', payload: summary });
        break;
      }
      case 'GET_ROWS': {
        const { start, limit, id } = e.data as any;
        const rows = get_rows(start, limit);
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
        const errors = validate_chunk(start, limit);
        self.postMessage({ type: 'VALIDATE_CHUNK_COMPLETE', id, payload: errors });
        break;
      }
    }
  } catch (err) {
    console.error("Worker Error:", err);
    self.postMessage({ type: 'ERROR', payload: String(err) });
  }
};
