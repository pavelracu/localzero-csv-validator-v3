import { useEffect, useState, useCallback } from 'react';
import init, { load_dataset, get_rows, validate_column } from './wasm/localzero_core';
import { VirtualizedTable } from './components/grid/VirtualizedTable';
import { ColumnSchema, ColumnType } from './types';

function App() {
  const [isReady, setIsReady] = useState(false);
  const [schema, setSchema] = useState<ColumnSchema[]>([]);
  const [data, setData] = useState<string[][]>([]);
  const [errors, setErrors] = useState<Map<number, Set<number>>>(new Map());
  const [summary, setSummary] = useState<{ row_count: number; file_size_mb: number } | null>(null);

  useEffect(() => {
    const bootWasm = async () => {
      try {
        await init();
        setIsReady(true);
        console.log("✅ Wasm Initialized");
      } catch (err) {
        console.error("Failed to load Wasm:", err);
      }
    };
    bootWasm();
  }, []);

  const handleTestClick = async () => {
    if (!isReady) return;

    // Create a dummy CSV with mixed types
    const csvContent = 
`id,name,email,score,active,joined,phone
1,Alice,alice@example.com,95.5,true,2023-01-01,1234567890
2,Bob,bob@invalid,80.0,false,2023-05-12,987-654-3210
3,Charlie,charlie@example.com,invalid_score,yes,2023-13-01,5551234567
4,Dave,dave@example.com,100,1,2023-06-20,1234567890
5,Eve,eve@example.com,45.2,0,not-a-date,1112223333`;

    const encoded = new TextEncoder().encode(csvContent);

    try {
      // 1. Load Dataset
      const result = load_dataset(encoded);
      const schemaFromWasm = result.schema as ColumnSchema[];
      
      setSummary({
        row_count: result.row_count,
        file_size_mb: result.file_size_mb
      });
      setSchema(schemaFromWasm);
      
      // 2. Fetch Data (all of it for now)
      const rows = get_rows(0, 100) as string[][];
      setData(rows);
      
      // Reset errors
      setErrors(new Map());

      console.log("Loaded schema:", schemaFromWasm);
    } catch (e) {
      console.error("Rust Error:", e);
    }
  };

  const handleTypeChange = useCallback(async (colIndex: number, newType: ColumnType) => {
    if (!isReady) return;

    console.log(`Changing column ${colIndex} to ${newType}`);

    try {
      // 1. Update Schema locally to reflect change immediately in UI
      setSchema(prev => {
        const next = [...prev];
        next[colIndex] = { ...next[colIndex], detected_type: newType };
        return next;
      });

      // 2. Call Rust to validate
      const invalidRows = validate_column(colIndex, newType) as Uint32Array | number[]; // Vec<usize> comes as array
      
      // 3. Update Errors Map
      setErrors(prev => {
        const next = new Map(prev);
        const errorSet = new Set(invalidRows);
        
        if (errorSet.size > 0) {
            next.set(colIndex, errorSet);
        } else {
            next.delete(colIndex);
        }
        return next;
      });
      
    } catch (e) {
      console.error("Validation Error:", e);
    }
  }, [isReady]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-8 font-sans">
      <div className="w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">LocalZero Schema Engine</h1>
          <div className="flex items-center gap-4">
             <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                isReady ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {isReady ? 'WASM READY' : 'LOADING...'}
              </span>
              <button
                onClick={handleTestClick}
                disabled={!isReady}
                className="bg-black text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-all"
              >
                Load Test Data
              </button>
          </div>
        </div>

        {summary && (
           <div className="bg-white p-4 rounded-lg border border-gray-200 flex gap-6 text-sm">
              <div>Row Count: <span className="font-bold">{summary.row_count}</span></div>
              <div>Size: <span className="font-bold">{summary.file_size_mb.toFixed(4)} MB</span></div>
           </div>
        )}

        {schema.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <VirtualizedTable 
                data={data}
                schema={schema}
                errors={errors}
                onTypeChange={handleTypeChange}
             />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
