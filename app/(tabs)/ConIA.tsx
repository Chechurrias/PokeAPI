import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const POKEMON_API_BASE_URL = 'https://pokeapi-zz36.onrender.com';
const AI_API_BASE_URL = 'https://pokeapi-ia.onrender.com';

type PokemonResponse = {
  name?: string;
  error?: string;
};

type AskResponse = {
  answer?: string;
  error?: string;
};

export type SyncIAs = 'GEMINI' | 'Groq' | 'OpenRouter';

export const SYNC_IA_OPTIONS: SyncIAs[] = [
  'GEMINI',
  'Groq',
  'OpenRouter',
];

function normalizePokemonName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}

export default function ConIAScreen() {
  const [question, setQuestion] = useState('');
  const [pokemonName, setPokemonName] = useState('');
  const [validatedPokemon, setValidatedPokemon] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [selectedAI, setSelectedAI] = useState<SyncIAs>('GEMINI');
  const [answerProvider, setAnswerProvider] = useState<SyncIAs | null>(
    null
  );

  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(2); // 2 segundos por defecto
  const TIMEOUT_OPTIONS = [2, 3, 4]; // Opciones permitidas en segundos

  const clearAnswer = () => {
    setAnswer('');
    setAnswerProvider(null);
    setError('');
  };

  const validatePokemon = async (
    cleanPokemonName: string
  ): Promise<string> => {
    const checkResponse = await fetch(
      `${POKEMON_API_BASE_URL}/api/pokemon/${encodeURIComponent(
        cleanPokemonName
      )}`
    );

    const data = (await checkResponse.json().catch(() => null)) as
      | PokemonResponse
      | null;

    if (checkResponse.status === 404) {
      throw new Error(
        'El Pokémon no existe en la base de datos de la aplicación.'
      );
    }

    if (!checkResponse.ok) {
      throw new Error(
        typeof data?.error === 'string'
          ? data.error
          : 'Error al validar el Pokémon en el servidor.'
      );
    }

    if (typeof data?.name !== 'string' || !data.name.trim()) {
      throw new Error(
        'El servicio de datos no devolvió un Pokémon válido.'
      );
    }

    return data.name.trim();
  };

const askAI = async () => {
    if (loading) {
      return;
    }

    const cleanQuestion = question.trim();
    const cleanPokemonName = normalizePokemonName(pokemonName);
    const requestedProvider = selectedAI;

    clearAnswer();
    setValidatedPokemon('');

    if (!cleanPokemonName) {
      setError('Escribe el nombre del Pokémon que quieres consultar.');
      return;
    }

    if (!cleanQuestion) {
      setError('Escribe una pregunta sobre Pokémon.');
      return;
    }

    if (cleanQuestion.length > 500) {
      setError('La pregunta no puede superar los 500 caracteres.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    let stage: 'pokemon' | 'ai' = 'pokemon';

    try {
      // 1. Primero se valida el Pokémon en la base de datos
      const validatedName = await validatePokemon(cleanPokemonName);
      setValidatedPokemon(validatedName);

      stage = 'ai';

      // 2. Consulta de IA sin cancelaciones automáticas en el cliente (móvil y web se comportarán igual)
      const aiResponse = await fetch(
        `${AI_API_BASE_URL}/api/ai/ask`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: cleanQuestion,
            pokemonName: validatedName,
            aiProvider: requestedProvider,
            timeoutSeconds: timeoutSeconds,
          }),
        }
      );

      const data = (await aiResponse.json().catch(() => null)) as
        | AskResponse
        | null;

      if (!aiResponse.ok) {
        const fallbackError =
          aiResponse.status === 429
            ? 'El servicio de IA alcanzó su límite de solicitudes o cuota.'
            : 'No se pudo consultar el asistente.';

        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : fallbackError
        );
      }

      if (
        typeof data?.answer !== 'string' ||
        !data.answer.trim()
      ) {
        throw new Error(
          'El servidor no devolvió una respuesta válida.'
        );
      }

      setAnswer(data.answer.trim());
      setAnswerProvider(requestedProvider);
    } catch (requestError) {
      console.error('[ConIA] Error:', {
        stage,
        error: requestError,
      });

      const isNetworkError =
        requestError instanceof TypeError &&
        /network request failed|failed to fetch|networkerror/i.test(
          requestError.message
        );

      if (isNetworkError) {
        setError(
          stage === 'pokemon'
            ? 'No se pudo conectar con el servicio de Pokémon. Revisa tu conexión e inténtalo nuevamente.'
            : 'No se pudo conectar con el servicio de IA. Revisa tu conexión e inténtalo nuevamente.'
        );
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Ocurrió un error al procesar tu solicitud.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/tittle_pokemon_IA.png')}
          style={styles.headerBannerImage}
          resizeMode="cover"
          accessibilityLabel="Pokémon IA Banner"
        />
      </View>

      <View style={styles.composer}>
        {/* Selector de IA */}
        <View style={styles.syncIntervalContainer}>
          <Text style={styles.syncIntervalLabel}>
            ¿Cuál IA quieres usar?
          </Text>

          <View style={styles.syncIntervalOptions}>
            {SYNC_IA_OPTIONS.map((aiOption) => (
              <TouchableOpacity
                key={aiOption}
                onPress={() => {
                  setSelectedAI(aiOption);
                  clearAnswer();
                }}
                disabled={loading}
                accessibilityRole="button"
                accessibilityState={{
                  selected: selectedAI === aiOption,
                  disabled: loading,
                }}
                accessibilityLabel={`Usar inteligencia artificial ${aiOption}`}
                style={[
                  styles.syncIntervalButton,
                  selectedAI === aiOption &&
                    styles.syncIntervalButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.syncIntervalButtonText,
                    selectedAI === aiOption &&
                      styles.syncIntervalButtonTextSelected,
                  ]}
                >
                  {aiOption}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Selector de Timeout / Tiempo de Espera */}
        <View style={[styles.syncIntervalContainer, { marginTop: 12 }]}>
          <Text style={styles.syncIntervalLabel}>
            Tiempo máximo de espera (Timeout):
          </Text>

          <View style={styles.syncIntervalOptions}>
            {TIMEOUT_OPTIONS.map((seconds) => (
              <TouchableOpacity
                key={seconds}
                onPress={() => setTimeoutSeconds(seconds)}
                disabled={loading}
                accessibilityRole="button"
                accessibilityState={{
                  selected: timeoutSeconds === seconds,
                  disabled: loading,
                }}
                accessibilityLabel={`Timeout de ${seconds} segundos`}
                style={[
                  styles.syncIntervalButton,
                  timeoutSeconds === seconds &&
                    styles.syncIntervalButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.syncIntervalButtonText,
                    timeoutSeconds === seconds &&
                      styles.syncIntervalButtonTextSelected,
                  ]}
                >
                  {seconds}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.label}>Nombre del Pokémon</Text>

        <TextInput
          value={pokemonName}
          onChangeText={(value) => {
            setPokemonName(value);
            setValidatedPokemon('');
            clearAnswer();
          }}
          style={styles.shortInput}
          placeholder="Ej.: pikachu"
          placeholderTextColor="#84928a"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={80}
          editable={!loading}
        />

        {!!validatedPokemon && (
          <Text style={styles.validatedText}>
            ✓ Pokémon válido: {validatedPokemon}
          </Text>
        )}

        <Text style={styles.label}>Tu pregunta</Text>

        <TextInput
          value={question}
          onChangeText={(value) => {
            setQuestion(value);
            clearAnswer();
          }}
          style={styles.input}
          placeholder="Ej.: ¿Cuáles son sus estadísticas principales?"
          placeholderTextColor="#84928a"
          multiline
          maxLength={500}
          textAlignVertical="top"
          editable={!loading}
        />

        <Text style={styles.counter}>
          {question.length}/500
        </Text>

        <TouchableOpacity
          onPress={askAI}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={`Consultar con ${selectedAI}`}
          accessibilityState={{
            disabled: loading,
            busy: loading,
          }}
          style={[
            styles.button,
            loading && styles.buttonDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>
                Consultar con {selectedAI}
              </Text>

              <MaterialIcons
                name="arrow-forward"
                size={19}
                color="#fff"
              />
            </>
          )}
        </TouchableOpacity>
      </View>

      {!!error && (
        <View
          style={styles.errorBox}
          accessibilityRole="alert"
        >
          <MaterialIcons
            name="error-outline"
            size={20}
            color="#a5372b"
          />

          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!!answer && (
        <View style={styles.answerCard}>
          <View style={styles.answerHeading}>
            <MaterialIcons
              name="auto-awesome"
              size={20}
              color="#18745b"
            />

            <Text style={styles.answerTitle}>
              Respuesta ({answerProvider ?? 'IA'})
            </Text>
          </View>

          <Text style={styles.answerText}>{answer}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f4',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
  },
  header: {
    backgroundColor: '#163c33',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 20,
  },
  headerBannerImage: {
    width: '100%',
    height: 140,
  },
  composer: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5ebe6',
  },
  label: {
    color: '#19352d',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 14,
  },
  shortInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce5df',
    backgroundColor: '#fbfcfb',
    paddingHorizontal: 13,
    color: '#20372f',
    fontSize: 15,
  },
  input: {
    minHeight: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce5df',
    backgroundColor: '#fbfcfb',
    padding: 13,
    color: '#20372f',
    fontSize: 15,
    lineHeight: 22,
  },
  counter: {
    color: '#84928a',
    textAlign: 'right',
    fontSize: 12,
    marginTop: 6,
  },
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#18745b',
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  validatedText: {
    color: '#18745b',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: '#fff0ee',
    borderRadius: 12,
    padding: 13,
    marginTop: 16,
  },
  errorText: {
    flex: 1,
    color: '#8c2e25',
    fontSize: 14,
    lineHeight: 20,
  },
  answerCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dce9e1',
    padding: 18,
    marginTop: 18,
  },
  answerHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  answerTitle: {
    color: '#19352d',
    fontWeight: '800',
    fontSize: 16,
  },
  answerText: {
    color: '#34453c',
    fontSize: 15,
    lineHeight: 23,
  },
  syncIntervalContainer: {
    marginBottom: 10,
  },
  syncIntervalLabel: {
    color: '#19352d',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  syncIntervalOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  syncIntervalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce5df',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fbfcfb',
  },
  syncIntervalButtonSelected: {
    backgroundColor: '#18745b',
    borderColor: '#18745b',
  },
  syncIntervalButtonText: {
    color: '#34453c',
    fontWeight: '600',
    fontSize: 14,
  },
  syncIntervalButtonTextSelected: {
    color: '#fff',
  },
});