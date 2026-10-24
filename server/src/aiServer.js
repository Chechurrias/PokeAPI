import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? process.env.AI_PORT ?? 3001);

// --- CONFIGURACIÓN DE CORS ---
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? '').split(',').map((val) => val.trim()).filter(Boolean)
);

const isLocalOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/i.test(origin) ||
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin) ||
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin) ||
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin);

app.disable('x-powered-by');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin) || isLocalOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS.'));
  },
}));

app.use(express.json({ limit: '32kb' }));

// --- PROMPT DEL SISTEMA ---
const SYSTEM_INSTRUCTION = [
  'Eres un asistente especializado en Pokémon y solo puedes responder preguntas relacionadas con los pokémon.',
  'Responde en español de forma clara, directa y amable.',
  'El mensaje incluye un Pokémon seleccionado y una pregunta.',
  'Cuando la pregunta use pronombres como "él", "su", "es" o no repita el nombre, interpreta que se refiere al Pokémon seleccionado.',
  'No solicites nuevamente el nombre si ya está indicado.',
  'Si desconoces un dato, dilo sin inventarlo. ',
  'Solo puedes responder preguntas relacionadas UNICA Y EXCLUSIVAMENTE con los pokémon'
].join(' ');

let geminiClient = null;

// ==========================================
// 1. CONTROLADOR GOOGLE GEMINI
// ==========================================
async function askGemini(fullPrompt, timeoutMs) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const modelName = (process.env.GEMINI_MODEL ?? 'gemini-2.5-flash').trim().replace(/^models\//, '');

  if (!apiKey) {
    throw new Error('La clave de GEMINI no está configurada en el servidor.');
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }

  // Simulamos un timeout con Promise.race ya que generateContent de @google/genai maneja fetch internamente
  const geminiPromise = geminiClient.models.generateContent({
    model: modelName,
    contents: fullPrompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      maxOutputTokens: 800,
    },
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('AbortError')), timeoutMs)
  );

  const result = await Promise.race([geminiPromise, timeoutPromise]);
  return result.text?.trim() ?? '';
}

// ==========================================
// 2. CONTROLADOR GROQ API
// ==========================================
async function askGroq(fullPrompt, timeoutMs, signal) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const modelName = (process.env.GROQ_MODEL ?? 'openai/gpt-oss-20b').trim();

  if (!apiKey) {
    throw new Error('La clave de GROQ no está configurada en el servidor.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: fullPrompt },
      ],
      max_tokens: 800,
      temperature: 0.7,
    }),
    signal, // 👈 Se inyecta la señal del AbortController del timeout
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Error en Groq: código ${response.status}`);
  }

  return data?.choices?.[0]?.message?.content?.trim() ?? '';
}

// ==========================================
// 3. CONTROLADOR OPENROUTER
// ==========================================
async function askOpenRouter(fullPrompt, timeoutMs, signal) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const modelName = (process.env.OPENROUTER_MODEL ?? 'openrouter/free').trim();

  if (!apiKey) {
    throw new Error('La clave de OPENROUTER no está configurada en el servidor.');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://pokeapi-ia.onrender.com',
      'X-Title': 'Pokedex AI Assistant',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: fullPrompt },
      ],
      max_tokens: 800,
      temperature: 0.7,
    }),
    signal, // 👈 Se inyecta la señal del AbortController del timeout
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Error en OpenRouter: código ${response.status}`);
  }

  return data?.choices?.[0]?.message?.content?.trim() ?? '';
}

// ==========================================
// RUTA POST /api/ai/ask
// ==========================================
app.post('/api/ai/ask', async (request, response) => {
  const question = typeof request.body?.question === 'string' ? request.body.question.trim() : '';
  const pokemonName = typeof request.body?.pokemonName === 'string' ? request.body.pokemonName.trim() : '';
  const aiProvider = String(request.body?.aiProvider ?? 'GEMINI').toUpperCase().trim();
  
  // Recogemos el timeout enviado por el frontend (por defecto 30 segundos)
  const timeoutSeconds = Number(request.body?.timeoutSeconds ?? 30);
  const timeoutMs = timeoutSeconds * 1000;

  if (!question) {
    return response.status(400).json({ error: 'Escribe una pregunta.' });
  }

  if (!pokemonName) {
    return response.status(400).json({ error: 'Escribe un nombre de Pokémon válido.' });
  }

  const fullPrompt = [
    `Pokémon seleccionado: ${pokemonName}`,
    '',
    `Pregunta del usuario: ${question}`,
    '',
    'Responde la pregunta tomando como referencia al Pokémon seleccionado.',
  ].join('\n');

  console.log(`[IA] Solicitud: ${aiProvider} para "${pokemonName}" (Timeout: ${timeoutSeconds}s)`);

  // Configurar AbortController en el servidor para cortar la petición si excede el tiempo
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let answer = '';

    switch (aiProvider) {
      case 'GEMINI':
        answer = await askGemini(fullPrompt, timeoutMs);
        break;

      case 'GROQ':
        answer = await askGroq(fullPrompt, timeoutMs, controller.signal);
        break;

      case 'OPENROUTER':
        answer = await askOpenRouter(fullPrompt, timeoutMs, controller.signal);
        break;

      default:
        clearTimeout(timeoutId);
        return response.status(400).json({
          error: `Proveedor no válido: ${aiProvider}. Opciones: GEMINI, GROQ, OPENROUTER.`,
        });
    }

    clearTimeout(timeoutId);

    if (!answer) {
      return response.status(502).json({
        error: `El asistente (${aiProvider}) no devolvió texto. Inténtalo nuevamente.`,
      });
    }

    return response.json({
      answer,
      pokemon: pokemonName,
      provider: aiProvider,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[IA] Error procesando con ${aiProvider}:`, error);

    // Identificar si fue un error por exceder el tiempo límite
    if (error.name === 'AbortError' || error.message === 'AbortError') {
      return response.status(504).json({
        error: `La solicitud excedió el tiempo de espera de ${timeoutSeconds} segundos configurado para ${aiProvider}.`,
      });
    }

    return response.status(502).json({
      error: error instanceof Error ? error.message : `Error al consultar ${aiProvider}.`,
    });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, providers: ['GEMINI', 'GROQ', 'OPENROUTER'] }));

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor Multi-IA escuchando en el puerto ${port}`);
});