import cors from 'cors';
import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL no está configurado. Define la variable de entorno antes de iniciar el servidor.');
}

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean)
);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;

  const patterns = [
    /^https?:\/\/localhost(?::\d+)?$/i,
    /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i,
    /^https?:\/\/10\.0\.2\.2(?::\d+)?$/i,
    /^https?:\/\/192\.168\.(?:\d{1,3}\.)?\d{1,3}(?::\d+)?$/i,
    /^https?:\/\/\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/i,
    /^exp:\/\/[^/]+$/i,
    /^https?:\/\/.*\.(render\.com|railway\.app|fly\.dev|vercel\.app|netlify\.app|githubpreview\.dev|app\.github\.dev)$/i,
    /^https?:\/\/.*\.(ngrok-free\.app|loca\.lt|expo\.dev|gitpod\.io)$/i,
  ];

  return patterns.some((pattern) => pattern.test(origin));
};

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

app.disable('x-powered-by');
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origen no permitido por CORS.'));
  },
  credentials: true,
}));
app.use(express.json());

app.get('/health', async (_request, response) => {
  try {
    const result = await pool.query('SELECT 1');
    return response.json({ ok: true, service: 'pokemon-api', db: result.rowCount > 0 });
  } catch (error) {
    console.error('Error en la base de datos:', error);
    return response.status(500).json({ ok: false, service: 'pokemon-api', db: false });
  }
});

app.get('/api/pokemon/:name', async (request, response) => {
  const rawName = request.params.name?.trim();
  const normalizedName = rawName?.toLowerCase();

  if (!normalizedName || !/^[a-z0-9-\s]+$/.test(normalizedName)) {
    return response.status(400).json({ error: 'El nombre del Pokémon no es válido.' });
  }

  try {
    const result = await pool.query(
      `
        SELECT id, pokedex_id, name, type_primary, type_secondary, sprite_url
        FROM pokemons
        WHERE LOWER(name) = $1 OR LOWER(name) = $2
        LIMIT 1;
      `,
      [normalizedName, normalizedName.replace(/-/g, ' ')]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ error: 'Pokémon no encontrado.' });
    }

    const pokemon = result.rows[0];
    const types = [
      ...(pokemon.type_primary ? [{ type: { name: pokemon.type_primary.toLowerCase() } }] : []),
      ...(pokemon.type_secondary ? [{ type: { name: pokemon.type_secondary.toLowerCase() } }] : []),
    ];

    return response.json({
      id: pokemon.pokedex_id ?? pokemon.id,
      name: pokemon.name,
      height: 0,
      weight: 0,
      types,
      abilities: [],
      moves: [],
      sprites: {
        front_default: pokemon.sprite_url,
        other: {
          'official-artwork': {
            front_default: pokemon.sprite_url,
            front_shiny: null,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error consultando Supabase:', error);
    return response.status(502).json({ error: 'No se pudo consultar la base de datos.' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Pokemon API escuchando en http://localhost:${port}`);
});
