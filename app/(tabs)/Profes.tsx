import { useProfesores, type Profesor } from '@/context/ProfesoresContext';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    FlatList,
    Linking,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

function openExternalUrl(url: string) {
  if (!/^https?:\/\//i.test(url)) return;
  void Linking.openURL(url).catch(() => Alert.alert('No se pudo abrir el enlace.'));
}

function getProfesorKey(item: Profesor) {
  return typeof item._id === 'object' && item._id?.$oid
    ? item._id.$oid
    : String(item._id || item.id);
}

export default function Profes() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedProfesorId, setExpandedProfesorId] = useState<string | null>(null);
  const { profesores, loading, error, fetchProfesores } = useProfesores();

  const submitSearch = () => {
    setHasSearched(true);
    void fetchProfesores(search);
  };

  const renderProfesorItem = ({ item }: { item: Profesor }) => {
    const profesorKey = getProfesorKey(item);
    const isExpanded = expandedProfesorId === profesorKey;
    const hasAdditionalInfo = Boolean(
      item.about || item.experience?.length || item.education?.length || item.skills?.length ||
      item.contact?.linkedin || item.contact?.website
    );

    return (
      <View style={styles.card}>
        <View style={styles.profileRow}>
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={styles.profileImage}
              contentFit="cover"
              transition={150}
              accessibilityLabel={`Foto de ${item.name} ${item.apellido}`}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <View style={styles.headerRow}>
              <Text style={styles.name}>
                {item.name} {item.apellido}
              </Text>
              <Text style={styles.badge}>ID: {item.id}</Text>
            </View>
            {item.headline && <Text style={styles.headline}>{item.headline}</Text>}
            <Text style={styles.profession}>{item.Profesion}</Text>
          </View>
        </View>

        {item.location && (
          <View style={styles.locationContainer}>
            <Text style={styles.locationLabel}>Ubicación:</Text>
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
        )}
        {isExpanded && (
          <>
            {item.about && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Acerca de</Text>
                <Text style={styles.detailText}>{item.about}</Text>
              </View>
            )}

            {!!item.experience?.length && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Experiencia</Text>
                {item.experience.map((experience) => (
                  <View key={`${experience.company}-${experience.role}-${experience.period}`} style={styles.detailItem}>
                    <Text style={styles.detailHeading}>{experience.role}</Text>
                    <Text style={styles.detailMeta}>{experience.company} · {experience.period}</Text>
                    {experience.description && <Text style={styles.detailText}>{experience.description}</Text>}
                  </View>
                ))}
              </View>
            )}

            {!!item.education?.length && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Educación</Text>
                {item.education.map((education) => (
                  <View key={`${education.institution}-${education.degree}-${education.year}`} style={styles.detailItem}>
                    <Text style={styles.detailHeading}>{education.degree}</Text>
                    <Text style={styles.detailMeta}>{education.institution} · {education.year}</Text>
                  </View>
                ))}
              </View>
            )}

            {!!item.skills?.length && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Habilidades</Text>
                <Text style={styles.detailText}>{item.skills.join(' · ')}</Text>
              </View>
            )}

            {(item.contact?.linkedin || item.contact?.website) && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Contacto</Text>
                {item.contact.linkedin && (
                  <Text
                    accessibilityRole="link"
                    onPress={() => openExternalUrl(item.contact!.linkedin!)}
                    style={styles.contactLink}
                  >
                    LinkedIn
                  </Text>
                )}
                {item.contact.website && (
                  <Text
                    accessibilityRole="link"
                    onPress={() => openExternalUrl(item.contact!.website!)}
                    style={styles.contactLink}
                  >
                    Sitio web
                  </Text>
                )}
              </View>
            )}
          </>
        )}

        {hasAdditionalInfo && (
          <TouchableOpacity
            onPress={() => setExpandedProfesorId(isExpanded ? null : profesorKey)}
            style={styles.expandButton}
            accessibilityRole="button"
            accessibilityState={{ expanded: isExpanded }}
          >
            <Text style={styles.expandButtonText}>{isExpanded ? 'Ver menos' : 'Ver más...'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Directorio de Profesores</Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          style={styles.homeButton}
          accessibilityRole="button"
          accessibilityLabel="Volver al inicio"
        >
          <Text style={styles.homeButtonText}>Inicio</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={submitSearch}
          placeholder="ID, nombre o profesión"
          returnKeyType="search"
          style={styles.searchInput}
          accessibilityLabel="Buscar profesores por ID, nombre, apellido o profesión"
        />
        <TouchableOpacity
          style={[styles.searchButton, loading && styles.searchButtonDisabled]}
          onPress={submitSearch}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={styles.searchButtonText}>{loading ? 'Buscando...' : 'Buscar'}</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <FlatList
        data={profesores}
        keyExtractor={getProfesorKey}
        renderItem={renderProfesorItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={submitSearch} colors={['#0066cc']} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {hasSearched ? 'No se encontraron profesores.' : 'Busca por ID, nombre, apellido o profesión.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    paddingTop: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  homeButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#e4ebf2',
    paddingHorizontal: 12,
  },
  homeButtonText: {
    color: '#1d4e89',
    fontWeight: '600',
  },
  expandButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 2,
  },
  expandButtonText: { color: '#075eaa', fontSize: 14, fontWeight: '600' },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 46,
    borderWidth: 1,
    borderColor: '#bdc7d1',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  searchButton: {
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0066cc',
    paddingHorizontal: 14,
  },
  searchButtonDisabled: { opacity: 0.6 },
  searchButtonText: { color: '#fff', fontWeight: '600' },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#e4ebf2',
  },
  imagePlaceholder: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#e4ebf2',
  },
  imagePlaceholderText: { color: '#1d4e89', fontSize: 26, fontWeight: '600' },
  profileInfo: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    textTransform: 'capitalize',
  },
  badge: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#eef2f5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  profession: {
    fontSize: 14,
    color: '#0066cc',
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  locationContainer: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  locationLabel: {
    fontSize: 12,
    color: '#888',
  },
  locationText: {
    fontSize: 14,
    color: '#444',
    fontWeight: '500',
  },
  headline: {
    color: '#45566a',
    fontSize: 14,
    marginBottom: 4,
  },
  detailSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 6,
  },
  sectionTitle: {
    color: '#26384a',
    fontSize: 14,
    fontWeight: '700',
  },
  detailItem: { gap: 2, marginTop: 4 },
  detailHeading: { color: '#333', fontSize: 14, fontWeight: '600' },
  detailMeta: { color: '#66727e', fontSize: 12 },
  detailText: { color: '#444', fontSize: 13, lineHeight: 19 },
  contactLink: { color: '#075eaa', fontSize: 14, textDecorationLine: 'underline' },
  loadingText: {
    marginTop: 12,
    color: '#555',
    fontSize: 15,
  },
  errorText: {
    color: '#d9534f',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#777',
    marginTop: 32,
    fontSize: 15,
  },
}); 