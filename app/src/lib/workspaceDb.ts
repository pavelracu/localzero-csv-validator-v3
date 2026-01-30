import type { WorkspaceMeta, FileMetadata, TriageLogEntry, ColumnType } from '../types';

const DB_NAME = 'localzero-workspaces-v1';
const STORE_NAME = 'workspaces';
const LIST_LIMIT = 20;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

export async function listWorkspaces(limit: number = LIST_LIMIT): Promise<WorkspaceMeta[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('updatedAt');
    const req = index.openCursor(null, 'prev');
    const results: WorkspaceMeta[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value as WorkspaceMeta);
        cursor.continue();
      } else {
        db.close();
        resolve(results);
      }
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function getWorkspace(id: string): Promise<WorkspaceMeta | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => {
      db.close();
      resolve(req.result as WorkspaceMeta | undefined);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function putWorkspace(workspace: WorkspaceMeta): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(workspace);
    req.onsuccess = () => {
      db.close();
      resolve();
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function addTriageLogEntry(
  workspaceId: string,
  entry: TriageLogEntry
): Promise<void> {
  const ws = await getWorkspace(workspaceId);
  if (!ws) return;
  const updated: WorkspaceMeta = {
    ...ws,
    triageLog: [...ws.triageLog, entry],
    updatedAt: Date.now(),
  };
  await putWorkspace(updated);
}

export async function updateFileMetadata(
  workspaceId: string,
  fileMetadata: Partial<FileMetadata>
): Promise<void> {
  const ws = await getWorkspace(workspaceId);
  if (!ws) return;
  const updated: WorkspaceMeta = {
    ...ws,
    fileMetadata: { ...ws.fileMetadata, ...fileMetadata },
    updatedAt: Date.now(),
  };
  await putWorkspace(updated);
}

export async function updateSchemaSnapshot(
  workspaceId: string,
  schemaSnapshot: Record<string, ColumnType>
): Promise<void> {
  const ws = await getWorkspace(workspaceId);
  if (!ws) return;
  const updated: WorkspaceMeta = {
    ...ws,
    schemaSnapshot,
    updatedAt: Date.now(),
  };
  await putWorkspace(updated);
}

export async function setRejectedRows(
  workspaceId: string,
  indices: number[]
): Promise<void> {
  const ws = await getWorkspace(workspaceId);
  if (!ws) return;
  const updated: WorkspaceMeta = {
    ...ws,
    rejectedRowIndices: indices,
    updatedAt: Date.now(),
  };
  await putWorkspace(updated);
}
