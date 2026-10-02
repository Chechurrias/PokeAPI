import { Image } from 'expo-image';
import { Link } from 'expo-router';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { useRickContext } from '@/context/RickContext';

export default function InfoRickScreen() {
	const { character, loading, error } = useRickContext();
	let statusStyle = styles.unknownDot;
	if (character?.status === 'Alive') statusStyle = styles.aliveDot;
	if (character?.status === 'Dead') statusStyle = styles.deadDot;
	const renderDetails = () => {
		if (loading) {
			return (
				<View style={styles.feedback}>
					<ActivityIndicator size="large" color="#547b31" />
					<Text style={styles.muted}>Consultando personaje...</Text>
				</View>
			);
		}

		if (!character) {
			return (
				<View style={styles.feedback}>
					<Text style={styles.muted}>{error || 'Elige un personaje del catálogo para ver su ficha.'}</Text>
					<Link href="/RickyMorty" asChild>
						<Pressable style={styles.catalogButton}>
							<Text style={styles.catalogButtonText}>Abrir catálogo</Text>
						</Pressable>
					</Link>
				</View>
			);
		}

		return (
			<>
				<View style={styles.hero}>
					<Image source={{ uri: character.image }} style={styles.image} contentFit="cover" transition={200} />
					<View style={styles.heroCaption}>
						<Text style={styles.characterId}>SUJETO #{String(character.id).padStart(3, '0')}</Text>
						<Text style={styles.name}>{character.name}</Text>
						<Text style={styles.species}>{character.species}{character.type ? ` · ${character.type}` : ''}</Text>
					</View>
				</View>

				<View style={styles.statusRow}>
					<View style={[styles.statusDot, statusStyle]} />
					<Text style={styles.statusText}>{character.status} · {character.gender}</Text>
				</View>

				<View style={styles.details}>
					<DetailRow label="Origen" value={character.origin.name} />
					<DetailRow label="Última ubicación" value={character.location.name} />
					<DetailRow label="Episodios" value={String(character.episode.length)} last />
				</View>
			</>
		);
	};

	return (
		<ScrollView style={styles.screen} contentContainerStyle={styles.content}>
			<Text style={styles.eyebrow}>ARCHIVO INTERDIMENSIONAL</Text>
			<Text style={styles.title}>Info Rick</Text>

			{renderDetails()}
		</ScrollView>
	);
}

function DetailRow({ label, value, last = false }: Readonly<{ label: string; value: string; last?: boolean }>) {
	return (
		<View style={[styles.detailRow, !last && styles.detailBorder]}>
			<Text style={styles.detailLabel}>{label}</Text>
			<Text style={styles.detailValue}>{value}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: '#f1f3e9' },
	content: { paddingHorizontal: 18, paddingTop: 58, paddingBottom: 32 },
	eyebrow: { color: '#587d37', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
	title: { color: '#17221a', fontSize: 32, fontWeight: '900', marginTop: 5, marginBottom: 20 },
	hero: { overflow: 'hidden', borderRadius: 8, backgroundColor: '#17221a' },
	image: { width: '100%', aspectRatio: 1.15, backgroundColor: '#dce5d0' },
	heroCaption: { padding: 17 },
	characterId: { color: '#b5d94a', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
	name: { color: '#fffefa', fontSize: 27, fontWeight: '900', marginTop: 4 },
	species: { color: '#d7ddcf', fontSize: 14, marginTop: 3 },
	statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 19 },
	statusDot: { width: 10, height: 10, borderRadius: 5 },
	aliveDot: { backgroundColor: '#318b59' },
	deadDot: { backgroundColor: '#d65344' },
	unknownDot: { backgroundColor: '#9a9d93' },
	statusText: { color: '#17221a', fontSize: 15, fontWeight: '700' },
	details: { paddingHorizontal: 15, borderRadius: 8, borderWidth: 1, borderColor: '#dfe4d8', backgroundColor: '#fffefa' },
	detailRow: { gap: 5, paddingVertical: 14 },
	detailBorder: { borderBottomWidth: 1, borderBottomColor: '#e6e9e1' },
	detailLabel: { color: '#687064', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
	detailValue: { color: '#17221a', fontSize: 15, fontWeight: '600' },
	feedback: { minHeight: 230, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 18 },
	muted: { color: '#24d710', fontSize: 15, textAlign: 'center' },
	catalogButton: { paddingHorizontal: 17, paddingVertical: 11, borderRadius: 8, backgroundColor: '#b5d94a' },
	catalogButtonText: { color: '#17221a', fontWeight: '800' },
});
