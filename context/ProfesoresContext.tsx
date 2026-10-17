import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, Platform } from 'react-native';
import {
  createLocalProfesor,
  deleteLocalProfesor,
  getCachedProfesores,
  getNewCloudProfesorIds,
  getPendingProfesorChanges,
  getPendingProfesores,
  getPendingSyncCount,
  getRemoteProfesorIdentity,
  getProfesorIdentity as getStoredProfesorIdentity,
  getSyncIntervalSeconds,
  markCloudProfesorAsViewed,
  markProfesorCreated,
  markProfesorDeleted,
  markProfesorUpdated,
  persistCloudProfesor,
  removeSyncedProfesor,
  saveCloudProfesores,
  saveSyncIntervalSeconds,
  updateLocalProfesor,
  type PendingProfesorChange,
} from './ProfesoresDatabase';

export interface ProfesorExperience {
  company: string;
  role: string;
  period: string;
  description: string;
}

export interface ProfesorEducation {
  institution: string;
  degree: string;
  year: string | number;
}

export interface ProfesorContact {
  linkedin?: string;
  website?: string;
}

export interface Profesor {
  _id: {
    $oid?: string;
  } | string;
  uuid: string;
  updated_at: string;
  is_deleted?: boolean;
  name: string;
  apellido: string;
  Profesion: string;
  headline?: string;
  image?: string | null;
  location?: string;
  about?: string;
  experience?: ProfesorExperience[];
  education?: ProfesorEducation[];
  skills?: string[];
  contact?: ProfesorContact;
}

export interface NuevoProfesor {
  name: string;
  apellido: string;
  Profesion: string;
  headline?: string;
  image?: string;
  location?: string;
  about?: string;
}

export interface DatosProfesorEditables {
  name: string;
  apellido: string;
  Profesion: string;
  headline: string;
  image: string;
  location: string;
  about: string;
}

export type SyncIntervalSeconds = 2 | 10 | 30;

export const SYNC_INTERVAL_OPTIONS: SyncIntervalSeconds[] = [2, 10, 30];

interface ProfesoresContextType {
  profesores: Profesor[];
  loading: boolean;
  error: string | null;
  isOnline: boolean | null;
  isSyncing: boolean;
  pendingSyncCount: number;
  newCloudProfesorIds: string[];
  markNewCloudProfesorAsViewed: (identity: string) => Promise<void>;
  syncIntervalLoaded: boolean;
  syncIntervalSeconds: SyncIntervalSeconds;
  setSyncIntervalSeconds: (interval: SyncIntervalSeconds) => Promise<void>;
  fetchProfesores: (search: string) => Promise<void>;
  addProfesor: (profesor: NuevoProfesor) => Promise<Profesor>;
  updateProfesor: (id: string, datos: DatosProfesorEditables) => Promise<Profesor>;
  deleteProfesor: (id: string) => Promise<void>;
  syncNow: () => Promise<void>;
  getProfesorById: (id: string) => Profesor | undefined;
}

const PROFESORES_API_BASE_URL = process.env.EXPO_PUBLIC_PROFESORES_API_URL?.replace(/\/$/, '');
const ADD_PROFESORES_API_BASE_URL = process.env.EXPO_PUBLIC_ADD_PROFESORES_API_URL?.replace(/\/$/, '');
const MOD_PROFESORES_API_BASE_URL = process.env.EXPO_PUBLIC_MOD_PROFESORES_API_URL?.replace(/\/$/, '');
const DEL_PROFESORES_API_BASE_URL = process.env.EXPO_PUBLIC_DEL_PROFESORES_API_URL?.replace(/\/$/, '');
const supportsOfflineStorage = Platform.OS !== 'web';

class NetworkRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkRequestError';
  }
}

function getProfesorIdentity(profesor: Profesor) {
  return getStoredProfesorIdentity(profesor);
}

function uniqueProfesores(profesores: Profesor[]) {
  const seen = new Set<string>();
  return profesores.filter((profesor) => {
    const identity = getProfesorIdentity(profesor);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function isProfesorId(value: unknown): value is Profesor['_id'] {
  return (
    (typeof value === 'string' &&
      (/^[\da-f]{24}$/i.test(value) ||
        /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value))) ||
    (typeof value === 'object' &&
      value !== null &&
      '$oid' in value &&
      typeof value.$oid === 'string' &&
      /^[\da-f]{24}$/i.test(value.$oid))
  );
}

function getProfesorResponseIssues(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return ['registro no es un objeto'];

  const issues: string[] = [];
  if (!('_id' in value) || !isProfesorId(value._id)) issues.push('_id inválido');
  if (
    !('uuid' in value) ||
    typeof value.uuid !== 'string' ||
    !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value.uuid)
  ) {
    issues.push('uuid ausente o inválido');
  }
  if (
    !('updated_at' in value) ||
    typeof value.updated_at !== 'string' ||
    Number.isNaN(Date.parse(value.updated_at))
  ) {
    issues.push('updated_at ausente o inválido');
  }
  if (
    !('name' in value) || typeof value.name !== 'string' ||
    !('apellido' in value) || typeof value.apellido !== 'string' ||
    !('Profesion' in value) || typeof value.Profesion !== 'string'
  ) {
    issues.push('name, apellido o Profesion ausente');
  }
  return issues;
}

function isProfesorResponse(value: unknown): value is Profesor {
  return getProfesorResponseIssues(value).length === 0;
}

function isProfesorList(value: unknown): value is Profesor[] {
  return Array.isArray(value) && value.every(isProfesorResponse);
}

function getProfesorListValidationError(value: unknown) {
  if (!Array.isArray(value)) return 'El servicio no devolvió una lista.';
  const issueCounts = new Map<string, number>();
  let invalidCount = 0;
  for (const profesor of value) {
    const issues = getProfesorResponseIssues(profesor);
    if (issues.length === 0) continue;
    invalidCount++;
    for (const issue of issues) issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
  }
  const details = [...issueCounts]
    .map(([issue, count]) => `${issue}: ${count}`)
    .join(', ');
  return `${invalidCount} de ${value.length} registros inválidos (${details}).`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}

function nextUpdatedAt(value?: string) {
  const previous = value ? Date.parse(value) : 0;
  return new Date(Math.max(Date.now(), Number.isNaN(previous) ? 0 : previous + 1)).toISOString();
}

function isOnlineState(state: NetInfoState) {
  return state.isConnected === true && state.isInternetReachable !== false;
}

async function getDeviceOnlineStatus() {
  if (!supportsOfflineStorage) return true;
  return isOnlineState(await NetInfo.fetch());
}

async function requestJson(url: string, options?: RequestInit, allowNotFound = false): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new NetworkRequestError(getErrorMessage(error));
  }

  if (allowNotFound && response.status === 404) return undefined;
  if (response.status === 204) return undefined;

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`El servicio devolvió una respuesta JSON inválida: ${getErrorMessage(error)}`);
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return data;
}

function requireApiUrl(url: string | undefined, message: string) {
  if (!url) throw new Error(message);
  return url;
}

function getEditableProfesorData(profesor: Profesor): DatosProfesorEditables {
  return {
    name: profesor.name,
    apellido: profesor.apellido,
    Profesion: profesor.Profesion,
    headline: profesor.headline ?? '',
    image: typeof profesor.image === 'string' ? profesor.image : '',
    location: profesor.location ?? '',
    about: profesor.about ?? '',
  };
}

function getNewProfesorData(profesor: Profesor): NuevoProfesor & Pick<Profesor, 'uuid' | 'updated_at'> {
  return {
    name: profesor.name,
    apellido: profesor.apellido,
    Profesion: profesor.Profesion,
    uuid: profesor.uuid,
    updated_at: profesor.updated_at,
    ...(profesor.headline ? { headline: profesor.headline } : {}),
    ...(typeof profesor.image === 'string' && profesor.image ? { image: profesor.image } : {}),
    ...(profesor.location ? { location: profesor.location } : {}),
    ...(profesor.about ? { about: profesor.about } : {}),
  };
}

async function sendPendingChange(change: PendingProfesorChange) {
  if (change.operation === 'create') {
    const url = requireApiUrl(
      ADD_PROFESORES_API_BASE_URL,
      'Configura EXPO_PUBLIC_ADD_PROFESORES_API_URL con la URL pública del servicio de creación de profesores.'
    );
    const data = await requestJson(`${url}/api/profesores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getNewProfesorData(change.profesor)),
    });
    if (!isProfesorResponse(data)) {
      throw new Error('El servicio devolvió una respuesta inválida al sincronizar la creación del profesor.');
    }
    await markProfesorCreated(change.localId, data);
    return;
  }

  if (change.operation === 'update') {
    if (!change.remoteId) {
      throw new Error('No se puede sincronizar la modificación: falta el ID del profesor en la nube.');
    }
    const url = requireApiUrl(
      MOD_PROFESORES_API_BASE_URL,
      'Configura EXPO_PUBLIC_MOD_PROFESORES_API_URL con la URL pública del servicio de modificación de profesores.'
    );
    const data = await requestJson(`${url}/api/profesores/${change.remoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...getEditableProfesorData(change.profesor),
        uuid: change.profesor.uuid,
        updated_at: change.profesor.updated_at,
      }),
    });
    if (!isProfesorResponse(data)) {
      throw new Error('El servicio devolvió una respuesta inválida al sincronizar la modificación del profesor.');
    }
    await markProfesorUpdated(change.localId, data);
    return;
  }

  if (!change.remoteId) {
    await markProfesorDeleted(change.localId);
    return;
  }
  const url = requireApiUrl(
    DEL_PROFESORES_API_BASE_URL,
    'Configura EXPO_PUBLIC_DEL_PROFESORES_API_URL con la URL pública del servicio de eliminación de profesores.'
  );
  const result = await requestJson(`${url}/api/profesores/${change.remoteId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uuid: change.profesor.uuid,
      updated_at: change.profesor.updated_at,
    }),
  }, true);
  let remoteProfesor: Profesor | undefined;
  if (result !== undefined) {
    if (
      typeof result !== 'object' ||
      result === null ||
      !('profesor' in result) ||
      !isProfesorResponse(result.profesor)
    ) {
      throw new Error('El servicio devolvió una respuesta inválida al sincronizar la eliminación del profesor.');
    }
    remoteProfesor = result.profesor;
  }
  await markProfesorDeleted(change.localId);
  if (remoteProfesor && remoteProfesor.is_deleted !== true) {
    await persistCloudProfesor(remoteProfesor);
  }
}

const ProfesoresContext = createContext<ProfesoresContextType | undefined>(undefined);

export function ProfesoresProvider({ children }: Readonly<PropsWithChildren>) {
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean | null>(supportsOfflineStorage ? null : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [newCloudProfesorIds, setNewCloudProfesorIds] = useState<string[]>([]);
  const [syncIntervalSeconds, setSyncIntervalSecondsState] = useState<SyncIntervalSeconds>(10);
  const [syncIntervalLoaded, setSyncIntervalLoaded] = useState(!supportsOfflineStorage);
  const currentSearch = useRef('');
  const syncInFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!supportsOfflineStorage) return undefined;
    let active = true;

    void Promise.all([getSyncIntervalSeconds(), getNewCloudProfesorIds()])
      .then(([interval, newProfesorIds]) => {
        if (active) setSyncIntervalSecondsState(interval);
        if (active) setNewCloudProfesorIds(newProfesorIds);
      })
      .catch((settingError: unknown) => {
        if (active) {
          setError(`No se pudo cargar la frecuencia de sincronización: ${getErrorMessage(settingError)}`);
        }
      })
      .finally(() => {
        if (active) setSyncIntervalLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const syncPendingChanges = useCallback(async (refreshCloud = true) => {
    if (!supportsOfflineStorage) return;
    if (syncInFlight.current) {
      await syncInFlight.current;
      return;
    }

    const syncTask = (async () => {
      setIsSyncing(true);
      try {
        const changes = await getPendingProfesorChanges();
        for (const change of changes) {
          await sendPendingChange(change);
        }

        if (refreshCloud) {
          const url = requireApiUrl(
            PROFESORES_API_BASE_URL,
            'Configura EXPO_PUBLIC_PROFESORES_API_URL con la URL pública del servicio de profesores.'
          );
          const data = await requestJson(`${url}/api/profesores/datos`);
          if (!isProfesorList(data)) {
            throw new Error(
              `La API de profesores devolvió datos incompatibles al sincronizar: ${getProfesorListValidationError(data)}`
            );
          }
          await saveCloudProfesores(uniqueProfesores(data), true);
          setNewCloudProfesorIds(await getNewCloudProfesorIds());
        }
        setError(null);
      } finally {
        setPendingSyncCount(await getPendingSyncCount());
        setIsSyncing(false);
      }
    })();

    syncInFlight.current = syncTask;
    try {
      await syncTask;
    } finally {
      if (syncInFlight.current === syncTask) syncInFlight.current = null;
    }
  }, []);

  const refreshVisibleCache = useCallback(async () => {
    if (!supportsOfflineStorage) return;
    const [cachedProfesores, count] = await Promise.all([
      getCachedProfesores(currentSearch.current),
      getPendingSyncCount(),
    ]);
    setProfesores(cachedProfesores);
    setPendingSyncCount(count);
  }, []);

  useEffect(() => {
    if (!supportsOfflineStorage) return undefined;
    let active = true;

    const onConnectivityChange = (state: NetInfoState) => {
      const online = isOnlineState(state);
      setIsOnline(online);
      if (online) {
        void syncPendingChanges(true)
          .then(async () => {
            if (active) await refreshVisibleCache();
          })
          .catch((syncError: unknown) => {
            if (active) setError(`No se pudo sincronizar con la nube: ${getErrorMessage(syncError)}`);
          });
      }
    };

    const unsubscribe = NetInfo.addEventListener(onConnectivityChange);
    void (async () => {
      await refreshVisibleCache();
      onConnectivityChange(await NetInfo.fetch());
    })().catch((initializationError: unknown) => {
      if (active) setError(`No se pudo abrir la base de datos local: ${getErrorMessage(initializationError)}`);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [refreshVisibleCache, syncPendingChanges]);

  const setSyncInterval = useCallback(async (interval: SyncIntervalSeconds) => {
    if (!SYNC_INTERVAL_OPTIONS.includes(interval)) {
      throw new Error('Selecciona una frecuencia de sincronización válida.');
    }
    if (supportsOfflineStorage) await saveSyncIntervalSeconds(interval);
    setSyncIntervalSecondsState(interval);
    setError(null);
  }, []);

  useEffect(() => {
    if (!supportsOfflineStorage || !syncIntervalLoaded) return undefined;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextSync = () => {
      if (active) timer = setTimeout(() => void pollCloudChanges(), syncIntervalSeconds * 1000);
    };

    const pollCloudChanges = async () => {
      try {
        if (AppState.currentState === 'active') {
          const online = await getDeviceOnlineStatus();
          if (active) setIsOnline(online);
          if (online) {
            await syncPendingChanges(true);
            if (active) await refreshVisibleCache();
          }
        }
      } catch (syncError: unknown) {
        if (active) setError(`No se pudo sincronizar con la nube: ${getErrorMessage(syncError)}`);
      } finally {
        scheduleNextSync();
      }
    };

    scheduleNextSync();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [refreshVisibleCache, syncIntervalLoaded, syncIntervalSeconds, syncPendingChanges]);

  const fetchProfesores = useCallback(async (search: string) => {
    const normalizedSearch = search.trim();
    currentSearch.current = normalizedSearch;
    setLoading(true);
    setError(null);

    try {
      const online = await getDeviceOnlineStatus();
      setIsOnline(online);

      if (!online && supportsOfflineStorage) {
        setProfesores(await getCachedProfesores(normalizedSearch));
        return;
      }

      if (supportsOfflineStorage) await syncPendingChanges(false);
      const url = requireApiUrl(
        PROFESORES_API_BASE_URL,
        'Configura EXPO_PUBLIC_PROFESORES_API_URL con la URL pública del servicio de profesores.'
      );
      const query = normalizedSearch ? `?search=${encodeURIComponent(normalizedSearch)}` : '';
      const data = await requestJson(`${url}/api/profesores/datos${query}`);
      if (!isProfesorList(data)) {
        throw new Error(
          `La API de profesores devolvió datos incompatibles: ${getProfesorListValidationError(data)}`
        );
      }
      const remoteProfesores = uniqueProfesores(data);

      if (supportsOfflineStorage) {
        await saveCloudProfesores(remoteProfesores, !normalizedSearch);
        setNewCloudProfesorIds(await getNewCloudProfesorIds());
        if (normalizedSearch) {
          const pendingProfesores = await getPendingProfesores(normalizedSearch);
          setProfesores(uniqueProfesores([...pendingProfesores, ...remoteProfesores]));
        } else {
          setProfesores(await getCachedProfesores());
        }
        setPendingSyncCount(await getPendingSyncCount());
      } else {
        setProfesores(remoteProfesores);
      }
    } catch (fetchError) {
      if (supportsOfflineStorage) {
        setProfesores(await getCachedProfesores(normalizedSearch));
      }
      const message = getErrorMessage(fetchError);
      setError(
        fetchError instanceof NetworkRequestError
          ? `No se pudo conectar con la nube; se muestran los datos locales. ${message}`
          : message
      );
      console.error('Error en ProfesoresContext:', fetchError);
    } finally {
      setLoading(false);
    }
  }, [syncPendingChanges]);

  const addProfesor = useCallback(async (profesor: NuevoProfesor) => {
    const online = await getDeviceOnlineStatus();
    setIsOnline(online);
    if (!online && supportsOfflineStorage) {
      const localProfesor = await createLocalProfesor(profesor);
      await refreshVisibleCache();
      setError(null);
      return localProfesor;
    }

    if (supportsOfflineStorage) {
      try {
        await syncPendingChanges(false);
      } catch (syncError) {
        if (!(syncError instanceof NetworkRequestError) && await getDeviceOnlineStatus()) throw syncError;
        const localProfesor = await createLocalProfesor(profesor);
        await refreshVisibleCache();
        return localProfesor;
      }
    }

    const uuid = Crypto.randomUUID();
    const updatedAt = new Date().toISOString();
    try {
      const url = requireApiUrl(
        ADD_PROFESORES_API_BASE_URL,
        'Configura EXPO_PUBLIC_ADD_PROFESORES_API_URL con la URL pública del servicio de creación de profesores.'
      );
      const data = await requestJson(`${url}/api/profesores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profesor, uuid, updated_at: updatedAt }),
      });
      if (!isProfesorResponse(data)) {
        const responseIssues = getProfesorResponseIssues(data);
        throw new Error(
          `La API de creación no devolvió un registro con UUID y marca de tiempo válidos (${responseIssues.join(', ')}). ` +
          'El POST pudo haberse guardado en la nube; no lo reintentes para evitar duplicados. Redepliega add-profesores-api.'
        );
      }
      if (supportsOfflineStorage) await persistCloudProfesor(data);
      setProfesores((current) => uniqueProfesores([data, ...current]));
      setError(null);
      return data;
    } catch (createError) {
      if (!(createError instanceof NetworkRequestError) || !supportsOfflineStorage) throw createError;
      const localProfesor = await createLocalProfesor(profesor, uuid, updatedAt);
      await refreshVisibleCache();
      return localProfesor;
    }
  }, [refreshVisibleCache, syncPendingChanges]);

  const updateProfesor = useCallback(async (id: string, datos: DatosProfesorEditables) => {
    const online = await getDeviceOnlineStatus();
    setIsOnline(online);
    if (!online && supportsOfflineStorage) {
      const updatedProfesor = await updateLocalProfesor(id, datos);
      await refreshVisibleCache();
      setError(null);
      return updatedProfesor;
    }

    if (supportsOfflineStorage) {
      const updatedProfesor = await updateLocalProfesor(id, datos);
      try {
        await syncPendingChanges(false);
        setError(null);
      } catch (syncError) {
        if (!(syncError instanceof NetworkRequestError) && await getDeviceOnlineStatus()) throw syncError;
      }
      await refreshVisibleCache();
      return updatedProfesor;
    }

    try {
      const url = requireApiUrl(
        MOD_PROFESORES_API_BASE_URL,
        'Configura EXPO_PUBLIC_MOD_PROFESORES_API_URL con la URL pública del servicio de modificación de profesores.'
      );
      const remoteId = supportsOfflineStorage ? await getRemoteProfesorIdentity(id) : id;
      if (!remoteId) throw new Error('El profesor todavía no tiene un ID sincronizado con la nube.');
      const currentProfesor = profesores.find((profesor) => getProfesorIdentity(profesor) === id);
      const data = await requestJson(`${url}/api/profesores/${remoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...datos,
          uuid: currentProfesor?.uuid,
          updated_at: nextUpdatedAt(currentProfesor?.updated_at),
        }),
      });
      if (!isProfesorResponse(data)) throw new Error('El servicio devolvió una respuesta inválida al modificar el profesor.');
      if (supportsOfflineStorage) await persistCloudProfesor(data);
      if (supportsOfflineStorage) await refreshVisibleCache();
      else {
        setProfesores((current) =>
          uniqueProfesores(current.map((profesor) =>
            getProfesorIdentity(profesor) === id ? data : profesor
          ))
        );
      }
      setError(null);
      return data;
    } catch (updateError) {
      if (!(updateError instanceof NetworkRequestError) || !supportsOfflineStorage) throw updateError;
      const updatedProfesor = await updateLocalProfesor(id, datos);
      await refreshVisibleCache();
      return updatedProfesor;
    }
  }, [profesores, refreshVisibleCache, syncPendingChanges]);

  const deleteProfesor = useCallback(async (id: string) => {
    const online = await getDeviceOnlineStatus();
    setIsOnline(online);
    if (!online && supportsOfflineStorage) {
      await deleteLocalProfesor(id);
      await refreshVisibleCache();
      setError(null);
      return;
    }

    if (supportsOfflineStorage) {
      try {
        await deleteLocalProfesor(id);
        await syncPendingChanges(false);
        await refreshVisibleCache();
        setError(null);
        return;
      } catch (syncError) {
        if (!(syncError instanceof NetworkRequestError) && await getDeviceOnlineStatus()) throw syncError;
        await refreshVisibleCache();
        return;
      }
    }

    try {
      const url = requireApiUrl(
        DEL_PROFESORES_API_BASE_URL,
        'Configura EXPO_PUBLIC_DEL_PROFESORES_API_URL con la URL pública del servicio de eliminación de profesores.'
      );
      const remoteId = supportsOfflineStorage ? await getRemoteProfesorIdentity(id) : id;
      if (!remoteId) throw new Error('El profesor todavía no tiene un ID sincronizado con la nube.');
      const profesor = profesores.find((item) => getProfesorIdentity(item) === id);
      await requestJson(`${url}/api/profesores/${remoteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: profesor?.uuid, updated_at: nextUpdatedAt(profesor?.updated_at) }),
      });
      if (supportsOfflineStorage) await removeSyncedProfesor(id);
      setProfesores((current) => current.filter((profesor) => getProfesorIdentity(profesor) !== id));
      setError(null);
    } catch (deleteError) {
      if (!(deleteError instanceof NetworkRequestError) || !supportsOfflineStorage) throw deleteError;
      await deleteLocalProfesor(id);
      await refreshVisibleCache();
    }
  }, [profesores, refreshVisibleCache, syncPendingChanges]);

  const syncNow = useCallback(async () => {
    if (!supportsOfflineStorage) return;
    const online = await getDeviceOnlineStatus();
    setIsOnline(online);
    if (!online) throw new Error('No hay conexión a Internet para sincronizar.');
    await syncPendingChanges(true);
    await refreshVisibleCache();
  }, [refreshVisibleCache, syncPendingChanges]);

  const markNewProfesorAsViewed = useCallback(async (identity: string) => {
    if (supportsOfflineStorage) await markCloudProfesorAsViewed(identity);
    setNewCloudProfesorIds((current) => current.filter((newId) => newId !== identity));
  }, []);

  const getProfesorById = useCallback(
    (id: string) => profesores.find((profesor) => getProfesorIdentity(profesor) === id),
    [profesores]
  );

  const value = useMemo(
    () => ({
      profesores,
      loading,
      error,
      isOnline,
      isSyncing,
      pendingSyncCount,
      newCloudProfesorIds,
      markNewCloudProfesorAsViewed: markNewProfesorAsViewed,
      syncIntervalLoaded,
      syncIntervalSeconds,
      setSyncIntervalSeconds: setSyncInterval,
      fetchProfesores,
      addProfesor,
      updateProfesor,
      deleteProfesor,
      syncNow,
      getProfesorById,
    }),
    [
      profesores,
      loading,
      error,
      isOnline,
      isSyncing,
      pendingSyncCount,
      newCloudProfesorIds,
      markNewProfesorAsViewed,
      syncIntervalLoaded,
      syncIntervalSeconds,
      setSyncInterval,
      fetchProfesores,
      addProfesor,
      updateProfesor,
      deleteProfesor,
      syncNow,
      getProfesorById,
    ]
  );

  return (
    <ProfesoresContext.Provider value={value}>
      {children}
    </ProfesoresContext.Provider>
  );
}

export function useProfesores() {
  const context = useContext(ProfesoresContext);
  if (!context) {
    throw new Error('useProfesores debe usarse dentro de un ProfesoresProvider');
  }
  return context;
}
