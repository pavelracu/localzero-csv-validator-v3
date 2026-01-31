import React, { useState, useCallback } from 'react';
import { FileUp } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface LoadProgress {
  bytesProcessed: number;
  totalBytes: number;
}

interface ImportProps {
  onFileSelect: (file: File) => Promise<void>;
  isReady: boolean;
  /** True while the file is being loaded and parsed locally (no upload). */
  isLoadingFile?: boolean;
  /** During load: bytes scanned by Rust parser; drives the progress bar. */
  loadProgress?: LoadProgress | null;
}

export const Import: React.FC<ImportProps> = ({ onFileSelect, isReady, isLoadingFile = false, loadProgress = null }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isLoadingFile) setIsDragging(true);
  }, [isLoadingFile]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) onFileSelect(files[0]);
  }, [onFileSelect]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  }, [onFileSelect]);

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-muted/10 p-6">
      <div className="w-full max-w-3xl space-y-8">
        
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Load CSV</h2>
          <p className="text-muted-foreground">Drag & drop or click to browse.</p>
        </div>

        <Card
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isLoadingFile && document.getElementById('file-upload')?.click()}
          className={`
            relative border-2 border-dashed
            transition-all duration-200 ease-in-out
            flex flex-col items-center justify-center min-h-[320px]
            ${isLoadingFile ? 'cursor-wait border-primary/50 bg-primary/5' : 'cursor-pointer'}
            ${isDragging && !isLoadingFile
               ? 'border-primary bg-primary/5 scale-[1.01]' 
               : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
            }
            ${!isReady ? 'opacity-60 pointer-events-none' : ''}
          `}
        >
           <div className="w-full max-w-sm mb-4 space-y-2">
              {isLoadingFile ? (
                <>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={loadProgress && loadProgress.totalBytes > 0 ? Math.round((loadProgress.bytesProcessed / loadProgress.totalBytes) * 100) : 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Loading file"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
                      style={{
                        width: loadProgress && loadProgress.totalBytes > 0
                          ? `${Math.min(100, (loadProgress.bytesProcessed / loadProgress.totalBytes) * 100)}%`
                          : '0%',
                      }}
                    />
                  </div>
                  {loadProgress && loadProgress.totalBytes > 0 && (
                    <p className="text-xs text-muted-foreground tabular-nums text-center">
                      {(loadProgress.bytesProcessed / 1024 / 1024).toFixed(1)} MB / {(loadProgress.totalBytes / 1024 / 1024).toFixed(1)} MB
                      {loadProgress.bytesProcessed > 0 && (
                        <span className="ml-2">
                          ({Math.round((loadProgress.bytesProcessed / loadProgress.totalBytes) * 100)}%)
                        </span>
                      )}
                    </p>
                  )}
                </>
              ) : (
                <div className="bg-background p-4 rounded-full shadow-sm ring-1 ring-border inline-flex">
                  <FileUp size={32} className="text-primary" />
                </div>
              )}
           </div>
           <h3 className="text-lg font-semibold text-foreground mb-1">
              {isLoadingFile ? 'Loading file…' : 'Load CSV'}
           </h3>
           <p className="text-sm text-muted-foreground mb-6">
              {isLoadingFile ? 'Parsing locally…' : 'Process up to 1GB. 100% in your browser.'}
           </p>
           
           <input 
             id="file-upload" 
             type="file" 
             accept=".csv"
             className="hidden"
             onChange={handleFileChange}
           />
           
           <Button disabled={isLoadingFile}>{isLoadingFile ? 'Loading…' : 'Browse Files'}</Button>
        </Card>
      </div>
    </div>
  );
};