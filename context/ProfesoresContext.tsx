import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type PropsWithChildren,
} from 'react';

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
  id: number;
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
  id: number;
  name: string;
  apellido: string;
  Profesion: string;
  headline?: string;
  image?: string;
  location?: string;
  about?: string;
}

interface ProfesoresContextType {
  profesores: Profesor[];
  loading: boolean;
  error: string | null;
  fetchProfesores: (search: string) => Promise<void>;
  addProfesor: (profesor: NuevoProfesor) => Promise<Profesor>;
  getProfesorById: (id: number) => Profesor | undefined;
}

const PROFESORES_API_BASE_URL = process.env.EXPO_PUBLIC_PROFESORES_API_URL?.replace(/\/$/, '');
const ADD_PROFESORES_API_BASE_URL = process.env.EXPO_PUBLIC_ADD_PROFESORES_API_URL?.replace(/\/$/, '');

function isProfesorId(value: unknown): value is Profesor['_id'] {
  return (
    typeof value === 'string' ||
    (typeof value === 'object' &&
      value !== null &&
      (!('$oid' in value) || typeof value.$oid === 'string'))
  );
}

function isProfesorResponse(value: unknown): value is Profesor {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value &&
    isProfesorId(value._id) &&
    'id' in value &&
    typeof value.id === 'number' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'apellido' in value &&
    typeof value.apellido === 'string' &&
    'Profesion' in value &&
    typeof value.Profesion === 'string'
  );
}

const ProfesoresContext = createContext<ProfesoresContextType | undefined>(undefined);

export function ProfesoresProvider({ children }: Readonly<PropsWithChildren>) {
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfesores = useCallback(async (search: string) => {
    const normalizedSearch = search.trim();
    if (!normalizedSearch) {
      setProfesores([]);
      setError('Escribe un ID, nombre, apellido o profesión para buscar.');
      return;
    }

    if (!PROFESORES_API_BASE_URL) {
      setError('Configura EXPO_PUBLIC_PROFESORES_API_URL con la URL pública del servicio de profesores.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${PROFESORES_API_BASE_URL}/api/profesores/datos?search=${encodeURIComponent(normalizedSearch)}`
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data: Profesor[] = await response.json();
      setProfesores(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al obtener la lista de profesores';
      setError(errorMessage);
      console.error('Error en ProfesoresContext:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addProfesor = useCallback(async (profesor: NuevoProfesor) => {
    if (!ADD_PROFESORES_API_BASE_URL) {
      throw new Error('Configura EXPO_PUBLIC_ADD_PROFESORES_API_URL con la URL pública del servicio de creación de profesores.');
    }

    const response = await fetch(`${ADD_PROFESORES_API_BASE_URL}/api/profesores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profesor),
    });
    const data: unknown = await response.json();

    if (!response.ok) {
      const message =
        typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
          ? data.error
          : `Error ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }

    if (!isProfesorResponse(data)) {
      throw new Error('El servicio devolvió una respuesta inválida al crear el profesor.');
    }

    const createdProfesor = data;
    setProfesores([createdProfesor]);
    setError(null);
    return createdProfesor;
  }, []);

  const getProfesorById = useCallback(
    (id: number) => profesores.find((p) => p.id === id),
    [profesores]
  );

  const value = useMemo(
    () => ({
      profesores,
      loading,
      error,
      fetchProfesores,
      addProfesor,
      getProfesorById,
    }),
    [profesores, loading, error, fetchProfesores, addProfesor, getProfesorById]
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