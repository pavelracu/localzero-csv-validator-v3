import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { FileMetadata } from '../types';

export type PrivacyShieldStatus = 'inactive' | 'local-only';

/**
 * Workspace context holds only active workspace id and metadata.
 * triageLog is NOT stored here — it lives in IndexedDB only. Query it via
 * getWorkspace(activeWorkspaceId) or useTriageLog(activeWorkspaceId) when
 * the Triage/Export view needs it, to avoid React state bloat from large logs.
 */
interface WorkspaceContextValue {
  activeWorkspaceId: string | null;
  fileMetadata: FileMetadata | null;
  privacyShieldStatus: PrivacyShieldStatus;
  setActiveWorkspace: (id: string | null) => void;
  setFileMetadata: (meta: FileMetadata | null) => void;
  setPrivacyShieldStatus: (status: PrivacyShieldStatus) => void;
  clearWorkspace: () => void;
  hasActiveFile: boolean;
  /** Bump to trigger Sidebar refetch of workspace list (e.g. after creating a workspace). */
  workspaceListVersion: number;
  bumpWorkspaceListVersion: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [fileMetadata, setFileMetadataState] = useState<FileMetadata | null>(null);
  const [privacyShieldStatus, setPrivacyShieldStatusState] =
    useState<PrivacyShieldStatus>('inactive');
  const [workspaceListVersion, setWorkspaceListVersion] = useState(0);

  const bumpWorkspaceListVersion = useCallback(() => {
    setWorkspaceListVersion((v) => v + 1);
  }, []);

  const setActiveWorkspace = useCallback((id: string | null) => {
    setActiveWorkspaceId(id);
  }, []);

  const setFileMetadata = useCallback((meta: FileMetadata | null) => {
    setFileMetadataState(meta);
  }, []);

  const setPrivacyShieldStatus = useCallback((status: PrivacyShieldStatus) => {
    setPrivacyShieldStatusState(status);
  }, []);

  const clearWorkspace = useCallback(() => {
    setActiveWorkspaceId(null);
    setFileMetadataState(null);
    setPrivacyShieldStatusState('inactive');
  }, []);

  const hasActiveFile = activeWorkspaceId != null || privacyShieldStatus === 'local-only';

  const value: WorkspaceContextValue = {
    activeWorkspaceId,
    fileMetadata,
    privacyShieldStatus,
    setActiveWorkspace,
    setFileMetadata,
    setPrivacyShieldStatus,
    clearWorkspace,
    hasActiveFile,
    workspaceListVersion,
    bumpWorkspaceListVersion,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return ctx;
}
