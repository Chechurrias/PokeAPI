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
const port = Number(process.env.PORT ?? 8002);
const editableFields = ['name', 'apellido', 'Profesion', 'headline', 'image', 'location', 'about'];

export class ModProfesorError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'ModProfesorError';
    this.statusCode = statusCode;
  }
}

function readRequiredString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ModProfesorError(`El campo ${fieldName} es obligatorio.`);
  }

  return value.trim();
}

function readOptionalString(value, fieldName) {
  if (typeof value !== 'string') {
    throw new ModProfesorError(`El campo ${fieldName} debe ser texto.`);
  }

  return value.trim();
}

export async function modifyProfesor(ProfesorModel, rawId, payload) {
  if (!/^[1-9]\d*$/.test(rawId)) {
    throw new ModProfesorError('El ID debe ser un número entero positivo.');
  }
  const id = Number(rawId);
  if (!Number.isSafeInteger(id)) {
    throw new ModProfesorError('El ID está fuera del rango permitido.');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ModProfesorError('El cuerpo de la solicitud debe ser un objeto JSON.');
  }

  const receivedFields = Object.keys(payload);
  const unknownFields = receivedFields.filter((field) => !editableFields.includes(field));
  if (unknownFields.length > 0) {
    throw new ModProfesorError(`No se pueden modificar estos campos: ${unknownFields.join(', ')}.`);
  }
  if (receivedFields.length === 0) {
    throw new ModProfesorError('Incluye al menos un campo para modificar.');
  }

  const updates = {};
  for (const field of receivedFields) {
    updates[field] = ['name', 'apellido', 'Profesion'].includes(field)
      ? readRequiredString(payload[field], field)
      : readOptionalString(payload[field], field);
  }

  const profesor = await ProfesorModel.findOneAndUpdate(
    { id },
    { $set: updates },
    { new: true, runValidators: true }
  ).lean();

  if (!profesor) {
    throw new ModProfesorError(`No se encontró un profesor con el ID ${id}.`, 404);
  }

  return profesor;
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
    response.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
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
      return sendJson(response, 200, { ok: true, service: 'mod-profesores-api', db: true });
    } catch (error) {
      console.error('Error al verificar MongoDB:', error.message);
      return sendJson(response, 503, { ok: false, service: 'mod-profesores-api', db: false });
    }
  }

  const routeMatch = url.pathname.match(/^\/api\/profesores\/([1-9]\d*)$/);
  if (routeMatch && request.method !== 'PATCH') {
    response.setHeader('Allow', 'PATCH, OPTIONS');
    return sendJson(response, 405, { error: 'Método no permitido. Usa PATCH.' });
  }
  if (!routeMatch || request.method !== 'PATCH') {
    response.setHeader('Allow', 'GET, PATCH, OPTIONS');
    return sendJson(response, 404, { error: 'Ruta no encontrada.' });
  }

  if (!request.headers['content-type']?.includes('application/json')) {
    return sendJson(response, 415, { error: 'El Content-Type debe ser application/json.' });
  }

  try {
    const payload = await readJsonBody(request);
    const profesor = await modifyProfesor(Profesor, routeMatch[1], payload);
    return sendJson(response, 200, profesor);
  } catch (error) {
    if (error instanceof ModProfesorError) {
      return sendJson(response, error.statusCode, { error: error.message });
    }
    if (error.statusCode === 400 || error.statusCode === 413) {
      return sendJson(response, error.statusCode, { error: error.message });
    }

    console.error('Error al modificar profesor:', error.message);
    return sendJson(response, 500, { error: 'Error interno al modificar el profesor.' });
  }
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    console.error('Error inesperado en mod-profesores-api:', error);
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
    throw new Error('MONGODB_URI no está configurada para el microservicio de modificación de profesores.');
  }

  await mongoose.connect(mongoUri, {
    dbName: process.env.PROFESORES_MONGODB_DATABASE ?? 'Profesores',
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`Microservicio de modificación de profesores escuchando en 0.0.0.0:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void startServer().catch((error) => {
    console.error('No se pudo iniciar mod-profesores-api:', error);
    process.exitCode = 1;
  });
}
