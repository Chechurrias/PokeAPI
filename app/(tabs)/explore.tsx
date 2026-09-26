import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { usePokemon } from '@/context/PokemonContext';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

export default function TabTwoScreen() {
  const { pokemon } = usePokemon();

  const spriteUrl =
    pokemon?.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_shiny ??
    pokemon?.sprites?.front_shiny ??
    undefined;

  return (
    <ParallaxScrollView
    
    headerImage={
        <Image
          source={require('@/assets/images/pokemon.png')}
          style={styles.headerImage}
        />
      }
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#f6f9f9' }}>
      
      <ThemedText type="title">Explora Pokémon</ThemedText>
      <ThemedText>Información detallada de tus Pokémon </ThemedText>

      {!pokemon ? (
        <ThemedView style={styles.stepContainer}>
          <ThemedText type="subtitle" style={styles.emptyText}>
            No has consultado ningún Pokémon aún.
          </ThemedText>
          <ThemedText style={{ color: '#da2424' }}>
            Ve a la primera pestaña y busca un Pokémon para ver sus detalles aquí.
          </ThemedText>
        </ThemedView>
      ) : (
        <>
          <ThemedView style={styles.cardContainer}>
            {spriteUrl && (
              <Image
                source={{ uri: spriteUrl }}
                style={styles.pokemonImage}
                contentFit="contain"
                autoplay
              />
            )}
            <ThemedText type="subtitle">
              #{pokemon.id} {pokemon.name.toUpperCase()}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.stepContainer}>
            <ThemedText type="subtitle">Altura: {pokemon.height / 10} m</ThemedText>
            <ThemedText type="subtitle">Peso: {pokemon.weight / 10} kg</ThemedText>
            <ThemedText type="subtitle">Tipos: {pokemon.types?.map(({ type }) => type.name).join(', ')}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.stepContainer}>
            <ThemedText type="subtitle">
              Habilidad 1: {pokemon.abilities[0]?.ability.name ?? 'N/A'} | Habilidad 2:{' '}
              {pokemon.abilities[1]?.ability.name ?? 'N/A'}
            </ThemedText>
            <ThemedText type="subtitle">
              Movimiento principal: {pokemon.moves[0]?.move.name ?? 'N/A'}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.stepContainer}>
            <ThemedText type="subtitle">
              Habilidad 3: {pokemon.abilities[2]?.ability.name ?? 'N/A'} | Habilidad 4:{' '}
              {pokemon.abilities[3]?.ability.name ?? 'N/A'}
            </ThemedText>
          </ThemedView>
        </>
      )}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    height: 178,
    width: 490,
    bottom: 0,
    left: 0,

  },
  stepContainer: {
    gap: 8,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1adad',
  },
  cardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pokemonImage: {
    width: 150,
    height: 150,
  },
  emptyText: {
    color: '#e53935',
  },
  }
);