import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { usePokemon, type Pokemon } from '@/context/PokemonContext';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

const API_BASE_URL = (() => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return `http://${hostUri.split(':')[0]}:3000`;
  }

  return 'http://localhost:3000';
})();

export default function HomeScreen() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Usamos el estado del Contexto Global
  const { pokemon, setPokemon } = usePokemon();

  const consultarPokemon = async () => {
    const nombre = text.trim().toLowerCase();

    if (!nombre) {
      setError('Escribe el nombre de un Pokémon.');
      return;
    }

    setLoading(true);
    setError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const respuesta = await fetch(
        `${API_BASE_URL}/api/pokemon/${encodeURIComponent(nombre)}`,
        { signal: controller.signal }
      );

      if (!respuesta.ok) {
        throw new Error('No se pudo consultar el Pokémon.');
      }

      const datos: Pokemon = await respuesta.json();
      // Guardamos exitosamente la respuesta en el Contexto
      setPokemon(datos);
    } catch {
      setError('No se pudo encontrar ese Pokémon. Revisa el nombre e inténtalo otra vez.');
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

const spriteUrl =
  pokemon?.sprites?.other?.['official-artwork']?.front_default ??
  pokemon?.sprites?.front_default ??
  undefined;


const spriteUrl2 =
pokemon?.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_shiny ??
pokemon?.sprites?.front_default ??
undefined;

  const spriteUrl3 =
  pokemon?.sprites?.versions?.['generation-viii']?.['brilliant-diamond-shining-pearl']?.front_default ??
  pokemon?.sprites?.front_default ??
  undefined;

    const spriteUrl4 =
    pokemon?.sprites?.versions?.['generation-ii']?.['crystal']?.animated?.front_default ??
    pokemon?.sprites?.front_default ??
    undefined;

  const spriteUrl5 =
  pokemon?.sprites?.versions?.['generation-v']?.['icons']?.animated?.front_default ??
  pokemon?.sprites?.front_default ??
  undefined;






    
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#2085b7', dark: '#116581' }}
      headerImage={
        <Image
          source={require('@/assets/images/pokemon.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">PokeAPI!</ThemedText>
        <HelloWave />
      </ThemedView>

      <ThemedView style={styles.inputContainer}>
        <ThemedView style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            style={styles.input}
            placeholder="Buscar Pokémon..."
            placeholderTextColor="#8a8a8a"
            autoCapitalize="none"
            onSubmitEditing={consultarPokemon}
          />
          <Pressable
            style={[styles.queryButton, loading && styles.queryButtonDisabled]}
            onPress={consultarPokemon}
            disabled={loading}>
            <ThemedText style={styles.queryButtonText}>
              {loading ? 'Buscando...' : 'Consultar'}
            </ThemedText>
          </Pressable>
        </ThemedView>

        {!!error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

        {pokemon && (
          <ThemedView style={styles.resultContainer}>
            {spriteUrl && (
              <Image
                source={{ uri: spriteUrl2 }}
                style={styles.pokemonImage}
                contentFit="contain"
                autoplay
              />
            )}
            <ThemedText type="subtitle">
              {pokemon.name ? pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1) : ''}
            </ThemedText>
            <ThemedText>
              Tipos: {pokemon.types?.map(({ type }) => type.name).join(', ')}
            </ThemedText>
            <ThemedView style={styles.spriteGrid}>
              <Image source={{ uri: spriteUrl }} style={styles.spriteImage} contentFit="contain" />
              <Image source={{ uri: spriteUrl3 }} style={styles.spriteImage} contentFit="contain" />
              <Image source={{ uri: spriteUrl4 }} style={styles.spriteImage} contentFit="contain" />
              <Image source={{ uri: spriteUrl5 }} style={styles.spriteImage} contentFit="contain" />
            </ThemedView>

          </ThemedView>
        )}
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer:
  { flexDirection: 'row', 
    alignItems: 'center', gap: 8 
  },
  inputContainer: { 
    gap: 8, 
    marginBottom: 16
   },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#8a8a8a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#000' },
  queryButton: { backgroundColor: '#2f6fed', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  queryButtonText: { color: '#ffffff', fontWeight: '600' },
  queryButtonDisabled: { opacity: 0.6 },
  errorText: { color: '#c62828' },
  resultContainer: {
     alignItems: 'center',
      gap: 4,
       marginTop: 8 
      },
  spriteGrid: {
    width: '50%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  spriteImage: { width: '45%', aspectRatio: 1 },
  pokemonImage: { height: 180, width: 180  },
  reactLogo: { height: 178, width: 490, bottom: 0, left: 0, },
});