import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

const getLocalApiHost = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.hostname;
  }

  return Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
};

const POKEMON_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');

// CORREGIDO: Apunta a Render en producción y a tu entorno local durante desarrollo
const AI_API_URL = __DEV__
  ? `http://${getLocalApiHost()}:3001`
  : 'https://pokeapi-ia.onrender.com';

const QUESTION_STOP_WORDS = new Set([
  'que', 'como', 'cual', 'cuales', 'quien', 'donde', 'cuando', 'por', 'para', 'con', 'sin',
  'una', 'uno', 'unos', 'unas', 'los', 'las', 'del', 'desde', 'sobre', 'entre', 'hay', 'el',
  'la', 'de', 'un', 'es', 'son', 'tiene', 'tienen', 'puede', 'pueden', 'dime', 'muestra',
  'mostrar', 'explica', 'necesito', 'quiero', 'saber', 'informacion', 'aplicacion', 'pokemon',
  'tipo', 'tipos', 'habilidad', 'habilidades', 'agua', 'fuego', 'planta', 'hierba', 'electrico',
  'hielo', 'lucha', 'veneno', 'tierra', 'volador', 'psiquico', 'bicho', 'roca', 'fantasma',
  'dragon', 'siniestro', 'acero', 'hada', 'normal', 'what', 'which', 'who', 'where', 'when',
  'the', 'and', 'for', 'with', 'does', 'have', 'tell', 'about', 'explain', 'please', 'type',
  'water', 'fire', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying',
  'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
]);

type PokemonRecord = {
  id: string | number;
  name: string;
  types?: { type?: { name?: string } }[];
  abilities?: { ability?: { name?: string } }[];
  moves?: { move?: { name?: string } }[];
};

function getPokemonNameCandidates(question: string) {
  return [...new Set(
    question
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9-]+/)
      .filter((word) => word.length > 2 && !QUESTION_STOP_WORDS.has(word))
  )].slice(0, 8);
}

async function findPokemonInExistingService(question: string): Promise<PokemonRecord | null> {
  if (!POKEMON_API_URL) {
    throw new Error('Falta configurar EXPO_PUBLIC_API_URL para validar el Pokemon.');
  }

  const candidates = getPokemonNameCandidates(question);
  if (!candidates.length) return null;

  const lookups = await Promise.allSettled(candidates.map(async (candidate) => {
    const response = await fetch(`${POKEMON_API_URL}/api/pokemon/${encodeURIComponent(candidate)}`);
    if (response.status === 400 || response.status === 404) return null;
    if (!response.ok) throw new Error(`El servicio de Pokemon respondio ${response.status}.`);
    const pokemon = await response.json() as PokemonRecord;
    return typeof pokemon.name === 'string' && (typeof pokemon.id === 'number' || typeof pokemon.id === 'string')
      ? pokemon
      : null;
  }));

  const match = lookups.find((result) => result.status === 'fulfilled' && result.value !== null);
  if (match?.status === 'fulfilled') return match.value;

  const failedLookup = lookups.find((result) => result.status === 'rejected');
  if (failedLookup?.status === 'rejected') throw failedLookup.reason;
  return null;
}

type AskResponse = {
  answer?: string;
  error?: string;
  sources?: { catalog: 'pokemon' | 'rick' | 'profesores'; name: string }[];
};

export default function ConIAScreen() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<NonNullable<AskResponse['sources']>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const askAI = async () => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) {
      setError('Escribe una pregunta sobre la información de esta app.');
      return;
    }
    if (!AI_API_URL) {
      setError('El asistente no está configurado correctamente.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setError('');
    setAnswer('');
    setSources([]);

    try {
      const pokemon = await findPokemonInExistingService(cleanQuestion);
      if (!pokemon) {
        setError('No encontré un Pokémon válido en la consulta. Escribe su nombre y vuelve a intentarlo; no se llamó a Gemini.');
        return;
      }

      const response = await fetch(`${AI_API_URL}/api/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: cleanQuestion, pokemon }),
      });
      const data = await response.json().catch(() => null) as AskResponse | null;

      if (!response.ok) {
        throw new Error(data?.error ?? 'No se pudo consultar el asistente.');
      }
      if (!data?.answer) {
        throw new Error('El servidor no devolvió una respuesta.');
      }
      setAnswer(data.answer);
      setSources(data.sources ?? []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Ocurrió un error al consultar el asistente.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="auto-awesome" size={27} color="#c9f0dd" />
        </View>
        <Text style={styles.eyebrow}>ASISTENTE DE LA APP</Text>
        <Text style={styles.title}>¿Qué quieres saber?</Text>
        <Text style={styles.subtitle}>
          Pregunta sobre un Pokémon que exista en la base de datos de la app.
        </Text>
      </View>

      <View style={styles.composer}>
        <Text style={styles.label}>Tu pregunta</Text>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          style={styles.input}
          placeholder="Ej.: ¿Qué tipo tiene Pikachu?"
          placeholderTextColor="#84928a"
          multiline
          maxLength={500}
          textAlignVertical="top"
          editable={!loading}
          accessibilityLabel="Escribe tu pregunta"
        />
        <Text style={styles.counter}>{question.length}/500</Text>
        <Pressable
          accessibilityRole="button"
          onPress={askAI}
          disabled={loading}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Consultar</Text>
              <MaterialIcons name="arrow-forward" size={19} color="#fff" />
            </>
          )}
        </Pressable>
      </View>

      {!!error && (
        <View style={styles.errorBox} accessibilityRole="alert">
          <MaterialIcons name="error-outline" size={20} color="#a5372b" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!!answer && (
        <View style={styles.answerCard}>
          <View style={styles.answerHeading}>
            <MaterialIcons name="auto-awesome" size={20} color="#18745b" />
            <Text style={styles.answerTitle}>Respuesta</Text>
          </View>
          <Text style={styles.answerText}>{answer}</Text>
          {!!sources.length && (
            <View style={styles.sourceList}>
              <Text style={styles.sourceLabel}>Fuentes consultadas</Text>
              {sources.map((source) => (
                <Text key={`${source.catalog}-${source.name}`} style={styles.sourceText}>
                  • {source.catalog === 'pokemon' ? 'Pokémon' : source.catalog === 'rick' ? 'Rick y Morty' : 'Profesores'}: {source.name}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {!answer && !error && (
        <View style={styles.hint}>
          <MaterialIcons name="info-outline" size={18} color="#63746b" />
          <Text style={styles.hintText}>
            Primero se valida el nombre del Pokémon; Gemini solo recibe la pregunta si existe.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f4' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 32 },
  header: { backgroundColor: '#163c33', borderRadius: 22, padding: 22, marginBottom: 20 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ffffff20', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  eyebrow: { color: '#a7e8cd', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: '#fffdf6', fontSize: 28, lineHeight: 34, fontWeight: '800', marginTop: 8 },
  subtitle: { color: '#d0e1d8', fontSize: 14, lineHeight: 21, marginTop: 8 },
  composer: { padding: 18, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5ebe6' },
  label: { color: '#19352d', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  input: { minHeight: 120, borderRadius: 12, borderWidth: 1, borderColor: '#dce5df', backgroundColor: '#fbfcfb', padding: 13, color: '#20372f', fontSize: 15, lineHeight: 22 },
  counter: { color: '#84928a', textAlign: 'right', fontSize: 12, marginTop: 6 },
  button: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#18745b', borderRadius: 12, marginTop: 13, paddingHorizontal: 16 },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#fff0ee', borderRadius: 12, padding: 13, marginTop: 16 },
  errorText: { flex: 1, color: '#8c2e25', fontSize: 14, lineHeight: 20 },
  answerCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#dce9e1', padding: 18, marginTop: 18 },
  answerHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  answerTitle: { color: '#19352d', fontWeight: '800', fontSize: 16 },
  answerText: { color: '#34453c', fontSize: 15, lineHeight: 23 },
  sourceList: { borderTopWidth: 1, borderTopColor: '#e5ebe6', marginTop: 15, paddingTop: 12, gap: 5 },
  sourceLabel: { color: '#18745b', fontSize: 12, fontWeight: '800', marginBottom: 2 },
  sourceText: { color: '#63746b', fontSize: 12, lineHeight: 18 },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 18, paddingHorizontal: 3 },
  hintText: { flex: 1, color: '#63746b', fontSize: 13, lineHeight: 19 },
});