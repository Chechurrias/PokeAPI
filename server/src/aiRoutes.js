import { GoogleGenAI } from '@google/genai';
import { Router } from 'express';
import fetch from 'node-fetch'; // Asegúrate de tener node-fetch o usar fetch nativo de Node 18+

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
      // 1. EXTRAER EL POKÉMON DE LA PREGUNTA EN EL BACKEND
      const cleanText = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿?¡!,.]/g, '');
      const words = cleanText.split(/\s+/);
      const stopWords = ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'que', 'cual', 'es', 'tipo', 'sobre', 'numero', 'color', 'caracteristicas'];
      const filtered = words.filter(w => w.length > 2 && !stopWords.includes(w));
      const pokemonName = filtered.length > 0 ? filtered[filtered.length - 1] : words[words.length - 1];

      if (!pokemonName) {
        return response.status(400).json({ error: 'No se pudo identificar un Pokémon en la pregunta.' });
      }

      // 2. CONSULTAR AL SERVICIO DE POKÉMON (ej. pokeapi-zz36.onrender.com)
      const pokemonServiceUrl = `https://pokeapi-zz36.onrender.com/api/pokemon/${encodeURIComponent(pokemonName)}`;
      console.log(`[AI SERVICE] Consultando servicio de Pokémon: ${pokemonServiceUrl}`);

      const checkResponse = await fetch(pokemonServiceUrl);

      // 3. SI NO EXISTE EN LA BASE DE DATOS, RETORNAMOS EL ERROR DE AHORRO Y NO LLAMAMOS A GEMINI
      if (checkResponse.status === 404) {
        console.log(`[AI SERVICE] El Pokémon "${pokemonName}" no existe. Ahorrando consulta a Gemini.`);
        return response.status(404).json({
          error: 'no existe en la base de datos de la app. Ahorramos la consulta a Gemini.'
        });
      }

      if (!checkResponse.ok) {
        return response.status(502).json({ error: 'Error al verificar el Pokémon en el servicio de datos.' });
      }

      console.log(`[AI SERVICE] Pokémon "${pokemonName}" encontrado en la BD. Procediendo a consultar a Gemini...`);

      // 4. SI EXISTE, INVOCAMOS A GEMINI
      const gemini = new GoogleGenAI({ apiKey });
      const modelName = rawModel.replace(/^models\//, '');

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
      console.error('Error detallado en la ruta de IA:', error);
      return response.status(502).json({ error: error instanceof Error ? error.message : 'Error interno al procesar la solicitud.' });
    }
  });

  return router;
}