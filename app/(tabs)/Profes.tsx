import { useProfesores, type Profesor } from '@/context/ProfesoresContext';
import { useState } from 'react';
import {
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export default function Profes() {
  const [search, setSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const { profesores, loading, error, fetchProfesores } = useProfesores();

  const submitSearch = () => {
    setHasSearched(true);
    void fetchProfesores(search);
  };

  const renderProfesorItem = ({ item }: { item: Profesor }) => {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.name}>
            {item.name} {item.apellido}
          </Text>
          <Text style={styles.badge}>ID: {item.id}</Text>
        </View>

        <Text style={styles.profession}>{item.Profesion}</Text>

        {item.location && (
          <View style={styles.locationContainer}>
            <Text style={styles.locationLabel}>Ubicación:</Text>
            <Text style={styles.locationText}>{item.location.name}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Directorio de Profesores</Text>
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
        keyExtractor={(item) =>
          typeof item._id === 'object' && item._id?.$oid
            ? item._id.$oid
            : String(item.id)
        }
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
    marginHorizontal: 16,
    marginBottom: 12,
  },
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
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