import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import type {
  DatosProfesorEditables,
  NuevoProfesor,
  Profesor,
  SyncIntervalSeconds,
} from './ProfesoresContext';

const PROFESORES_DATABASE_NAME = 'profesores.db';

type OutboxOperation = 'create' | 'update' | 'delete';

interface ProfesorRow {
  uuid: string;
  remote_id: string | null;
  data_json: string;
  is_deleted: number;
  updated_at: string;
}

interface PendingProfesorRow extends ProfesorRow {
  operation: OutboxOperation;
}

export interface PendingProfesorChange {
  localId: string;
  remoteId: string | null;
  operation: OutboxOperation;
  profesor: Profesor;
}

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(PROFESORES_DATABASE_NAME)
      .then(async (database) => {
        await database.execAsync(`
          PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS new_cloud_profesores (
            remote_id TEXT PRIMARY KEY NOT NULL
          );
        `);
        await migrateProfesorTables(database);
        await database.execAsync('PRAGMA foreign_keys = ON;');
        return database;
      })
      .catch((error: unknown) => {
        databasePromise = undefined;
        throw error;
      });
  }

  return databasePromise;
}

async function migrateProfesorTables(database: SQLite.SQLiteDatabase) {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(profesores)');
  const hasUuidPrimaryKey = columns.some((column) => column.name === 'uuid');
  if (hasUuidPrimaryKey) {
    await createProfesorTables(database);
    return;
  }

  const legacyRows = columns.length > 0
    ? await database.getAllAsync<{
        id: number;
        remote_id: string | null;
        data_json: string;
        is_deleted: number;
      }>('SELECT id, remote_id, data_json, is_deleted FROM profesores')
    : [];
  const outboxColumns = await database.getAllAsync<{ name: string }>(
    'PRAGMA table_info(profesores_outbox)'
  );
  const legacyChanges = outboxColumns.length > 0
    ? await database.getAllAsync<{
        local_id: number;
        operation: OutboxOperation;
        queued_at: number;
      }>('SELECT local_id, operation, queued_at FROM profesores_outbox')
    : [];
  const uuidByLegacyId = new Map<number, string>();
  const pendingIds = new Set(legacyChanges.map((change) => change.local_id));

  await database.execAsync('PRAGMA foreign_keys = OFF;');
  await database.withTransactionAsync(async () => {
    await database.execAsync('DROP TABLE IF EXISTS profesores_outbox; DROP TABLE IF EXISTS profesores;');
    await createProfesorTables(database);

    for (const row of legacyRows) {
      const data = JSON.parse(row.data_json) as Partial<Profesor> & { updated_at?: string };
      const uuid = data.uuid || Crypto.randomUUID();
      const updatedAt = data.updated_at ?? new Date(pendingIds.has(row.id) ? Date.now() : 0).toISOString();
      const localProfesor = { ...data, uuid, updated_at: updatedAt };
      uuidByLegacyId.set(row.id, uuid);
      await database.runAsync(
        'INSERT INTO profesores (uuid, remote_id, data_json, is_deleted, updated_at) VALUES (?, ?, ?, ?, ?)',
        uuid,
        row.remote_id,
        JSON.stringify(localProfesor),
        row.is_deleted,
        updatedAt
      );
    }

    for (const change of legacyChanges) {
      const uuid = uuidByLegacyId.get(change.local_id);
      if (!uuid) continue;
      await database.runAsync(
        'INSERT INTO profesores_outbox (local_uuid, operation, queued_at) VALUES (?, ?, ?)',
        uuid,
        change.operation,
        change.queued_at
      );
    }
  });
}

async function createProfesorTables(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS profesores (
      uuid TEXT PRIMARY KEY NOT NULL,
      remote_id TEXT UNIQUE,
      data_json TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profesores_outbox (
      local_uuid TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
      queued_at INTEGER NOT NULL,
      FOREIGN KEY (local_uuid) REFERENCES profesores(uuid) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
}

export function getProfesorIdentity(profesor: Profesor) {
  if (typeof profesor._id === 'string') return profesor._id;
  return profesor._id.$oid ?? '';
}

function mapProfesorRow(row: ProfesorRow): Profesor {
  return {
    ...JSON.parse(row.data_json) as Profesor,
    uuid: row.uuid,
    updated_at: row.updated_at,
    _id: row.remote_id ?? `local:${row.uuid}`,
  };
}

function matchesSearch(profesor: Profesor, search: string) {
  if (!search) return true;
  const normalizedSearch = search.toLocaleLowerCase();
  return [profesor.name, profesor.apellido, profesor.Profesion, profesor.headline]
    .some((value) => value?.toLocaleLowerCase().includes(normalizedSearch));
}

async function findProfesorRow(identity: string) {
  const database = await getDatabase();
  const localUuidMatch = /^local:(.+)$/.exec(identity);
  if (localUuidMatch) {
    return database.getFirstAsync<ProfesorRow>(
      'SELECT uuid, remote_id, data_json, is_deleted, updated_at FROM profesores WHERE uuid = ?',
      localUuidMatch[1]
    );
  }

  return database.getFirstAsync<ProfesorRow>(
    'SELECT uuid, remote_id, data_json, is_deleted, updated_at FROM profesores WHERE remote_id = ?',
    identity
  );
}

export async function getRemoteProfesorIdentity(identity: string) {
  if (!identity.startsWith('local:')) return identity;
  const row = await findProfesorRow(identity);
  return row?.remote_id ?? null;
}

export async function getCachedProfesores(search = '') {
  const database = await getDatabase();
  const rows = await database.getAllAsync<ProfesorRow>(
    'SELECT uuid, remote_id, data_json, is_deleted, updated_at FROM profesores WHERE is_deleted = 0 ORDER BY updated_at DESC'
  );
  return rows.map(mapProfesorRow).filter((profesor) => matchesSearch(profesor, search));
}

export async function getPendingProfesores(search = '') {
  const database = await getDatabase();
  const rows = await database.getAllAsync<PendingProfesorRow>(`
    SELECT p.uuid, p.remote_id, p.data_json, p.is_deleted, p.updated_at, o.operation
    FROM profesores p
    JOIN profesores_outbox o ON o.local_uuid = p.uuid
    WHERE p.is_deleted = 0
    ORDER BY o.queued_at ASC
  `);
  return rows.map(mapProfesorRow).filter((profesor) => matchesSearch(profesor, search));
}

export async function getPendingProfesorChanges() {
  const database = await getDatabase();
  const rows = await database.getAllAsync<PendingProfesorRow>(`
    SELECT p.uuid, p.remote_id, p.data_json, p.is_deleted, p.updated_at, o.operation
    FROM profesores p
    JOIN profesores_outbox o ON o.local_uuid = p.uuid
    ORDER BY o.queued_at ASC, p.uuid ASC
  `);
  return rows.map((row): PendingProfesorChange => ({
    localId: row.uuid,
    remoteId: row.remote_id,
    operation: row.operation,
    profesor: mapProfesorRow(row),
  }));
}

export async function saveCloudProfesores(profesores: Profesor[], replaceSnapshot: boolean) {
  const database = await getDatabase();
  const remoteIds = profesores.map(getProfesorIdentity);

  await database.withTransactionAsync(async () => {
    if (replaceSnapshot) {
      const snapshotSetting = await database.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = ?',
        'cloud_snapshot_initialized'
      );
      const cachedRows = await database.getAllAsync<{ remote_id: string }>(
        'SELECT remote_id FROM profesores WHERE remote_id IS NOT NULL'
      );
      if (snapshotSetting?.value === 'true' || cachedRows.length > 0) {
        const cachedIds = new Set(cachedRows.map((row) => row.remote_id));
        for (const remoteId of remoteIds) {
          if (!cachedIds.has(remoteId)) {
            await database.runAsync(
              'INSERT OR IGNORE INTO new_cloud_profesores (remote_id) VALUES (?)',
              remoteId
            );
          }
        }
      }

      await database.runAsync(
        `INSERT INTO app_settings (key, value) VALUES (?, 'true')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        'cloud_snapshot_initialized'
      );
    }

    for (const profesor of profesores) {
      const remoteId = getProfesorIdentity(profesor);
      const updatedAt = new Date(profesor.updated_at).toISOString();
      const existing = await database.getFirstAsync<ProfesorRow>(
        `SELECT uuid, remote_id, data_json, is_deleted, updated_at
         FROM profesores WHERE uuid = ? OR remote_id = ? LIMIT 1`,
        profesor.uuid,
        remoteId
      );
      if (existing?.remote_id && existing.remote_id !== remoteId) {
        throw new Error(`El UUID ${profesor.uuid} ya está asociado a otro profesor en la caché.`);
      }

      if (existing && existing.uuid !== profesor.uuid) {
        const localProfesor = { ...JSON.parse(existing.data_json) as Profesor, uuid: profesor.uuid };
        await database.runAsync('UPDATE profesores SET uuid = ?, data_json = ? WHERE uuid = ?',
          profesor.uuid,
          JSON.stringify(localProfesor),
          existing.uuid
        );
      }
      await database.runAsync(
        `INSERT INTO profesores (uuid, remote_id, data_json, is_deleted, updated_at)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(uuid) DO UPDATE SET
           remote_id = excluded.remote_id,
           data_json = excluded.data_json,
           is_deleted = 0,
           updated_at = excluded.updated_at
         WHERE excluded.updated_at > profesores.updated_at
           AND NOT EXISTS (
             SELECT 1 FROM profesores_outbox WHERE local_uuid = profesores.uuid
           )`,
        profesor.uuid,
        remoteId,
        JSON.stringify({ ...profesor, updated_at: updatedAt }),
        updatedAt
      );
    }

    if (replaceSnapshot) {
      const cachedRows = await database.getAllAsync<ProfesorRow>(
        `SELECT uuid, remote_id, data_json, is_deleted, updated_at FROM profesores
         WHERE remote_id IS NOT NULL
           AND uuid NOT IN (SELECT local_uuid FROM profesores_outbox)`
      );
      const remoteIdSet = new Set(remoteIds);
      for (const row of cachedRows) {
        if (row.remote_id && !remoteIdSet.has(row.remote_id)) {
          await database.runAsync('DELETE FROM profesores WHERE uuid = ?', row.uuid);
        }
      }
      await database.runAsync(
        `DELETE FROM new_cloud_profesores
         WHERE remote_id NOT IN (
           SELECT remote_id FROM profesores
           WHERE remote_id IS NOT NULL AND is_deleted = 0
         )`
      );
    }
  });
}

export async function createLocalProfesor(
  profesor: NuevoProfesor,
  uuid = Crypto.randomUUID(),
  updatedAt = new Date().toISOString()
) {
  const database = await getDatabase();
  const localProfesor: Profesor = { ...profesor, uuid, updated_at: updatedAt, _id: `local:${uuid}` };

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      'INSERT INTO profesores (uuid, remote_id, data_json, is_deleted, updated_at) VALUES (?, NULL, ?, 0, ?)',
      uuid,
      JSON.stringify(localProfesor),
      updatedAt
    );
    await database.runAsync(
      'INSERT INTO profesores_outbox (local_uuid, operation, queued_at) VALUES (?, ?, ?)',
      uuid,
      'create',
      Date.now()
    );
  });

  return localProfesor;
}

export async function updateLocalProfesor(identity: string, datos: DatosProfesorEditables) {
  const database = await getDatabase();
  const row = await findProfesorRow(identity);
  if (!row) throw new Error('No se encontró el profesor en la base de datos local.');

  const updatedProfesor: Profesor = {
    ...mapProfesorRow(row),
    ...datos,
    updated_at: new Date(Math.max(Date.now(), Date.parse(row.updated_at) + 1)).toISOString(),
    _id: row.remote_id ?? `local:${row.uuid}`,
  };

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      'UPDATE profesores SET data_json = ?, updated_at = ? WHERE uuid = ?',
      JSON.stringify(updatedProfesor),
      updatedProfesor.updated_at,
      row.uuid
    );
    await database.runAsync(
      `INSERT INTO profesores_outbox (local_uuid, operation, queued_at) VALUES (?, 'update', ?)
       ON CONFLICT(local_uuid) DO UPDATE SET
         operation = CASE WHEN profesores_outbox.operation = 'create' THEN 'create' ELSE 'update' END,
         queued_at = excluded.queued_at`,
      row.uuid,
      Date.now()
    );
  });

  return updatedProfesor;
}

export async function deleteLocalProfesor(identity: string) {
  const database = await getDatabase();
  const row = await findProfesorRow(identity);
  if (!row) throw new Error('No se encontró el profesor en la base de datos local.');

  await database.withTransactionAsync(async () => {
    const pending = await database.getFirstAsync<{ operation: OutboxOperation }>(
      'SELECT operation FROM profesores_outbox WHERE local_uuid = ?',
      row.uuid
    );

    if (row.remote_id === null && pending?.operation === 'create') {
      await database.runAsync('DELETE FROM profesores_outbox WHERE local_uuid = ?', row.uuid);
      await database.runAsync('DELETE FROM profesores WHERE uuid = ?', row.uuid);
      return;
    }

    const updatedProfesor = {
      ...mapProfesorRow(row),
      updated_at: new Date(Math.max(Date.now(), Date.parse(row.updated_at) + 1)).toISOString(),
    };
    await database.runAsync(
      'UPDATE profesores SET is_deleted = 1, data_json = ?, updated_at = ? WHERE uuid = ?',
      JSON.stringify(updatedProfesor),
      updatedProfesor.updated_at,
      row.uuid
    );
    await database.runAsync(
      `INSERT INTO profesores_outbox (local_uuid, operation, queued_at) VALUES (?, 'delete', ?)
       ON CONFLICT(local_uuid) DO UPDATE SET operation = 'delete', queued_at = excluded.queued_at`,
      row.uuid,
      Date.now()
    );
  });
}

export async function markProfesorCreated(localId: string, profesor: Profesor) {
  const database = await getDatabase();
  const remoteId = getProfesorIdentity(profesor);
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM profesores_outbox WHERE local_uuid = ?', localId);
    const existingCloudRow = await database.getFirstAsync<{ uuid: string }>(
      'SELECT uuid FROM profesores WHERE uuid = ? AND uuid != ?',
      profesor.uuid,
      localId
    );
    if (existingCloudRow) {
      await database.runAsync('DELETE FROM profesores WHERE uuid = ?', localId);
      await database.runAsync(
        'UPDATE profesores SET remote_id = ?, data_json = ?, is_deleted = 0, updated_at = ? WHERE uuid = ?',
        remoteId,
        JSON.stringify(profesor),
        profesor.updated_at,
        profesor.uuid
      );
      return;
    }

    await database.runAsync(
      'UPDATE profesores SET uuid = ?, remote_id = ?, data_json = ?, is_deleted = 0, updated_at = ? WHERE uuid = ?',
      profesor.uuid,
      remoteId,
      JSON.stringify(profesor),
      profesor.updated_at,
      localId
    );
  });
}

export async function markProfesorUpdated(localId: string, profesor: Profesor) {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      'UPDATE profesores SET data_json = ?, is_deleted = 0, updated_at = ? WHERE uuid = ?',
      JSON.stringify(profesor),
      profesor.updated_at,
      localId
    );
    await database.runAsync('DELETE FROM profesores_outbox WHERE local_id = ?', localId);
  });
}

export async function markProfesorDeleted(localId: string) {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM profesores_outbox WHERE local_id = ?', localId);
    await database.runAsync('DELETE FROM profesores WHERE uuid = ?', localId);
  });
}

export async function removeSyncedProfesor(identity: string) {
  const database = await getDatabase();
  const row = await findProfesorRow(identity);
  if (!row) return;
  await database.runAsync('DELETE FROM profesores WHERE uuid = ?', row.uuid);
}

export async function persistCloudProfesor(profesor: Profesor) {
  await saveCloudProfesores([profesor], false);
}

export async function getPendingSyncCount() {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM profesores_outbox'
  );
  return result?.count ?? 0;
}

export async function getSyncIntervalSeconds(): Promise<SyncIntervalSeconds> {
  const database = await getDatabase();
  const setting = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    'sync_interval_seconds'
  );
  if (!setting) return 10;

  const interval = Number(setting.value);
  if (interval !== 2 && interval !== 10 && interval !== 30) {
    throw new Error('La frecuencia de sincronización guardada no es válida.');
  }

  return interval;
}

export async function saveSyncIntervalSeconds(interval: SyncIntervalSeconds) {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    'sync_interval_seconds',
    String(interval)
  );
}

export async function getNewCloudProfesorIds(): Promise<string[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ remote_id: string }>(
    `SELECT n.remote_id
     FROM new_cloud_profesores n
     JOIN profesores p ON p.remote_id = n.remote_id
     WHERE p.is_deleted = 0`
  );
  return rows.map((row) => row.remote_id);
}

export async function markCloudProfesorAsViewed(identity: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM new_cloud_profesores WHERE remote_id = ?', identity);
}
