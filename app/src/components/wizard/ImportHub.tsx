import React, { useState, useCallback } from 'react';
import { Upload, FileType, ArrowRight } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ImportHubProps {
  onFileSelect: (file: File) => void;
  onPresetSelect: (presetId: string) => void;
  isReady: boolean;
}

export const ImportHub: React.FC<ImportHubProps> = ({ onFileSelect, onPresetSelect, isReady }) => {
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
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  }, [onFileSelect]);

  const presets = [
    { id: 'weekly-sales', name: 'Weekly Sales' },
    { id: 'customer-import-q3', name: 'Customer Import Q3' }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
       <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Import Hub</h2>
          <p className="text-muted-foreground">Upload your raw dataset to begin validation</p>
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
               ? 'border-primary bg-accent/50 scale-[1.01] shadow-xl' 
               : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-accent/50'
            }
            ${!isReady ? 'opacity-60 pointer-events-none' : ''}
          `}
       >
           <div className="bg-background p-5 rounded-full shadow-sm mb-6 group-hover:scale-110 transition-transform duration-200 ring-1 ring-border">
              <Upload size={40} className="text-primary" />
           </div>
           <h3 className="text-xl font-semibold text-foreground mb-2">
              Upload CSV Data File
           </h3>
           <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-center">
              Drag & drop your raw dataset here (max 1GB)
           </p>
           
           <input 
              id="file-upload" 
              type="file" 
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
           />
           
           <Button size="lg" className="font-semibold">
              Browse Files
           </Button>
       </Card>

       <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Quick Start with Saved Schema
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {presets.map(preset => (
              <Button
                key={preset.id}
                variant="outline"
                className="h-auto p-4 justify-between group hover:border-primary hover:ring-1 hover:ring-primary"
                onClick={() => onPresetSelect(preset.id)}
              >
                <div className="flex items-center gap-3">
                   <div className="bg-primary/10 p-2 rounded-lg text-primary">
                      <FileType size={20} />
                   </div>
                   <span className="font-medium text-foreground">
                      {preset.name}
                   </span>
                </div>
                <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary transform group-hover:translate-x-1 transition-all" />
              </Button>
            ))}
          </div>
       </div>
    </div>
  );
};
