import { useState, useEffect } from 'react';
import { getWorkspace } from '../lib/workspaceDb';
import type { TriageLogEntry } from '../types';

/**
 * Fetches triage log from IndexedDB for the given workspace id.
 * Use this in Triage/Export views instead of storing triageLog in context,
 * so large logs (e.g. 10,000+ corrections) do not bloat React state.
 */
export function useTriageLog(workspaceId: string | null): TriageLogEntry[] {
  const [triageLog, setTriageLog] = useState<TriageLogEntry[]>([]);

  useEffect(() => {
    if (!workspaceId) {
      setTriageLog([]);
      return;
    }
    let cancelled = false;
    getWorkspace(workspaceId).then((ws) => {
      if (!cancelled && ws) {
        setTriageLog(ws.triageLog ?? []);
      } else if (!cancelled) {
        setTriageLog([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return triageLog;
}
