import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { createAiRouter } from './aiRoutes.js';

const app = express();

const port = Number(process.env.AI_PORT ?? 3001);

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean)
);

const isLocalOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/i.test(origin) ||
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin) ||
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin) ||
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin);

app.disable('x-powered-by');

app.use(cors({
  origin: (origin, callback) => {
    // Si no hay origen (como en peticiones móviles nativas o Postman) o está permitido
    if (!origin || allowedOrigins.has(origin) || isLocalOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS.'));
  },
}));

app.use(express.json({ limit: '32kb' }));

// Montamos el router de IA
app.use('/api/ai', createAiRouter());

app.get('/health', (_request, response) => response.json({ ok: true, service: 'pokemon-gemini-ai' }));

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor de IA escuchando en el puerto ${port}`);
});
