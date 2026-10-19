import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// URLs públicas con HTTPS (compatibles al 100% con iOS y Android)
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

function normalizePokemonName(value: string) {
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

  const validatePokemon = async (cleanPokemonName: string) => {
    try {
      const checkResponse = await fetch(
        `${POKEMON_API_BASE_URL}/api/pokemon/${encodeURIComponent(cleanPokemonName)}`
      );

      const data = (await checkResponse.json().catch(() => null)) as PokemonResponse | null;

      if (checkResponse.status === 404) {
        throw new Error('El Pokémon no existe en la base de datos de la aplicación.');
      }

      if (!checkResponse.ok) {
        throw new Error(data?.error ?? 'Error al validar el Pokémon en el servidor.');
      }

      return data?.name ?? cleanPokemonName;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('Network request failed')) {
        throw new Error('No se pudo conectar con el servidor principal. El servidor en Render puede estar despertando (espera 30 segundos).');
      }
      throw err;
    }
  };

  const askAI = async () => {
    const cleanQuestion = question.trim();
    const cleanPokemonName = normalizePokemonName(pokemonName);

    if (!cleanPokemonName) {
      setError('Escribe el nombre del Pokémon que quieres consultar.');
      return;
    }

    if (!cleanQuestion) {
      setError('Escribe una pregunta sobre Pokémon.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setError('');
    setAnswer('');

    try {
      // 1. Validar primero contra la base de datos
      const validatedName = await validatePokemon(cleanPokemonName);
      setValidatedPokemon(validatedName);

      // 2. Consultar al servicio de IA en Render
      const aiResponse = await fetch(`${AI_API_BASE_URL}/api/ai/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: cleanQuestion,
          pokemonName: validatedName,
        }),
      });

      const data = (await aiResponse.json().catch(() => null)) as AskResponse | null;

      if (!aiResponse.ok) {
        throw new Error(data?.error ?? 'No se pudo consultar el asistente.');
      }

      if (!data?.answer) {
        throw new Error('El servidor no devolvió una respuesta.');
      }

      setAnswer(data.answer);
    } catch (requestError) {
      setValidatedPokemon('');
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Ocurrió un error al procesar tu solicitud.'
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
          Primero se valida el Pokémon en la base de datos. Si existe, se envía tu pregunta al asistente.
        </Text>
      </View>

      <View style={styles.composer}>
        <Text style={styles.label}>Nombre del Pokémon</Text>

        <TextInput
          value={pokemonName}
          onChangeText={(value) => {
            setPokemonName(value);
            setValidatedPokemon('');
          }}
          style={styles.shortInput}
          placeholder="Ej.: pikachu"
          placeholderTextColor="#84928a"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        <Text style={styles.label}>Tu pregunta</Text>

        <TextInput
          value={question}
          onChangeText={setQuestion}
          style={styles.input}
          placeholder="Ej.: ¿Cuál es el número de Pikachu?"
          placeholderTextColor="#84928a"
          multiline
          maxLength={500}
          textAlignVertical="top"
          editable={!loading}
        />

        <Text style={styles.counter}>{question.length}/500</Text>

        <Pressable
          accessibilityRole="button"
          onPress={askAI}
          disabled={loading}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            loading && styles.buttonDisabled,
          ]}
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

        {!!validatedPokemon && (
          <Text style={styles.validatedText}>
            Pokémon validado: {validatedPokemon}
          </Text>
        )}
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
            <Text style={styles.answerTitle}>Respuesta de Gemini</Text>
          </View>

          <Text style={styles.answerText}>{answer}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f4' },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
  },
  header: {
    backgroundColor: '#163c33',
    borderRadius: 22,
    padding: 22,
    marginBottom: 20,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  eyebrow: {
    color: '#a7e8cd',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  title: {
    color: '#fffdf6',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    marginTop: 8,
  },
  subtitle: {
    color: '#d0e1d8',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
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
  },
  shortInput: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce5df',
    backgroundColor: '#fbfcfb',
    padding: 13,
    color: '#20372f',
    fontSize: 15,
    marginBottom: 16,
  },
  input: {
    minHeight: 120,
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
    marginTop: 13,
    paddingHorizontal: 16,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  validatedText: {
    color: '#18745b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
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
});