import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

const ExperienceSchema = new mongoose.Schema(
  {
    company: String,
    role: String,
    period: String,
    description: String,
  },
  { _id: false }
);

const EducationSchema = new mongoose.Schema(
  {
    institution: String,
    degree: String,
    year: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const ContactSchema = new mongoose.Schema(
  { linkedin: String, website: String },
  { _id: false }
);

const ProfesorSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.Mixed, required: true },
    uuid: { type: String, required: true },
    updated_at: { type: Date, required: true },
    is_deleted: { type: Boolean, default: false },
    name: String,
    apellido: String,
    headline: String,
    Profesion: String,
    image: String,
    location: String,
    about: String,
    experience: [ExperienceSchema],
    education: [EducationSchema],
    skills: [String],
    contact: ContactSchema,
  },
  { collection: 'datos' }
);

const Profesor = mongoose.models.Profesor ?? mongoose.model('Profesor', ProfesorSchema);

export default Profesor;

const UUID_V4_PATTERN = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

export function getProfesorDatabaseId(id) {
  return /^[\da-f]{24}$/i.test(id) ? new mongoose.Types.ObjectId(id) : id;
}

export async function initializeProfesorCollection(model = Profesor) {
  const legacyRecords = await model.find({
    $or: [
      { uuid: { $exists: false } },
      { uuid: null },
      { uuid: { $not: UUID_V4_PATTERN } },
      { updated_at: { $exists: false } },
      { updated_at: null },
      { is_deleted: { $exists: false } },
    ],
  }).select({ _id: 1, uuid: 1, updated_at: 1, is_deleted: 1 }).lean();
  const recordsToRepair = legacyRecords.filter(
    (record) => typeof record.uuid !== 'string' || !UUID_V4_PATTERN.test(record.uuid)
  );

  for (const record of recordsToRepair) {
    const updates = {};
    if (typeof record.uuid !== 'string' || !UUID_V4_PATTERN.test(record.uuid)) {
      updates.uuid = randomUUID();
    }
    if (!record.updated_at) updates.updated_at = new Date(0);
    if (typeof record.is_deleted !== 'boolean') updates.is_deleted = false;
    await model.updateOne({ _id: record._id }, { $set: updates });
  }

  await model.collection.createIndex({ uuid: 1 }, { unique: true, name: 'profesor_uuid_unique' });
  return { repairedUuidCount: recordsToRepair.length };
}

export async function upsertProfesorByUuid(model, payload) {
  const uuid = typeof payload.uuid === 'string' && payload.uuid
    ? payload.uuid
    : randomUUID();
  if (!UUID_V4_PATTERN.test(uuid)) {
    const error = new Error('El campo uuid debe ser un UUID v4 válido.');
    error.statusCode = 400;
    throw error;
  }
  const updatedAt = payload.updated_at === undefined
    ? new Date()
    : new Date(payload.updated_at);

  if (Number.isNaN(updatedAt.getTime())) {
    const error = new Error('La marca updated_at no es una fecha válida.');
    error.statusCode = 400;
    throw error;
  }

  const fields = [
    'name', 'apellido', 'headline', 'Profesion', 'image', 'location', 'about',
    'experience', 'education', 'skills', 'contact',
  ];
  const newerTimestamp = {
    $gt: [updatedAt, { $ifNull: ['$updated_at', new Date(0)] }],
  };
  const set = {
    _id: { $ifNull: ['$_id', { $literal: uuid }] },
    uuid: { $literal: uuid },
    updated_at: { $cond: [newerTimestamp, { $literal: updatedAt }, '$updated_at'] },
    is_deleted: { $cond: [newerTimestamp, false, { $ifNull: ['$is_deleted', false] }] },
  };
  for (const field of fields) {
    if (payload[field] !== undefined) {
      set[field] = { $cond: [newerTimestamp, { $literal: payload[field] }, `$${field}`] };
    }
  }

  await model.updateOne(
    { uuid },
    [{ $set: set }],
    { upsert: true, runValidators: true }
  );
  return model.findOne({ uuid }).lean();
}
