import 'dotenv/config';
import mongoose from 'mongoose';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? 'http://localhost:8081,http://localhost:19006')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const port = Number(process.env.PORT ?? 8003);

export class DelProfesorError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'DelProfesorError';
    this.statusCode = statusCode;
  }
}

export async function deleteProfesor(ProfesorModel, rawId) {
  if (!/^[1-9]\d*$/.test(rawId)) {
    throw new DelProfesorError('El ID debe ser un número entero positivo.');
  }

  const id = Number(rawId);
  if (!Number.isSafeInteger(id)) {
    throw new DelProfesorError('El ID está fuera del rango permitido.');
  }

  const deletedProfesor = await ProfesorModel.findOneAndDelete({ id }).lean();
  if (!deletedProfesor) {
    throw new DelProfesorError(`No se encontró un profesor con el ID ${id}.`, 404);
  }

  return deletedProfesor;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    sendJson(response, 403, { error: 'Origen no permitido.' });
    return false;
  }

  response.setHeader('Vary', 'Origin');
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
  return true;
}

async function handleRequest(request, response) {
  if (!applyCors(request, response)) return;

  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
    response.writeHead(204);
    return response.end();
  }

  let url;
  try {
    url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  } catch {
    return sendJson(response, 400, { error: 'URL de solicitud no válida.' });
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    try {
      await mongoose.connection.db.admin().ping();
      return sendJson(response, 200, { ok: true, service: 'del-profesores-api', db: true });
    } catch (error) {
      console.error('Error al verificar MongoDB:', error.message);
      return sendJson(response, 503, { ok: false, service: 'del-profesores-api', db: false });
    }
  }

  const routeMatch = url.pathname.match(/^\/api\/profesores\/([1-9]\d*)$/);
  if (routeMatch && request.method !== 'DELETE') {
    response.setHeader('Allow', 'DELETE, OPTIONS');
    return sendJson(response, 405, { error: 'Método no permitido. Usa DELETE.' });
  }
  if (!routeMatch || request.method !== 'DELETE') {
    response.setHeader('Allow', 'GET, DELETE, OPTIONS');
    return sendJson(response, 404, { error: 'Ruta no encontrada.' });
  }

  try {
    const profesor = await deleteProfesor(Profesor, routeMatch[1]);
    return sendJson(response, 200, {
      message: `Se eliminó el profesor con ID ${profesor.id}.`,
      profesor,
    });
  } catch (error) {
    if (error instanceof DelProfesorError) {
      return sendJson(response, error.statusCode, { error: error.message });
    }

    console.error('Error al eliminar profesor:', error.message);
    return sendJson(response, 500, { error: 'Error interno al eliminar el profesor.' });
  }
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    console.error('Error inesperado en del-profesores-api:', error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: 'Error interno del servidor.' });
    } else {
      response.destroy();
    }
  });
});

async function startServer() {
  const mongoUri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI no está configurada para el microservicio de eliminación de profesores.');
  }

  await mongoose.connect(mongoUri, {
    dbName: process.env.PROFESORES_MONGODB_DATABASE ?? 'Profesores',
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`Microservicio de eliminación de profesores escuchando en 0.0.0.0:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void startServer().catch((error) => {
    console.error('No se pudo iniciar del-profesores-api:', error);
    process.exitCode = 1;
  });
}
