import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const destinations = [
  {
    title: 'PokéAPI',
    subtitle: 'Busca tu próximo compañero',
    image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
    route: '/(tabs)',
    icon: 'catching-pokemon' as const,
    color: '#c9eadb',
  },
  {
    title: 'Rick y Morty',
    subtitle: 'Encuentra personajes del multiverso',
    image: 'https://static.posters.cz/image/750/40514.jpg',
    route: '/RickyMorty',
    icon: 'groups' as const,
    color: '#e2edc9',
  },
  {
    title: 'Profesores',
    subtitle: 'Consulta el directorio académico Uninpahu',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=80',
    route: '/Profes',
    icon: 'school' as const,
    color: '#f3e2c9',
  },
] as const;

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>



      <View style={styles.grid}>
        {destinations.map((destination) => (
          <Pressable
            key={destination.title}
            onPress={() => router.push(destination.route)}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ${destination.title}`}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={[styles.imageContainer, { backgroundColor: destination.color }]}>
              <Image
                source={{ uri: destination.image }}
                style={styles.cardImage}
                contentFit="cover"
                transition={180}
                accessibilityLabel={destination.title}
              />
              <View style={styles.iconBadge}>
                <MaterialIcons name={destination.icon} size={19} color="#15332b" />
              </View>
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{destination.title}</Text>
              <Text style={styles.cardSubtitle}>{destination.subtitle}</Text>
              <View style={styles.openRow}>
                <Text style={styles.openText}>Explorar</Text>
                <MaterialIcons name="arrow-forward" size={16} color="#18745b" />
              </View>
            </View>
          </Pressable>
        ))}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f4' },
  content: { paddingHorizontal: 18, paddingTop: 58, paddingBottom: 30 },
  heading: {
    backgroundColor: '#163c33',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 27,
    overflow: 'hidden',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brand: { color: '#a7e8cd', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#fffdf6', fontSize: 34, lineHeight: 39, fontWeight: '800', marginTop: 17 },
  subtitle: { color: '#d0e1d8', fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 280 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 13,
  },
  sectionTitle: { color: '#19352d', fontSize: 20, fontWeight: '800' },
  sectionCaption: { color: '#78877f', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 13 },
  card: {
    width: '48.3%',
    overflow: 'hidden',
    borderRadius: 15,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5ebe6',
  },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  imageContainer: { height: 120, position: 'relative', overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%' },
  iconBadge: {
    position: 'absolute',
    right: 9,
    bottom: 9,
    width: 31,
    height: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  cardCopy: { paddingHorizontal: 11, paddingTop: 11, paddingBottom: 12 },
  cardTitle: { color: '#20372f', fontSize: 14, fontWeight: '800' },
  cardSubtitle: { color: '#748078', fontSize: 11, lineHeight: 15, marginTop: 4, minHeight: 30 },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 9 },
  openText: { color: '#18745b', fontSize: 11, fontWeight: '700' },
  footer: { color: '#829088', textAlign: 'center', fontSize: 12, marginTop: 24 },
});
