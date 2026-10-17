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

const configuredAiApiUrl = process.env.EXPO_PUBLIC_AI_API_URL?.trim();
const AI_API_URL = (
  configuredAiApiUrl ||
  (__DEV__ ? `http://${getLocalApiHost()}:3000` : undefined)
)?.replace(/\/$/, '');

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
      setError('Falta configurar EXPO_PUBLIC_AI_API_URL en el archivo .env.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setError('');
    setAnswer('');
    setSources([]);

    try {
      const response = await fetch(`${AI_API_URL}/api/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: cleanQuestion }),
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
          Pregunta sobre Pokémon, Rick y Morty o el directorio de profesores.
        </Text>
      </View>

      <View style={styles.composer}>
        <Text style={styles.label}>Tu pregunta</Text>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          style={styles.input}
          placeholder="Ej.: ¿Qué Pokémon tiene tipo fuego?"
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
            El asistente responderá usando la información disponible en los catálogos de la app.
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
