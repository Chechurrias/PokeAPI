import 'dotenv/config';
import mongoose from 'mongoose';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Profesor } from './ProfesorModel.js';

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? 'http://localhost:8081,http://localhost:19006')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const port = Number(process.env.PORT ?? 8001);

export class AddProfesorError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AddProfesorError';
    this.statusCode = statusCode;
  }
}

function readRequiredString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AddProfesorError(`El campo ${fieldName} es obligatorio.`);
  }

  return value.trim();
}

function readOptionalString(value, fieldName) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new AddProfesorError(`El campo ${fieldName} debe ser texto.`);
  }

  return value.trim() || undefined;
}

export async function addProfesor(Profesor, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AddProfesorError('El cuerpo de la solicitud debe ser un objeto JSON.');
  }

  const id = payload.id;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AddProfesorError('El ID debe ser un número entero positivo.');
  }

  const profesorData = {
    id,
    name: readRequiredString(payload.name, 'name'),
    apellido: readRequiredString(payload.apellido, 'apellido'),
    Profesion: readRequiredString(payload.Profesion, 'Profesion'),
  };

  for (const fieldName of ['headline', 'image', 'location', 'about']) {
    const value = readOptionalString(payload[fieldName], fieldName);
    if (value) profesorData[fieldName] = value;
  }

  const existingProfesor = await Profesor.exists({ id });
  if (existingProfesor) {
    throw new AddProfesorError(`Ya existe un profesor con el ID ${id}.`, 409);
  }

  return Profesor.create(profesorData);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  const maxBodySize = 64 * 1024;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodySize) {
      const error = new Error('El cuerpo de la solicitud excede el tamaño permitido.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    const error = new Error('El cuerpo de la solicitud es obligatorio.');
    error.statusCode = 400;
    throw error;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('El cuerpo de la solicitud debe ser JSON válido.');
    error.statusCode = 400;
    throw error;
  }
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
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
      return sendJson(response, 200, { ok: true, service: 'add-profesores-api', db: true });
    } catch (error) {
      console.error('Error al verificar MongoDB:', error.message);
      return sendJson(response, 503, { ok: false, service: 'add-profesores-api', db: false });
    }
  }

  if (url.pathname === '/api/profesores' && request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS');
    return sendJson(response, 405, { error: 'Método no permitido. Usa POST.' });
  }

  if (request.method !== 'POST' || url.pathname !== '/api/profesores') {
    response.setHeader('Allow', 'GET, POST, OPTIONS');
    return sendJson(response, 404, { error: 'Ruta no encontrada.' });
  }

  if (!request.headers['content-type']?.includes('application/json')) {
    return sendJson(response, 415, { error: 'El Content-Type debe ser application/json.' });
  }

  try {
    const payload = await readJsonBody(request);
    const profesor = await addProfesor(Profesor, payload);
    return sendJson(response, 201, profesor);
  } catch (error) {
    if (error instanceof AddProfesorError) {
      return sendJson(response, error.statusCode, { error: error.message });
    }
    if (error.statusCode === 400 || error.statusCode === 413) {
      return sendJson(response, error.statusCode, { error: error.message });
    }
    if (error.code === 11000) {
      return sendJson(response, 409, { error: 'Ya existe un profesor con esos datos.' });
    }

    console.error('Error al crear profesor:', error.message);
    return sendJson(response, 500, { error: 'Error interno al crear el profesor.' });
  }
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    console.error('Error inesperado en add-profesores-api:', error);
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
    throw new Error('MONGODB_URI no está configurada para el microservicio de creación de profesores.');
  }

  await mongoose.connect(mongoUri, {
    dbName: process.env.PROFESORES_MONGODB_DATABASE ?? 'Profesores',
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`Microservicio de creación de profesores escuchando en 0.0.0.0:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void startServer().catch((error) => {
    console.error('No se pudo iniciar add-profesores-api:', error);
    process.exitCode = 1;
  });
}
