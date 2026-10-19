import { GoogleGenAI } from '@google/genai';
import { Router } from 'express';

const POKEMON_NAME_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizePokemonName(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}

export function createAiRouter() {
  const router = Router();

  // Se inicializa después de comprobar la configuración.
  let gemini;

  router.post('/ask', async (request, response) => {
    const question =
      typeof request.body?.question === 'string'
        ? request.body.question.trim()
        : '';

    const pokemonName = normalizePokemonName(
      request.body?.pokemonName
    );

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

    if (
      !pokemonName ||
      pokemonName.length > 80 ||
      !POKEMON_NAME_REGEX.test(pokemonName)
    ) {
      return response.status(400).json({
        error: 'Escribe un nombre de Pokémon válido.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();

    // Conserva el modelo configurado y el fallback de tu código original.
    const modelName = (
      process.env.GEMINI_MODEL ?? 'gemini-1.5-flash'
    )
      .trim()
      .replace(/^models\//, '');

    if (!apiKey) {
      return response.status(503).json({
        error:
          'El asistente no tiene configurada la clave en el servidor.',
      });
    }

    if (!modelName) {
      return response.status(503).json({
        error: 'El modelo del asistente no está configurado.',
      });
    }

    try {
      if (!gemini) {
        gemini = new GoogleGenAI({ apiKey });
      }

      // El nombre no se queda solamente en el JSON del frontend:
      // se incorpora al contenido que realmente recibe Gemini.
      const fullQuestion = [
        `Pokémon seleccionado: ${pokemonName}`,
        '',
        `Pregunta del usuario: ${question}`,
        '',
        'Responde la pregunta tomando como referencia al Pokémon seleccionado.',
      ].join('\n');

      console.log('[IA] Iniciando consulta:', {
        model: modelName,
        pokemonName,
        questionLength: question.length,
      });

      const result = await gemini.models.generateContent({
        model: modelName,
        contents: fullQuestion,
        config: {
          systemInstruction: [
            'Eres un asistente especializado en Pokémon y solo respondes preguntas relacionadas con ellos.',
            'Responde en español de forma clara y directa y solo respondes preguntas relacionadas con ellos.',
            'El mensaje incluye un Pokémon seleccionado y una pregunta.',
            'Cuando la pregunta diga "él", "su", "es" o no repita el nombre,',
            'interpreta que se refiere al Pokémon seleccionado.',
            'No solicites nuevamente el nombre si ya está indicado.',
            'Si desconoces un dato, dilo sin inventarlo.',
          ].join(' '),
          maxOutputTokens: 800,
        },
      });

      const answer =
        typeof result.text === 'string'
          ? result.text.trim()
          : '';

      if (!answer) {
        console.warn('[IA] Respuesta sin texto:', {
          pokemonName,
          finishReason: result.candidates?.[0]?.finishReason,
          promptFeedback: result.promptFeedback,
        });

        return response.status(502).json({
          error:
            'El asistente no devolvió una respuesta de texto. Inténtalo nuevamente.',
        });
      }

      return response.json({
        answer,
        pokemon: pokemonName,
        sources: [],
      });
    } catch (error) {
      console.error('[IA] Error completo:', error);

      console.error('[IA] Detalle del error:', {
        name: error?.name,
        message: error?.message,
        status: error?.status,
        code: error?.code,
        stack: error?.stack,
      });

      const upstreamStatus = Number(error?.status);

      if (upstreamStatus === 429) {
        return response.status(429).json({
          error:
            'El servicio de IA alcanzó su límite de solicitudes o cuota. Inténtalo más tarde.',
        });
      }

      if (upstreamStatus === 503) {
        return response.status(503).json({
          error:
            'El servicio de IA no está disponible temporalmente. Inténtalo más tarde.',
        });
      }

      return response.status(502).json({
        error:
          'No fue posible obtener una respuesta del asistente. Revisa los logs del backend de IA.',
      });
    }
  });

  return router;
}