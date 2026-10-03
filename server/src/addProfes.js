export class AddProfesorError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AddProfesorError';
    this.statusCode = statusCode;
  }
}

function readRequiredString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AddProfesorError(`El campo ${fieldName} es obligatorio.`);
  }

  return value.trim();
}

function readOptionalString(value, fieldName) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new AddProfesorError(`El campo ${fieldName} debe ser texto.`);
  }

  return value.trim() || undefined;
}

export async function addProfesor(Profesor, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AddProfesorError('El cuerpo de la solicitud debe ser un objeto JSON.');
  }

  const id = payload.id;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AddProfesorError('El ID debe ser un número entero positivo.');
  }

  const profesorData = {
    id,
    name: readRequiredString(payload.name, 'name'),
    apellido: readRequiredString(payload.apellido, 'apellido'),
    Profesion: readRequiredString(payload.Profesion, 'Profesion'),
  };

  for (const fieldName of ['headline', 'image', 'location', 'about']) {
    const value = readOptionalString(payload[fieldName], fieldName);
    if (value) profesorData[fieldName] = value;
  }

  const existingProfesor = await Profesor.exists({ id });
  if (existingProfesor) {
    throw new AddProfesorError(`Ya existe un profesor con el ID ${id}.`, 409);
  }

  return Profesor.create(profesorData);
}
