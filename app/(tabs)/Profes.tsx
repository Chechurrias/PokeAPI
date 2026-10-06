import {
  useProfesores,
  type DatosProfesorEditables,
  type NuevoProfesor,
  type Profesor,
} from '@/context/ProfesoresContext';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

type ProfesorForm = {
  name: string;
  apellido: string;
  Profesion: string;
  headline: string;
  location: string;
  image: string;
  about: string;
};

const emptyProfesorForm: ProfesorForm = {
  name: '',
  apellido: '',
  Profesion: '',
  headline: '',
  location: '',
  image: '',
  about: '',
};

function openExternalUrl(url: string) {
  if (!/^https?:\/\//i.test(url)) return;
  void Linking.openURL(url).catch(() => Alert.alert('No se pudo abrir el enlace.'));
}

function getProfesorKey(item: Profesor) {
  if (typeof item._id === 'string') return item._id;
  return item._id.$oid ?? '';
}

export default function Profes() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedProfesorId, setExpandedProfesorId] = useState<string | null>(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingProfesorId, setDeletingProfesorId] = useState<string | null>(null);
  const [editingProfesor, setEditingProfesor] = useState<Profesor | null>(null);
  const [profesorForm, setProfesorForm] = useState<ProfesorForm>(emptyProfesorForm);
  const {
    profesores,
    loading,
    error,
    fetchProfesores,
    addProfesor,
    updateProfesor,
    deleteProfesor,
  } = useProfesores();

  const submitSearch = () => {
    setHasSearched(true);
    void fetchProfesores(search);
  };

  const updateProfesorForm = (field: keyof ProfesorForm, value: string) => {
    setProfesorForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const openEditForm = (profesor: Profesor) => {
    setEditingProfesor(profesor);
    setProfesorForm({
      name: profesor.name,
      apellido: profesor.apellido,
      Profesion: profesor.Profesion,
      headline: profesor.headline ?? '',
      location: profesor.location ?? '',
      image: profesor.image ?? '',
      about: profesor.about ?? '',
    });
  };

  const closeForm = () => {
    setIsCreateModalVisible(false);
    setEditingProfesor(null);
    setProfesorForm(emptyProfesorForm);
  };

  const submitProfesorForm = async () => {
    if (!profesorForm.name.trim() || !profesorForm.apellido.trim() || !profesorForm.Profesion.trim()) {
      Alert.alert('Faltan datos', 'Nombre, apellido y profesión son obligatorios.');
      return;
    }

    const editData: DatosProfesorEditables = {
      name: profesorForm.name.trim(),
      apellido: profesorForm.apellido.trim(),
      Profesion: profesorForm.Profesion.trim(),
      headline: profesorForm.headline.trim(),
      location: profesorForm.location.trim(),
      image: profesorForm.image.trim(),
      about: profesorForm.about.trim(),
    };

    setIsCreating(true);
    try {
      if (editingProfesor) {
        await updateProfesor(getProfesorKey(editingProfesor), editData);
        closeForm();
        Alert.alert('Profesor actualizado', 'La información se modificó correctamente.');
      } else {
        const newProfesor: NuevoProfesor = {
          name: editData.name,
          apellido: editData.apellido,
          Profesion: editData.Profesion,
          ...(editData.headline ? { headline: editData.headline } : {}),
          ...(editData.location ? { location: editData.location } : {}),
          ...(editData.image ? { image: editData.image } : {}),
          ...(editData.about ? { about: editData.about } : {}),
        };
        await addProfesor(newProfesor);
        closeForm();
        setSearch('');
        setHasSearched(true);
        setExpandedProfesorId(null);
        Alert.alert('Profesor creado', 'El profesor se agregó correctamente.');
      }
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : 'Ocurrió un error al guardar el profesor.';
      Alert.alert('No se pudo guardar el profesor', message);
    } finally {
      setIsCreating(false);
    }
  };

  const confirmDeleteProfesor = (profesor: Profesor) => {
    Alert.alert(
      'Eliminar profesor',
      `¿Seguro que deseas eliminar a ${profesor.name} ${profesor.apellido}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const profesorKey = getProfesorKey(profesor);
            setDeletingProfesorId(profesorKey);
            void deleteProfesor(profesorKey)
              .then(() => {
                if (expandedProfesorId === getProfesorKey(profesor)) {
                  setExpandedProfesorId(null);
                }
              })
              .catch((deleteError: unknown) => {
                const message =
                  deleteError instanceof Error
                    ? deleteError.message
                    : 'Ocurrió un error al eliminar el profesor.';
                Alert.alert('No se pudo eliminar el profesor', message);
              })
              .finally(() => setDeletingProfesorId(null));
          },
        },
      ]
    );
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
              <Text style={styles.badge}>ID: {profesorKey}</Text>
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

        <View style={styles.cardActions}>
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
          <TouchableOpacity
            onPress={() => openEditForm(item)}
            style={styles.editButton}
            accessibilityRole="button"
            accessibilityLabel={`Editar información de ${item.name} ${item.apellido}`}
          >
            <MaterialIcons name="edit" size={16} color="#075eaa" />
            <Text style={styles.editButtonText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => confirmDeleteProfesor(item)}
            style={[styles.deleteButton, deletingProfesorId === profesorKey && styles.searchButtonDisabled]}
            disabled={deletingProfesorId !== null}
            accessibilityRole="button"
            accessibilityLabel={`Eliminar a ${item.name} ${item.apellido}`}
          >
            <MaterialIcons name="delete-outline" size={17} color="#b42318" />
            <Text style={styles.deleteButtonText}>
              {deletingProfesorId === profesorKey ? 'Eliminando...' : 'Eliminar'}
            </Text>
          </TouchableOpacity>
        </View>
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
      <View style={styles.createActionRow}>
        <TouchableOpacity
          onPress={() => setIsCreateModalVisible(true)}
          style={styles.createButton}
          accessibilityRole="button"
          accessibilityLabel="Crear profesor"
        >
          <Text style={styles.createButtonText}>+ Crear profesor</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={submitSearch}
          placeholder="ObjectId, nombre o profesión (vacío: mostrar todos)"
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
            {hasSearched ? 'No se encontraron profesores.' : 'Busca un profesor o presiona Buscar para ver todos.'}
          </Text>
        }
      />

      <Modal
        visible={isCreateModalVisible || editingProfesor !== null}
        animationType="slide"
        transparent
        onRequestClose={closeForm}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProfesor ? 'Editar profesor' : 'Crear profesor'}</Text>
              <TouchableOpacity
                onPress={closeForm}
                style={styles.modalCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Cerrar formulario"
              >
                <Text style={styles.modalCloseText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formContent}
            >
              {!editingProfesor && (
                <>
                </>
              )}

              <Text style={styles.fieldLabel}>Nombre *</Text>
              <TextInput
                value={profesorForm.name}
                onChangeText={(value) => updateProfesorForm('name', value)}
                placeholder="Nombre"
                style={styles.formInput}
                accessibilityLabel="Nombre del profesor"
              />

              <Text style={styles.fieldLabel}>Apellido *</Text>
              <TextInput
                value={profesorForm.apellido}
                onChangeText={(value) => updateProfesorForm('apellido', value)}
                placeholder="Apellido"
                style={styles.formInput}
                accessibilityLabel="Apellido del profesor"
              />

              <Text style={styles.fieldLabel}>Profesión *</Text>
              <TextInput
                value={profesorForm.Profesion}
                onChangeText={(value) => updateProfesorForm('Profesion', value)}
                placeholder="Profesión"
                style={styles.formInput}
                accessibilityLabel="Profesión del profesor"
              />

              <Text style={styles.fieldLabel}>Titular</Text>
              <TextInput
                value={profesorForm.headline}
                onChangeText={(value) => updateProfesorForm('headline', value)}
                placeholder="Ej. Docente de matemáticas"
                style={styles.formInput}
                accessibilityLabel="Titular del perfil"
              />

              <Text style={styles.fieldLabel}>Ubicación</Text>
              <TextInput
                value={profesorForm.location}
                onChangeText={(value) => updateProfesorForm('location', value)}
                placeholder="Ciudad, país"
                style={styles.formInput}
                accessibilityLabel="Ubicación del profesor"
              />

              <Text style={styles.fieldLabel}>URL de imagen</Text>
              <TextInput
                value={profesorForm.image}
                onChangeText={(value) => updateProfesorForm('image', value)}
                placeholder="https://..."
                keyboardType="url"
                autoCapitalize="none"
                style={styles.formInput}
                accessibilityLabel="URL de imagen del profesor"
              />

              <Text style={styles.fieldLabel}>Acerca de</Text>
              <TextInput
                value={profesorForm.about}
                onChangeText={(value) => updateProfesorForm('about', value)}
                placeholder="Descripción del profesor"
                multiline
                textAlignVertical="top"
                style={[styles.formInput, styles.formInputMultiline]}
                accessibilityLabel="Descripción del profesor"
              />

              <TouchableOpacity
                onPress={() => void submitProfesorForm()}
                disabled={isCreating}
                style={[styles.submitButton, isCreating && styles.searchButtonDisabled]}
                accessibilityRole="button"
              >
                <Text style={styles.submitButtonText}>
                  {isCreating ? 'Guardando...' : editingProfesor ? 'Guardar cambios' : 'Guardar profesor'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  createActionRow: {
    alignItems: 'flex-end',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  createButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0066cc',
    paddingHorizontal: 14,
  },
  createButtonText: { color: '#fff', fontWeight: '600' },
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
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  expandButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  expandButtonText: { color: '#075eaa', fontSize: 14, fontWeight: '600' },
  editButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 8,
    backgroundColor: '#e8f1f8',
    paddingHorizontal: 10,
  },
  editButtonText: { color: '#075eaa', fontSize: 13, fontWeight: '600' },
  deleteButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 8,
    backgroundColor: '#fff0ef',
    paddingHorizontal: 10,
  },
  deleteButtonText: { color: '#b42318', fontSize: 13, fontWeight: '600' },
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  modalCloseButton: { paddingHorizontal: 8, paddingVertical: 6 },
  modalCloseText: { color: '#075eaa', fontWeight: '600' },
  formContent: { paddingBottom: 8 },
  fieldLabel: {
    color: '#26384a',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  formInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#bdc7d1',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  formInputMultiline: { minHeight: 88, paddingTop: 10 },
  submitButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0066cc',
    marginTop: 20,
  },
  submitButtonText: { color: '#fff', fontWeight: '700' },
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