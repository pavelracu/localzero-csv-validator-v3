import type { WorkspaceMeta, TriageLogEntry } from '../types';

/** Summary section of the audit report (workspace + file + rejection counts). */
export interface AuditSummary {
  workspaceId: string;
  fileName: string;
  fileSize: number;
  createdAt: number;
  updatedAt: number;
  rejectedRowCount: number;
}

/** Full audit report: summary + triage events (for export / compliance). */
export interface AuditReport {
  summary: AuditSummary;
  triageEvents: TriageLogEntry[];
}

/**
 * Builds the JSON structure for an audit report from workspace metadata.
 * Used for export and compliance (Summary + Triage Events).
 */
export function generateAuditSummary(workspace: WorkspaceMeta): AuditReport {
  const rejectedCount = workspace.rejectedRowIndices?.length ?? 0;
  const summary: AuditSummary = {
    workspaceId: workspace.id,
    fileName: workspace.fileMetadata.name,
    fileSize: workspace.fileMetadata.size,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    rejectedRowCount: rejectedCount,
  };
  return {
    summary,
    triageEvents: workspace.triageLog ?? [],
  };
}
