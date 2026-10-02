import { useSegments } from 'expo-router';
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

const RICK_AND_MORTY_API = 'https://rickandmortyapi.com/api/character/';

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
};

type RickAndMortyPage = {
  info: {
    next: string | null;
  };
  results: RickAndMortyCharacter[];
};

type RickContextValue = {
  character: RickAndMortyCharacter | null;
  loading: boolean;
  error: string;
  searchCharacter: (query: string) => Promise<void>;
};

async function fetchCharacter(query: string, signal: AbortSignal) {
  const isId = /^\d+$/.test(query);
  const url = isId
    ? `${RICK_AND_MORTY_API}${encodeURIComponent(query)}`
    : `${RICK_AND_MORTY_API}?name=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(response.status === 404
      ? 'No se encontró ese personaje. Revisa el nombre o el ID.'
      : 'No se pudo consultar la API. Inténtalo de nuevo.');
  }

  if (isId) return (await response.json()) as RickAndMortyCharacter;
  return selectNameMatch((await response.json()) as RickAndMortyPage, query);
}

function selectNameMatch(page: RickAndMortyPage, query: string) {
  const exactMatch = page.results.find(
    (item) => item.name.toLowerCase() === query.toLowerCase()
  );

  if (exactMatch) return exactMatch;
  if (page.results.length === 1) return page.results[0];
  if (page.results.length === 0) {
    throw new Error('No se encontró ese personaje. Revisa el nombre o el ID.');
  }
  throw new Error('Hay varias coincidencias. Escribe el nombre completo o usa el ID.');
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
  const segments = useSegments();
  const activeRoute = segments.at(-1);
  const isRickScreen = activeRoute === 'RickyMorty' || activeRoute === 'InfoRick';

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
  const screenValue = isRickScreen ? value : undefined;

  return (
    <RickContext.Provider value={screenValue}>
      {children}
    </RickContext.Provider>
  );
}

export function useRickContext() {
  const context = useContext(RickContext);
  const segments = useSegments();
  const activeRoute = segments.at(-1);
  if (!context && (activeRoute === 'RickyMorty' || activeRoute === 'InfoRick')) {
    throw new Error('useRickContext debe usarse dentro de RickProvider');
  }
  return context ?? EMPTY_RICK_CONTEXT;
}