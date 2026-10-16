import type { DatosProfesorEditables, NuevoProfesor, Profesor, SyncIntervalSeconds } from './ProfesoresContext';

type OutboxOperation = 'create' | 'update' | 'delete';

export interface PendingProfesorChange {
  localId: string;
  remoteId: string | null;
  operation: OutboxOperation;
  profesor: Profesor;
}

function sqliteUnavailable(): Error {
  return new Error('El almacenamiento local SQLite solo está disponible en Android e iOS.');
}

export function getProfesorIdentity(profesor: Profesor) {
  if (typeof profesor._id === 'string') return profesor._id;
  return profesor._id.$oid ?? '';
}

export async function getRemoteProfesorIdentity(_identity: string): Promise<string | null> {
  throw sqliteUnavailable();
}

export async function getCachedProfesores(_search = ''): Promise<Profesor[]> {
  throw sqliteUnavailable();
}

export async function getPendingProfesores(_search = ''): Promise<Profesor[]> {
  throw sqliteUnavailable();
}

export async function getPendingProfesorChanges(): Promise<PendingProfesorChange[]> {
  throw sqliteUnavailable();
}

export async function saveCloudProfesores(_profesores: Profesor[], _replaceSnapshot: boolean): Promise<void> {
  throw sqliteUnavailable();
}

export async function createLocalProfesor(
  _profesor: NuevoProfesor,
  _uuid?: string,
  _updatedAt?: string
): Promise<Profesor> {
  throw sqliteUnavailable();
}

export async function updateLocalProfesor(
  _identity: string,
  _datos: DatosProfesorEditables
): Promise<Profesor> {
  throw sqliteUnavailable();
}

export async function deleteLocalProfesor(_identity: string): Promise<void> {
  throw sqliteUnavailable();
}

export async function markProfesorCreated(_localId: string, _profesor: Profesor): Promise<void> {
  throw sqliteUnavailable();
}

export async function markProfesorUpdated(_localId: string, _profesor: Profesor): Promise<void> {
  throw sqliteUnavailable();
}

export async function markProfesorDeleted(_localId: string): Promise<void> {
  throw sqliteUnavailable();
}

export async function removeSyncedProfesor(_identity: string): Promise<void> {
  throw sqliteUnavailable();
}

export async function persistCloudProfesor(_profesor: Profesor): Promise<void> {
  throw sqliteUnavailable();
}

export async function getPendingSyncCount(): Promise<number> {
  throw sqliteUnavailable();
}

export async function getSyncIntervalSeconds(): Promise<SyncIntervalSeconds> {
  throw sqliteUnavailable();
}

export async function saveSyncIntervalSeconds(_interval: SyncIntervalSeconds): Promise<void> {
  throw sqliteUnavailable();
}

export async function getNewCloudProfesorIds(): Promise<string[]> {
  return [];
}

export async function markCloudProfesorAsViewed(_identity: string): Promise<void> {}
