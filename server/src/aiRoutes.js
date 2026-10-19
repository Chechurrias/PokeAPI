import { GoogleGenAI } from '@google/genai';
import { Router } from 'express';

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

    const apiKey = process.env.GEMINI_API_KEY;
    const rawModel = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';

    if (!apiKey) {
      return response.status(503).json({ error: 'El asistente no tiene configurada la clave en el servidor.' });
    }

    try {
      const gemini = new GoogleGenAI({ apiKey });
      const modelName = rawModel.replace(/^models\//, '');

      // Consulta directa a Gemini
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
      // Imprimimos el error crudo completo y la traza en la consola de Render para facilitar el diagnóstico
      console.error('ERROR CRUDO DE GEMINI:', JSON.stringify(error, null, 2));
      console.error('STACK TRACE:', error?.stack);

      // Extracción segura sin usar 'any'
      const err = (typeof error === 'object' && error !== null) ? error : {};
      const statusCode = 'status' in err ? err.status : ('code' in err ? err.code : undefined);
      const statusText = String(statusCode ?? '');
      const errorMessage = error instanceof Error ? error.message : 'No se pudo obtener respuesta de Gemini.';

      if (
        statusCode === 400 ||
        statusCode === 401 ||
        statusCode === 403 ||
        statusText.includes('UNAUTHENTICATED') ||
        statusText.includes('PERMISSION_DENIED')
      ) {
        return response.status(503).json({ error: 'La clave de Gemini no es válida o no tiene acceso al modelo.' });
      }

      if (statusCode === 429 || statusText.includes('RESOURCE_EXHAUSTED')) {
        return response.status(503).json({ error: 'Gemini está ocupado o se superó la cuota temporalmente.' });
      }

      // Devolvemos el mensaje de error exacto para mayor visibilidad en la app
      return response.status(502).json({ error: errorMessage });
    }
  });

  return router;
}