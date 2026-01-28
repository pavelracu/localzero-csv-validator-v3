import { useState, useCallback } from 'react';
import { useDataStream } from './hooks/useDataStream';
import { VirtualizedTable } from './components/grid/VirtualizedTable';
import { Upload, FileType, CheckCircle, AlertTriangle } from 'lucide-react';

function App() {
  const { 
    isReady, 
    schema, 
    rowCount, 
    errors, 
    loadFile, 
    fetchRows, 
    updateColumnType,
    getRow
  } = useDataStream();

  const [isDragging, setIsDragging] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  }, [loadFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFile(e.target.files[0]);
    }
  }, [loadFile]);

  const processFile = async (file: File) => {
    setLoadingFile(true);
    try {
      console.log("Loading file:", file.name);
      await loadFile(file);
      console.log("File loaded successfully");
    } catch (err) {
      console.error("Error loading file:", err);
      alert("Failed to parse CSV file.");
    } finally {
      setLoadingFile(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-8 font-sans">
      <div className="w-full max-w-[1600px] space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">LocalZero Schema Engine</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide border ${
                isReady 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {isReady ? 'WASM READY' : 'INITIALIZING...'}
            </span>
          </div>
          
          {rowCount > 0 && (
             <div className="flex items-center gap-6 text-sm text-gray-600 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2">
                   <FileType size={16} />
                   <span>{rowCount.toLocaleString()} rows</span>
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
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
          )}
        </div>

        {/* Main Content */}
        <main className="w-full">
           {rowCount === 0 ? (
              // Empty State / Drop Zone
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ease-in-out
                  flex flex-col items-center justify-center min-h-[400px] cursor-pointer
                  ${isDragging 
                     ? 'border-blue-500 bg-blue-50 scale-[1.01] shadow-lg' 
                     : 'border-gray-300 hover:border-gray-400 bg-white'
                  }
                  ${!isReady ? 'opacity-50 pointer-events-none' : ''}
                `}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                 <div className="bg-gray-100 p-4 rounded-full mb-4">
                    <Upload size={32} className="text-gray-500" />
                 </div>
                 <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {loadingFile ? 'Processing CSV...' : 'Drop your dataset here'}
                 </h3>
                 <p className="text-gray-500 mb-6 max-w-sm">
                    Support for CSV files. Large datasets (&gt;100MB) are processed locally via Wasm.
                 </p>
                 <input 
                    id="file-upload" 
                    type="file" 
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileSelect}
                 />
                 <button 
                    disabled={!isReady || loadingFile}
                    className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                 >
                    Select File
                 </button>
              </div>
           ) : (
              // Data Grid
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                 <VirtualizedTable 
                    rowCount={rowCount}
                    schema={schema}
                    errors={errors}
                    fetchRows={fetchRows}
                    onTypeChange={updateColumnType}
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
