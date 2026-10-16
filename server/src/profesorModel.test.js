import assert from 'node:assert/strict';
import test from 'node:test';
import { addProfesor } from './addProfes.js';
import { deleteProfesor } from './delProfes.js';
import { modifyProfesor } from './modProfes.js';
import Profesor, { initializeProfesorCollection, upsertProfesorByUuid } from './profesorModel.js';

const professorId = '65a1b2c3d4e5f60718293a4b';
const professorUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

function createFakeModel() {
  const records = [];
  return {
    records,
    upsertCalls: [],
    findOne({ uuid }) {
      return { lean: async () => records.find((record) => record.uuid === uuid) ?? null };
    },
    async updateOne(filter, pipeline, options) {
      this.upsertCalls.push({ filter, pipeline, options });
      let record = records.find((entry) => entry.uuid === filter.uuid);
      const set = pipeline[0].$set;
      const incomingDate = set.updated_at.$cond[0].$gt[0];
      const isNewer = !record || incomingDate > record.updated_at;
      if (!record) {
        record = { _id: filter.uuid, uuid: filter.uuid };
        records.push(record);
      }
      if (isNewer) {
        for (const [field, expression] of Object.entries(set)) {
          if (field === '_id') continue;
          if (expression && '$cond' in expression) {
            const value = expression.$cond[1];
            record[field] = value && '$literal' in value ? value.$literal : value;
          } else if (field === 'uuid' && '$literal' in expression) {
            record[field] = expression.$literal;
          }
        }
      }
    },
  };
}

test('upsert inserts once and only applies a strictly newer timestamp', async () => {
  const model = createFakeModel();
  const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const initial = await upsertProfesorByUuid(model, {
    uuid,
    updated_at: '2026-01-01T00:00:00.000Z',
    name: 'Ana',
  });
  const stale = await upsertProfesorByUuid(model, {
    uuid,
    updated_at: '2025-12-31T23:59:59.999Z',
    name: 'Dato obsoleto',
  });

  assert.equal(stale.name, 'Ana');
  assert.equal(model.records.length, 1);

  const newer = await upsertProfesorByUuid(model, {
    uuid,
    updated_at: '2026-01-01T00:00:00.001Z',
    name: 'Ana actualizada',
  });
  assert.equal(newer.name, 'Ana actualizada');
  assert.equal(newer.updated_at.toISOString(), '2026-01-01T00:00:00.001Z');
  assert.equal(initial.uuid, uuid);
  assert.equal(model.records.length, 1);
  assert.equal(model.upsertCalls.length, 3);
  assert.ok(model.upsertCalls.every((call) => call.options.upsert === true));
  assert.ok(model.upsertCalls.every((call) => call.filter.uuid === uuid));
});

test('upsert generates a UUID v4 when the Node.js service receives no UUID', async () => {
  const model = createFakeModel();
  const profesor = await upsertProfesorByUuid(model, { name: 'Luis' });

  assert.match(profesor.uuid, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  assert.ok(profesor.updated_at instanceof Date);
});

test('POST add generates and stores a UUID v4 when the client omits it', async () => {
  const model = createFakeModel();
  const profesor = await addProfesor(model, {
    name: 'Luis',
    apellido: 'Pérez',
    Profesion: 'Docente',
  });

  assert.match(profesor.uuid, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  assert.ok(profesor.updated_at instanceof Date);
  assert.equal(model.records[0].uuid, profesor.uuid);
  assert.equal(model.records[0]._id, profesor.uuid);
  assert.equal(profesor._id, profesor.uuid);
  assert.equal(model.records.length, 1);
});

test('the Mongo model uses the UUID v4 as the primary _id', () => {
  const profesor = new Profesor({
    _id: professorUuid,
    uuid: professorUuid,
    updated_at: new Date(),
    name: 'Luis',
  });

  assert.equal(profesor._id, professorUuid);
  assert.equal(profesor.validateSync(), undefined);
});

test('startup migration replaces malformed UUIDs on existing records', async () => {
  const record = {
    _id: '65a1b2c3d4e5f60718293a4b',
    uuid: 'legacy-object-id-value',
    updated_at: new Date(),
    is_deleted: false,
  };
  const updates = [];
  const model = {
    find() {
      return {
        select() {
          return { lean: async () => [record] };
        },
      };
    },
    async updateOne(filter, update) {
      updates.push({ filter, update });
      Object.assign(record, update.$set);
    },
    collection: {
      async createIndex() {},
    },
  };

  const migration = await initializeProfesorCollection(model);
  assert.match(record.uuid, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  assert.equal(migration.repairedUuidCount, 1);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].filter, { _id: record._id });
});

function createExistingProfessorModel() {
  const record = {
    _id: professorId,
    uuid: professorUuid,
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    name: 'Ana',
    apellido: 'Pérez',
    Profesion: 'Docente',
    is_deleted: false,
  };
  return {
    record,
    findById() {
      return { lean: async () => record };
    },
    findOneAndUpdate(filter, update) {
      return {
        lean: async () => {
          if (record.updated_at >= filter.updated_at.$lt) return null;
          Object.assign(record, update.$set);
          return record;
        },
      };
    },
  };
}

test('PATCH rejects stale data but applies a newer updated_at', async () => {
  const model = createExistingProfessorModel();
  const stale = await modifyProfesor(model, professorId, {
    uuid: professorUuid,
    updated_at: '2025-12-31T23:59:59.999Z',
    name: 'Obsoleta',
  });
  assert.equal(stale.name, 'Ana');

  const newer = await modifyProfesor(model, professorId, {
    uuid: professorUuid,
    updated_at: '2026-01-01T00:00:00.001Z',
    name: 'Ana actualizada',
  });
  assert.equal(newer.name, 'Ana actualizada');
  assert.equal(newer.updated_at.toISOString(), '2026-01-01T00:00:00.001Z');
});

test('DELETE stores a timestamped tombstone', async () => {
  const model = createExistingProfessorModel();
  const deleted = await deleteProfesor(model, professorId, {
    uuid: professorUuid,
    updated_at: '2026-01-01T00:00:00.001Z',
  });

  assert.equal(deleted.is_deleted, true);
  assert.equal(deleted.updated_at.toISOString(), '2026-01-01T00:00:00.001Z');
});
