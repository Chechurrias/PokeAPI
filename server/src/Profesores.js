import 'dotenv/config';
import mongoose from 'mongoose';
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import swaggerUiDist from 'swagger-ui-dist';

const ExperienceSchema = new mongoose.Schema(
  {
    company: String,
    role: String,
    period: String,
    description: String,
  },
  { _id: false }
);

const EducationSchema = new mongoose.Schema(
  {
    institution: String,
    degree: String,
    year: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const ContactSchema = new mongoose.Schema(
  { linkedin: String, website: String },
  { _id: false }
);

const ProfesorSchema = new mongoose.Schema(
  {
    name: String,
    apellido: String,
    headline: String,
    Profesion: String,
    image: String,
    location: String,
    about: String,
    experience: [ExperienceSchema],
    education: [EducationSchema],
    skills: [String],
    contact: ContactSchema,
  },
  { collection: 'datos' }
);

const Profesor = mongoose.model('Profesor', ProfesorSchema);

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? 'http://localhost:8081,http://localhost:19006')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const mongoUri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
if (!mongoUri) {
  throw new Error('MONGODB_URI no está configurada para el microservicio de profesores.');
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const port = Number(process.env.PORT ?? 8000);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function createSearchFilter(search) {
  if (/^[\da-f]{24}$/i.test(search)) {
    return { _id: new mongoose.Types.ObjectId(search) };
  }

  const words = search.split(/\s+/).map((word) => new RegExp(escapeRegex(word), 'i'));
  return {
    $and: words.map((word) => ({
      $or: [
        { name: word },
        { apellido: word },
        { headline: word },
        { Profesion: word },
        { location: word },
        { about: word },
        { 'experience.company': word },
        { 'experience.role': word },
        { 'experience.description': word },
        { 'education.institution': word },
        { 'education.degree': word },
        { skills: word },
      ],
    })),
  };
}

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Microservicio de Profesores',
    version: '1.0.0',
    description: 'Consulta y crea perfiles de profesores almacenados en MongoDB Atlas.',
  },
  servers: [{ url: '/' }],
  paths: {
    '/health': {
      get: {
        summary: 'Verifica el servicio y la conexión con MongoDB',
        responses: {
          200: {
            description: 'Servicio y base de datos disponibles',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Health' },
              },
            },
          },
          503: { description: 'MongoDB no está disponible' },
        },
      },
    },
    '/api/profesores/datos': {
      get: {
        summary: 'Lista todos los profesores o busca por ObjectId/texto del perfil',
        description: 'Sin search (o con search vacío) devuelve todos los profesores. Busca por ObjectId o en nombre, apellido, titular, profesión, ubicación, experiencia, educación y habilidades.',
        parameters: [
          {
            name: 'search',
            in: 'query',
            required: false,
            description: 'Opcional: ObjectId de MongoDB o término de búsqueda. Si se omite o está vacío, devuelve todos los profesores.',
            schema: { type: 'string' },
            example: 'Omar',
          },
        ],
        responses: {
          200: {
            description: 'Perfiles encontrados',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Profesor' },
                },
              },
            },
          },
          500: { description: 'Error al consultar la base de datos' },
        },
      },
    },
  },
  components: {
    schemas: {
      Health: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          service: { type: 'string' },
          db: { type: 'boolean' },
        },
      },
      Profesor: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '6ac15a1068d39d243fc568ca' },
          name: { type: 'string', example: 'Omar' },
          apellido: { type: 'string', example: 'Bonilla' },
          headline: { type: 'string' },
          Profesion: { type: 'string' },
          image: { type: 'string', format: 'uri' },
          location: { type: 'string', example: 'Bogotá, Colombia' },
          about: { type: 'string' },
          experience: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                company: { type: 'string' },
                role: { type: 'string' },
                period: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
          education: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                institution: { type: 'string' },
                degree: { type: 'string' },
                year: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
              },
            },
          },
          skills: { type: 'array', items: { type: 'string' } },
          contact: {
            type: 'object',
            properties: {
              linkedin: { type: 'string', format: 'uri' },
              website: { type: 'string', format: 'uri' },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
};

const swaggerAssets = new Map([
  ['swagger-ui.css', ['swagger-ui.css', 'text/css; charset=utf-8']],
  ['swagger-ui-bundle.js', ['swagger-ui-bundle.js', 'text/javascript; charset=utf-8']],
  ['swagger-ui-standalone-preset.js', ['swagger-ui-standalone-preset.js', 'text/javascript; charset=utf-8']],
  ['favicon-32x32.png', ['favicon-32x32.png', 'image/png']],
  ['favicon-16x16.png', ['favicon-16x16.png', 'image/png']],
]);

const swaggerHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API Profesores - Swagger</title>
    <link rel="stylesheet" href="/docs/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/docs/swagger-ui-bundle.js"></script>
    <script src="/docs/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = () => SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout'
      });
    </script>
  </body>
</html>`;

function applyCorsHeaders(request, response) {
  const origin = request.headers.origin;
  const isLocalDevelopmentOrigin =
    origin && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
  if (origin && !allowedOrigins.has(origin) && !isLocalDevelopmentOrigin) {
    sendJson(response, 403, { error: 'Origen no permitido.' });
    return false;
  }

  response.setHeader('Vary', 'Origin');
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
  return true;
}

function handleOptionsRequest(response) {
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
  response.writeHead(204);
  response.end();
}

function parseRequestUrl(request, response) {
  try {
    return new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  } catch {
    sendJson(response, 400, { error: 'URL de solicitud no válida.' });
    return null;
  }
}

function serveSwaggerPage(response) {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(swaggerHtml);
}

function serveSwaggerAsset(assetName, response) {
  const asset = swaggerAssets.get(assetName);
  if (!asset) return sendJson(response, 404, { error: 'Recurso de documentación no encontrado.' });

  const [fileName, contentType] = asset;
  response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' });
  const stream = createReadStream(join(swaggerUiDist.getAbsoluteFSPath(), fileName));
  stream.on('error', () => {
    if (response.headersSent) return response.destroy();
    return sendJson(response, 404, { error: 'Recurso de documentación no encontrado.' });
  });
  return stream.pipe(response);
}

async function handleHealthRequest(response) {
  try {
    await mongoose.connection.db.admin().ping();
    return sendJson(response, 200, { ok: true, service: 'profesores-api', db: true });
  } catch {
    return sendJson(response, 503, { ok: false, service: 'profesores-api', db: false });
  }
}

async function handleProfessorSearch(url, response) {
  const search = (url.searchParams.get('search') ?? '').trim();

  try {
    const query = search ? createSearchFilter(search) : {};
    const profesoresQuery = Profesor.find(query).sort({ id: 1 });
    const profesores = await (search ? profesoresQuery.limit(50) : profesoresQuery).lean();
    return sendJson(response, 200, profesores);
  } catch (error) {
    console.error('Error al consultar profesores:', error.message);
    return sendJson(response, 500, { error: 'Error interno al consultar la base de datos.' });
  }
}

async function routeGetRequest(url, response) {
  if (url.pathname === '/docs' || url.pathname === '/docs/') return serveSwaggerPage(response);
  if (url.pathname === '/openapi.json') return sendJson(response, 200, openApiSpec);
  if (url.pathname.startsWith('/docs/')) {
    return serveSwaggerAsset(url.pathname.slice('/docs/'.length), response);
  }
  if (url.pathname === '/health') return handleHealthRequest(response);
  if (url.pathname === '/api/profesores/datos') return handleProfessorSearch(url, response);
  return sendJson(response, 404, { error: 'Ruta no encontrada.' });
}

async function handleRequest(request, response) {
  if (!applyCorsHeaders(request, response)) return;
  if (request.method === 'OPTIONS') return handleOptionsRequest(response);

  const url = parseRequestUrl(request, response);
  if (!url) return;
  if (request.method === 'GET') return routeGetRequest(url, response);

  response.setHeader('Allow', 'GET, OPTIONS');
  return sendJson(response, 405, { error: 'Método no permitido.' });
}

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

await mongoose.connect(mongoUri, {
  dbName: process.env.PROFESORES_MONGODB_DATABASE ?? 'Profesores',
});
server.listen(port, '0.0.0.0', () =>
  console.log(`🚀 Microservicio de profesores escuchando en puerto ${port}`)
);