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
  'Eres un asistente especializado en Pokémon y solo respondes preguntas relacionadas con ellos.',
  'Responde en español de forma clara, directa y amable.',
  'El mensaje incluye un Pokémon seleccionado y una pregunta.',
  'Cuando la pregunta use pronombres como "él", "su", "es" o no repita el nombre, interpreta que se refiere al Pokémon seleccionado.',
  'No solicites nuevamente el nombre si ya está indicado.',
  'Si desconoces un dato, dilo sin inventarlo.',
].join(' ');

let geminiClient = null;

// ==========================================
// 1. CONTROLADOR GOOGLE GEMINI
// ==========================================
async function askGemini(fullPrompt) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const modelName = (process.env.GEMINI_MODEL ?? 'gemini-3.8-flash').trim().replace(/^models\//, '');

  if (!apiKey) {
    throw new Error('La clave de GEMINI no está configurada en el servidor.');
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }

  const result = await geminiClient.models.generateContent({
    model: modelName,
    contents: fullPrompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      maxOutputTokens: 800,
    },
  });

  return result.text?.trim() ?? '';
}

// ==========================================
// 2. CONTROLADOR GROQ API (Llama 3.3 / Llama 3.1)
// ==========================================
async function askGroq(fullPrompt) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const modelName = (process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile').trim();

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
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Error en Groq: código ${response.status}`);
  }

  return data?.choices?.[0]?.message?.content?.trim() ?? '';
}

// ==========================================
// 3. CONTROLADOR OPENROUTER (DeepSeek / Gemma)
// ==========================================
async function askOpenRouter(fullPrompt) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const modelName = (process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-chat:free').trim();

  if (!apiKey) {
    throw new Error('La clave de OPENROUTER no está configurada en el servidor.');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://pokeapi-ia.onrender.com', // Recomendado por OpenRouter
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

  console.log(`[IA] Solicitud recibida: ${aiProvider} para "${pokemonName}"`);

  try {
    let answer = '';

    switch (aiProvider) {
      case 'GEMINI':
        answer = await askGemini(fullPrompt);
        break;

      case 'GROQ':
        answer = await askGroq(fullPrompt);
        break;

      case 'OPENROUTER':
        answer = await askOpenRouter(fullPrompt);
        break;

      default:
        return response.status(400).json({
          error: `Proveedor no válido: ${aiProvider}. Opciones: GEMINI, GROQ, OPENROUTER.`,
        });
    }

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
    console.error(`[IA] Error procesando con ${aiProvider}:`, error);

    return response.status(502).json({
      error: error instanceof Error ? error.message : `Error al consultar ${aiProvider}.`,
    });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, providers: ['GEMINI', 'GROQ', 'OPENROUTER'] }));

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor Multi-IA escuchando en el puerto ${port}`);
});