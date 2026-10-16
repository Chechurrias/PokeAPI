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
    uuid_generated_on_migration: { type: Boolean, select: false },
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
  }).select('_id uuid updated_at is_deleted +uuid_generated_on_migration').lean();
  const recordsToRepair = legacyRecords.filter(
    (record) =>
      typeof record.uuid !== 'string' ||
      !UUID_V4_PATTERN.test(record.uuid) ||
      !record.updated_at ||
      typeof record.is_deleted !== 'boolean'
  );
  let repairedUuidCount = 0;

  for (const record of recordsToRepair) {
    const updates = {};
    if (typeof record.uuid !== 'string' || !UUID_V4_PATTERN.test(record.uuid)) {
      updates.uuid = randomUUID();
      updates.uuid_generated_on_migration = true;
      repairedUuidCount++;
    }
    if (!record.updated_at) updates.updated_at = new Date(0);
    if (typeof record.is_deleted !== 'boolean') updates.is_deleted = false;
    await model.updateOne({ _id: record._id }, { $set: updates });
  }

  await model.collection.createIndex({ uuid: 1 }, { unique: true, name: 'profesor_uuid_unique' });
  return { repairedUuidCount };
}

export async function upsertProfesorByUuid(model, payload) {
  return upsertProfesorByUuidWithOptions(model, payload, {});
}

async function upsertProfesorByUuidWithOptions(model, payload, { deduplicateByCoreFields = false }) {
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

  if (deduplicateByCoreFields) {
    const matchingQuery = model.findOne({
      name: payload.name,
      apellido: payload.apellido,
      Profesion: payload.Profesion,
      is_deleted: { $ne: true },
    });
    if (typeof matchingQuery.collation === 'function') {
      matchingQuery.collation({ locale: 'es', strength: 1 });
    }
    if (typeof matchingQuery.select === 'function') {
      matchingQuery.select('+uuid_generated_on_migration');
    }
    const matchingProfesor = await matchingQuery.lean();
    if (matchingProfesor) {
      const matchingUuidIsValid =
        typeof matchingProfesor.uuid === 'string' && UUID_V4_PATTERN.test(matchingProfesor.uuid);
      const matchingUuid = matchingUuidIsValid && matchingProfesor.uuid_generated_on_migration !== true
        ? matchingProfesor.uuid
        : uuid;

      if (matchingUuid !== matchingProfesor.uuid) {
        await model.updateOne(
          { _id: matchingProfesor._id },
          [
            { $set: { uuid: { $literal: matchingUuid } } },
            { $unset: 'uuid_generated_on_migration' },
          ]
        );
      }

      return upsertProfesorByUuidWithOptions(
        model,
        { ...payload, uuid: matchingUuid },
        {}
      );
    }
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
    [
      { $set: set },
      { $unset: 'uuid_generated_on_migration' },
    ],
    { upsert: true, runValidators: true }
  );
  return model.findOne({ uuid }).lean();
}

export async function createProfesorWithoutDuplicate(model, payload) {
  return upsertProfesorByUuidWithOptions(model, payload, { deduplicateByCoreFields: true });
}
