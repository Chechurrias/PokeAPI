import { GoogleGenAI } from '@google/genai';
import { Router } from 'express';
import fetch from 'node-fetch';

const POKEMON_NAME_REGEX = /^[a-z0-9-]{1,40}$/;

const POKEMON_API_BASE_URL =
  process.env.POKEMON_API_BASE_URL ?? 'https://pokeapi-zz36.onrender.com';

function normalizePokemonName(value) {
  return value
    ?.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}

export function createAiRouter() {
  const router = Router();

  const gemini = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  router.post('/ask', async (request, response) => {
    const question =
      typeof request.body?.question === 'string'
        ? request.body.question.trim()
        : '';

    const rawPokemonName =
      typeof request.body?.pokemonName === 'string'
        ? request.body.pokemonName
        : '';

    if (!question) {
      return response.status(400).json({
        error: 'Escribe una pregunta.',
      });
    }

    if (question.length > 500) {
      return response.status(400).json({
        error: 'La pregunta no puede superar los 500 caracteres.',
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return response.status(503).json({
        error: 'El asistente no tiene configurada la clave en el servidor.',
      });
    }

    const pokemonName = normalizePokemonName(rawPokemonName);

    if (!pokemonName || !POKEMON_NAME_REGEX.test(pokemonName)) {
      return response.status(400).json({
        error: 'Escribe un nombre de Pokémon válido.',
      });
    }

    try {
      const pokemonServiceUrl =
        `${POKEMON_API_BASE_URL}/api/pokemon/` +
        encodeURIComponent(pokemonName);

      const checkResponse = await fetch(pokemonServiceUrl, {
        signal: AbortSignal.timeout(8000),
      });

      if (checkResponse.status === 404) {
        return response.status(404).json({
          error: 'El Pokémon no existe en la base de datos de la aplicación.',
        });
      }

      if (!checkResponse.ok) {
        return response.status(502).json({
          error: 'No fue posible verificar el Pokémon en el servicio de datos.',
        });
      }

      const modelName = (
        process.env.GEMINI_MODEL ?? 'gemini-1.5-flash'
      ).replace(/^models\//, '');

      const result = await gemini.models.generateContent({
        model: modelName,
        contents: question,
        config: {
          systemInstruction:
            'Eres un asistente experto en Pokémon y cultura pop. ' +
            'Responde de forma clara, directa, amable y detallada.',
          maxOutputTokens: 800,
        },
      });

      return response.json({
        answer: result.text ?? 'No se pudo generar una respuesta.',
        sources: [],
      });
    } catch (error) {
      console.error('Error en /api/ai/ask:', error);

      const isTimeout =
        error?.name === 'AbortError' || error?.name === 'TimeoutError';

      return response.status(isTimeout ? 504 : 502).json({
        error: isTimeout
          ? 'El servicio de datos tardó demasiado en responder.'
          : 'Error interno al procesar la solicitud.',
      });
    }
  });

  return router;
}