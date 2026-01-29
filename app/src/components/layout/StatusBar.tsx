import { FileType, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

interface StatusBarProps {
    rowCount: number;
    errorCount: number;
}

export const StatusBar = ({ rowCount, errorCount }: StatusBarProps) => {
    return (
        <footer className="flex items-center justify-between px-4 py-1 border-t border-border text-xs text-muted-foreground shrink-0">
            <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>Privacy: Local Processing</span>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <FileType size={14} />
                    <span>{rowCount.toLocaleString()} rows</span>
                </div>
                <div className="flex items-center gap-2">
                    {errorCount > 0 ? (
                        <>
                            <AlertTriangle size={14} className="text-amber-500" />
                            <span className="font-medium text-amber-700">{errorCount} columns with errors</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle size={14} className="text-emerald-500" />
                            <span className="font-medium text-emerald-700">All Valid</span>
                        </>
                    )}
                </div>
                {/* Memory usage placeholder */}
                <div className="flex items-center gap-2">
                    <span>Memory: N/A</span>
                </div>
            </div>
        </footer>
    );
};
