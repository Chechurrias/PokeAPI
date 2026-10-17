import { GoogleGenAI } from '@google/genai';
import { Router } from 'express';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';

export function createAiRouter() {
  const router = Router();

  router.post('/ask', async (request, response) => {
    const question = typeof request.body?.question === 'string' ? request.body.question.trim() : '';
    if (!question) {
      return response.status(400).json({ error: 'Escribe una pregunta.' });
    }
    if (question.length > 500) {
      return response.status(400).json({ error: 'La pregunta no puede superar los 500 caracteres.' });
    }
    if (!GEMINI_API_KEY) {
      return response.status(503).json({ error: 'El asistente no está configurado en el servidor.' });
    }

    try {
      const gemini = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const modelName = GEMINI_MODEL.startsWith('models/') ? GEMINI_MODEL.replace('models/', '') : GEMINI_MODEL;

      // Consulta directa a Gemini con un prompt de rol experto
      const result = await gemini.models.generateContent({
        model: modelName,
        contents: question,
        config: {
          systemInstruction: 'Eres un asistente experto en Pokémon y cultura pop. Responde de forma clara, directa, amable y detallada.',
          maxOutputTokens: 800,
        },
      });

      const textResponse = result.text ?? 'No se pudo generar una respuesta.';

      return response.json({
        answer: textResponse,
        sources: [],
      });
    } catch (error) {
      console.error('Error detallado al consultar Gemini:', error);

      if (error?.status === 400 || error?.status === 401 || error?.status === 403) {
        return response.status(503).json({ error: 'La clave de Gemini no es válida o no tiene acceso al modelo.' });
      }
      if (error?.status === 429) {
        return response.status(503).json({ error: 'Gemini está ocupado temporalmente. Inténtalo de nuevo.' });
      }
      return response.status(502).json({ error: 'No se pudo obtener respuesta de Gemini.' });
    }
  });

  return router;
}