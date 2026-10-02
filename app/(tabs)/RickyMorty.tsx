import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useRickContext } from '@/context/RickContext';

export default function RickyMortyScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { character, loading, error, searchCharacter } = useRickContext();

  const search = () => void searchCharacter(query);
  const renderResult = () => {
    if (loading) {
      return (
        <View style={styles.feedback}>
          <ActivityIndicator size="large" color="#547b31" />
          <Text style={styles.feedbackText}>Consultando...</Text>
        </View>
      );
    }

    if (!character) {
      return (
        <View style={styles.feedback}>
          <Text style={styles.feedbackText}>{error || 'El personaje consultado aparecerá aquí.'}</Text>
        </View>
      );
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver ficha de ${character.name}`}
        onPress={() => router.push('/InfoRick')}
        style={({ pressed }) => [styles.characterCard, pressed && styles.cardPressed]}>
        <Image source={{ uri: character.image }} style={styles.characterImage} contentFit="cover" transition={180} />
        <View style={styles.cardContent}>
          <Text style={styles.characterName}>{character.name}</Text>
          <Text style={styles.characterMeta}>{character.status} · {character.species}</Text>
          <Text style={styles.detailPrompt}>Ver información completa</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>DIMENSION C-137</Text>
        <Text style={styles.title}>Rick y Morty</Text>
        <Text style={styles.subtitle}>Busca un personaje por nombre completo o por ID.</Text>
        <Image
          source={require('@/assets/images/images.jpg')}
          style={styles.headerImage}
          contentFit="cover"
          accessibilityLabel="Rick y Morty"
        />
        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel="Buscar personaje por nombre o ID"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            placeholder="Ej. Rick Sanchez o 1"
            placeholderTextColor="#747b70"
            returnKeyType="search"
            autoCapitalize="words"
            style={styles.searchInput}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Consultar personaje" onPress={search} style={styles.searchButton}>
            <MaterialIcons name="search" size={23} color="#17221a" />
          </Pressable>
        </View>

        {renderResult()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f3e9' },
  content: { flex: 1, paddingHorizontal: 18, paddingTop: 58, paddingBottom: 28 },
  eyebrow: { color: '#587d37', fontSize: 11, fontWeight: '400', letterSpacing: 1.5 },
  title: { color: '#17221a', fontSize: 32, fontWeight: '500', marginTop: 5 },
  subtitle: { color: '#596258', fontSize: 15, marginTop: 4 },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 20 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c9d0bf',
    backgroundColor: '#fffefa',
    color: '#17221a',
    paddingHorizontal: 14,
    fontSize: 15,
  },
  headerImage: { width: '100%', aspectRatio: 490 / 178, borderRadius: 8, marginTop: 14 },
  searchButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#b5d94a',
  },
  feedback: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 18 },
  feedbackText: { color: '#596258', fontSize: 15, textAlign: 'center' },
  characterCard: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#fffefa',
    borderWidth: 1,
    borderColor: '#e0e4d8',
  },
  cardPressed: { opacity: 0.82 },
  characterImage: { width: '100%', aspectRatio: 1.15, backgroundColor: '#dce5d0' },
  cardContent: { gap: 7, padding: 14 },
  characterName: { color: '#17221a', fontSize: 20, fontWeight: '500' },
  characterMeta: { color: '#596258', fontSize: 14 },
  detailPrompt: { color: '#587d37', fontSize: 13, fontWeight: '500', marginTop: 5 },
});
