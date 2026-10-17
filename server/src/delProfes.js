import 'dotenv/config';
import { Buffer } from 'node:buffer';
import mongoose from 'mongoose';
import { createServer } from 'node:http';
import Profesor, { getProfesorDatabaseId, initializeProfesorCollection } from './profesorModel.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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

export async function deleteProfesor(ProfesorModel, rawId, payload = {}) {
  if (!/^(?:[\da-f]{24}|[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12})$/i.test(rawId)) {
    throw new DelProfesorError('El ID del profesor debe ser un ObjectId o UUID v4 válido.');
  }

  const databaseId = getProfesorDatabaseId(rawId);
  const current = await ProfesorModel.findById(databaseId).lean();
  if (!current) {
    throw new DelProfesorError(`No se encontró un profesor con el ID ${rawId}.`, 404);
  }
  if (payload.uuid !== undefined && payload.uuid !== current.uuid) {
    throw new DelProfesorError('El UUID no coincide con el profesor solicitado.', 409);
  }
  if (payload.uuid !== undefined &&
    !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(payload.uuid)) {
    throw new DelProfesorError('El campo uuid debe ser un UUID v4 válido.');
  }
  const updatedAt = payload.updated_at === undefined
    ? new Date(Math.max(Date.now(), new Date(current.updated_at).getTime() + 1))
    : new Date(payload.updated_at);
  if (Number.isNaN(updatedAt.getTime())) {
    throw new DelProfesorError('La marca updated_at no es una fecha válida.');
  }
  if (updatedAt.getTime() <= new Date(current.updated_at).getTime()) return current;

  const deletedProfesor = await ProfesorModel.findOneAndUpdate(
    { _id: databaseId, updated_at: { $lt: updatedAt } },
    { $set: { is_deleted: true, updated_at: updatedAt } },
    { new: true, runValidators: true }
  ).lean();
  return deletedProfesor ?? (await ProfesorModel.findById(databaseId).lean());
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function applyCors(request, response) {
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

  const routeMatch = url.pathname.match(/^\/api\/profesores\/([^/]+)$/);
  if (routeMatch && request.method !== 'DELETE') {
    response.setHeader('Allow', 'DELETE, OPTIONS');
    return sendJson(response, 405, { error: 'Método no permitido. Usa DELETE.' });
  }
  if (!routeMatch || request.method !== 'DELETE') {
    response.setHeader('Allow', 'GET, DELETE, OPTIONS');
    return sendJson(response, 404, { error: 'Ruta no encontrada.' });
  }

  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 64 * 1024) {
        return sendJson(response, 413, { error: 'El cuerpo de la solicitud excede el tamaño permitido.' });
      }
      chunks.push(chunk);
    }
    let payload = {};
    if (chunks.length > 0) {
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return sendJson(response, 400, { error: 'El cuerpo de la solicitud debe ser JSON válido.' });
      }
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return sendJson(response, 400, { error: 'El cuerpo de la solicitud debe ser un objeto JSON.' });
    }
    const profesor = await deleteProfesor(Profesor, routeMatch[1], payload);
    return sendJson(response, 200, {
      message: `Se eliminó el profesor con ID ${profesor._id}.`,
      profesor,
    });
  } catch (error) {
    if (error instanceof DelProfesorError) {
      return sendJson(response, error.statusCode, { error: error.message });
    }

    console.error('Error al eliminar profesor:', error.message);
    if (error.statusCode === 400) return sendJson(response, 400, { error: error.message });
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
  await initializeProfesorCollection(Profesor);
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
