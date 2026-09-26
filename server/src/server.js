import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const pokeApiUrl = 'https://pokeapi.co/api/v2/pokemon';
const allowedOrigins = new Set([
  'http://localhost:8081',
  'http://localhost:19006',
]);

app.disable('x-powered-by');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origen no permitido por CORS.'));
  },
}));
app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'pokemon-api' });
});

app.get('/api/pokemon/:name', async (request, response) => {
  const name = request.params.name.trim().toLowerCase();

  if (!/^[a-z0-9-]+$/.test(name)) {
    return response.status(400).json({ error: 'El nombre del Pokémon no es válido.' });
  }

  try {
    const pokeApiResponse = await fetch(`${pokeApiUrl}/${encodeURIComponent(name)}`);

    if (pokeApiResponse.status === 404) {
      return response.status(404).json({ error: 'Pokémon no encontrado.' });
    }

    if (!pokeApiResponse.ok) {
      return response.status(502).json({ error: 'PokeAPI no está disponible.' });
    }

    const pokemon = await pokeApiResponse.json();

    return response.json({
      id: pokemon.id,
      name: pokemon.name,
      height: pokemon.height,
      weight: pokemon.weight,
      types: pokemon.types,
      abilities: pokemon.abilities,
      moves: pokemon.moves,
      sprites: pokemon.sprites,
    });
  } catch (error) {
    console.error('Error consultando PokeAPI:', error);
    return response.status(502).json({ error: 'No se pudo consultar PokeAPI.' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Pokemon API escuchando en http://localhost:${port}`);
});
