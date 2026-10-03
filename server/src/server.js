import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT ?? 3000);
const serviceBaseUrl = process.env.RENDER_EXTERNAL_URL || '/';
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

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pokemon API Microservice',
      version: '1.0.0',
      description: 'Microservicio para consultar Pokémon almacenados en Supabase PostgreSQL.',
    },
    servers: [
      {
        url: serviceBaseUrl,
        description: process.env.RENDER_EXTERNAL_URL ? 'Microservicio desplegado en Render' : 'Origen actual',
      },
    ],
  },
  apis: ['./src/server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

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

app.get('/', (_request, response) => {
  response.type('html').send(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Pokemon API</title>
        <style>
          body { font-family: Arial, sans-serif; background: #111827; color: #f9fafb; display: grid; place-items: center; min-height: 100vh; margin: 0; }
          .card { max-width: 620px; background: #1f2937; border-radius: 16px; padding: 32px; box-shadow: 0 12px 40px rgba(0,0,0,.25); }
          h1 { margin-top: 0; }
          a { display: inline-block; margin-top: 12px; background: #2563eb; color: white; text-decoration: none; padding: 12px 18px; border-radius: 10px; }
          .links { display: flex; gap: 12px; flex-wrap: wrap; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Pokemon API Microservice</h1>
          <p>Microservicio para consultar Pokémon desde Supabase.</p>
          <div class="links">
            <a href="/docs">Ver documentación Swagger</a>
            <a href="/health">Health check</a>
          </div>
        </div>
      </body>
    </html>
  `);
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check del microservicio
 *     responses:
 *       200:
 *         description: Estado del servicio
 *       500:
 *         description: Error en la base de datos
 */
app.get('/health', async (_request, response) => {
  try {
    const result = await pool.query('SELECT 1');
    return response.json({ ok: true, service: 'pokemon-api', db: result.rowCount > 0 });
  } catch (error) {
    console.error('Error en la base de datos:', error);
    return response.status(500).json({ ok: false, service: 'pokemon-api', db: false, error: error.message });
  }
});

/**
 * @openapi
 * /api/pokemon/{name}:
 *   get:
 *     summary: Consulta un Pokémon por nombre
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre del Pokémon a buscar
 *     responses:
 *       200:
 *         description: Pokémon encontrado
 *       400:
 *         description: Nombre inválido
 *       404:
 *         description: Pokémon no encontrado
 *       500:
 *         description: Error al consultar la base de datos
 */
app.get('/api/pokemon/:name', async (request, response) => {
  const rawName = request.params.name?.trim();
  const normalizedName = rawName?.toLowerCase();

  if (!normalizedName || !/^[a-z0-9-\s]+$/.test(normalizedName)) {
    return response.status(400).json({ error: 'El nombre del Pokémon no es válido.' });
  }

  try {
    let result;
    const query = `
      SELECT id, pokedex_id, name, type_primary, type_secondary, sprite_url
      FROM %TABLE%
      WHERE LOWER(name) = $1 OR LOWER(name) = $2
      LIMIT 1;
    `;
    const params = [normalizedName, normalizedName.replaceAll('-', ' ')];

    // Intenta buscar primero en 'pokemons' y si no existe prueba en 'pokemon'
    try {
      result = await pool.query(query.replace('%TABLE%', 'pokemons'), params);
    } catch (err) {
      if (err.code === '42P01') { // Causal: Relation does not exist
        result = await pool.query(query.replace('%TABLE%', 'pokemon'), params);
      } else {
        throw err;
      }
    }

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
    return response.status(500).json({
      error: 'Error en el servidor al consultar la base de datos.',
      details: error.message,
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(
    process.env.RENDER_EXTERNAL_URL
      ? `Pokemon API disponible en ${process.env.RENDER_EXTERNAL_URL}`
      : `Pokemon API escuchando en 0.0.0.0:${port}`
  );
});