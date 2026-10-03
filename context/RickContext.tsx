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

const RICK_API_BASE_URL = (() => {
  const configuredUrl = process.env.EXPO_PUBLIC_RICK_API_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  // Apuntar directamente a la API desplegada en Render
  return 'https://rickandmorty-api-python.onrender.com';
})();;

type RickAndMortyCharacter = {
  id: number;
  name: string;
  status: string;
  species: string;
  type: string;
  gender: string;
  origin: { name: string; url: string };
  location: { name: string; url: string };
  image: string;
  episode: string[];
  url?: string;
  created?: string;
};

type RickContextValue = {
  character: RickAndMortyCharacter | null;
  loading: boolean;
  error: string;
  searchCharacter: (query: string) => Promise<void>;
};

async function fetchCharacter(query: string, signal: AbortSignal) {
  const response = await fetch(
    `${RICK_API_BASE_URL}/api/character/${encodeURIComponent(query)}`,
    { signal }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(response.status === 404
      ? 'No se encontró ese personaje. Revisa el nombre o el ID.'
      : body?.detail ?? 'No se pudo consultar el catálogo. Inténtalo de nuevo.');
  }

  return await response.json() as RickAndMortyCharacter;
}

const RickContext = createContext<RickContextValue | undefined>(undefined);
const EMPTY_RICK_CONTEXT: RickContextValue = {
  character: null,
  loading: false,
  error: '',
  searchCharacter: async () => undefined,
};

export function RickProvider({ children }: Readonly<PropsWithChildren>) {
  const [character, setCharacter] = useState<RickAndMortyCharacter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const searchCharacter = useCallback(async (query: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const normalizedQuery = query.trim();

    setCharacter(null);
    setError('');

    if (!normalizedQuery) {
      setLoading(false);
      setError('Escribe el nombre completo o el ID de un personaje.');
      return;
    }

    setLoading(true);

    try {
      const result = await fetchCharacter(normalizedQuery, controller.signal);
      if (!controller.signal.aborted) setCharacter(result);
    } catch (requestError: unknown) {
      if (controller.signal.aborted) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Ocurrió un error al consultar Rick y Morty.'
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({ character, loading, error, searchCharacter }),
    [character, loading, error, searchCharacter]
  );

  return (
    <RickContext.Provider value={value}>
      {children}
    </RickContext.Provider>
  );
}

export function useRickContext() {
  const context = useContext(RickContext);

  return context ?? EMPTY_RICK_CONTEXT;
}