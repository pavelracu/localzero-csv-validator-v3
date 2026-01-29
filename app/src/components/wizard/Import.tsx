import React, { useState, useCallback } from 'react';
import { Upload, FileType, ArrowRight } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ImportProps {
  onFileSelect: (file: File) => void;
  onPresetSelect: (presetId: string) => void;
  isReady: boolean;
}

export const Import: React.FC<ImportProps> = ({ onFileSelect, onPresetSelect, isReady }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

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
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Import Data</h2>
          <p className="text-muted-foreground">Upload your raw CSV to begin the secure validation process.</p>
        </div>

        <Card
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-upload')?.click()}
          className={`
            relative cursor-pointer border-2 border-dashed
            transition-all duration-200 ease-in-out
            flex flex-col items-center justify-center min-h-[320px]
            ${isDragging 
               ? 'border-primary bg-primary/5 scale-[1.01]' 
               : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
            }
            ${!isReady ? 'opacity-60 pointer-events-none' : ''}
          `}
        >
           <div className="bg-background p-4 rounded-full shadow-sm mb-4 ring-1 ring-border">
              <Upload size={32} className="text-primary" />
           </div>
           <h3 className="text-lg font-semibold text-foreground mb-1">
              Upload CSV Data File
           </h3>
           <p className="text-sm text-muted-foreground mb-6">
              Drag & drop or click to browse (Max 1GB)
           </p>
           
           <input 
             id="file-upload" 
             type="file" 
             accept=".csv"
             className="hidden"
             onChange={handleFileChange}
           />
           
           <Button>Browse Files</Button>
        </Card>

        {/* Presets - Keeping it simple for now */}
        <div className="grid grid-cols-2 gap-4">
            {['Weekly Sales Report', 'Q3 Customer Data'].map((name, i) => (
                <Button key={i} variant="outline" className="justify-between h-auto py-4" onClick={() => onPresetSelect('demo')}>
                    <span className="flex items-center gap-2">
                        <FileType size={16} className="text-muted-foreground" />
                        {name}
                    </span>
                    <ArrowRight size={14} className="text-muted-foreground" />
                </Button>
            ))}
        </div>
      </div>
    </div>
  );
};