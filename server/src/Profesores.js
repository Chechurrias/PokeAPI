import 'dotenv/config';
import mongoose from 'mongoose';
import { createServer } from 'node:http';

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
    id: Number,
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

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const port = Number(process.env.PORT ?? 8000);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function createSearchFilter(search) {
  if (/^\d+$/.test(search)) return { id: Number(search) };

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

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    return sendJson(response, 403, { error: 'Origen no permitido.' });
  }

  response.setHeader('Vary', 'Origin');
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);

  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
    response.writeHead(204);
    return response.end();
  }

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET, OPTIONS');
    return sendJson(response, 405, { error: 'Método no permitido. Usa GET y query params.' });
  }

  let url;
  try {
    url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  } catch {
    return sendJson(response, 400, { error: 'URL de solicitud no válida.' });
  }

  if (url.pathname === '/health') {
    try {
      await mongoose.connection.db.admin().ping();
      return sendJson(response, 200, { ok: true, service: 'profesores-api', db: true });
    } catch {
      return sendJson(response, 503, { ok: false, service: 'profesores-api', db: false });
    }
  }

  if (url.pathname !== '/api/profesores/datos') {
    return sendJson(response, 404, { error: 'Ruta no encontrada.' });
  }

  const search = (url.searchParams.get('search') ?? '').trim();
  if (!search) {
    return sendJson(response, 400, { error: 'El parámetro de consulta search es obligatorio.' });
  }

  try {
    const profesores = await Profesor.find(createSearchFilter(search)).limit(50).lean();
    return sendJson(response, 200, profesores);
  } catch (error) {
    console.error('Error al consultar profesores:', error.message);
    return sendJson(response, 500, { error: 'Error interno al consultar la base de datos.' });
  }
});

await mongoose.connect(mongoUri, {
  dbName: process.env.PROFESORES_MONGODB_DATABASE ?? 'Profesores',
});
server.listen(port, '0.0.0.0', () =>
  console.log(`🚀 Microservicio de profesores escuchando en puerto ${port}`)
);