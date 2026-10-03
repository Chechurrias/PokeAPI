import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';

const app = express();
app.disable('x-powered-by');
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? 'http://localhost:8081,http://localhost:19006')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS.'));
  },
}));
app.use(express.json());

const mongoUri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
if (!mongoUri) {
  throw new Error('MONGODB_URI no está configurada para el microservicio de profesores.');
}

// Esquema alineado con la colección "datos"
const ProfesorSchema = new mongoose.Schema(
  {
    id: Number,
    name: String,
    apellido: String,
    Profesion: String,
    location: {
      name: String,
      url: String,
    },
  },
  { collection: 'datos' }
);

const Profesor = mongoose.model('Profesor', ProfesorSchema);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

app.get('/api/profesores/datos', async (req, res) => {
  const search = String(req.query.search ?? '').trim();

  try {
    let filter = {};

    // Si viene parámetro de búsqueda, aplicamos los filtros Regex / ID
    if (search) {
      const words = search.split(/\s+/).map((word) => new RegExp(escapeRegex(word), 'i'));
      filter = /^\d+$/.test(search)
        ? { id: Number(search) }
        : {
            $and: words.map((word) => ({$or: [
                { name: word },
                { apellido: word },
                { Profesion: word },
                { 'location.name': word },
              ],
            })),
          };
    }

    // Si search está vacío, filter es {} (trae todos los profesores)
    const profesores = await Profesor.find(filter).limit(50).lean();
    res.json(profesores);
  } catch (error) {
    console.error('Error al consultar profesores:', error.message);
    res.status(500).json({ error: 'Error interno al consultar la base de datos' });
  }
});

const port = Number(process.env.PORT ?? 8000);

// Aseguramos minúscula 'profesores' por defecto si MONGODB_DATABASE no existe
await mongoose.connect(mongoUri, {
  dbName: process.env.PROFESORES_MONGODB_DATABASE ?? 'Profesores',
});
app.listen(port, '0.0.0.0', () =>
  console.log(`🚀 Microservicio de profesores escuchando en puerto ${port}`)
);