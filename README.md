# Welcome to your Expo app 👋

## Microservicio Node.js

El proyecto incluye un microservicio en `server/` que consulta PokeAPI y entrega la respuesta al front mediante `GET /api/pokemon/:name`.

1. Instala las dependencias del servicio:

   ```bash
   cd server
   npm install
   npm run dev
   ```

2. Configura la URL que usará Expo copiando `.env.example` como `.env`:

   - Web o simulador iOS: `http://localhost:3000`
   - Emulador Android: `http://10.0.2.2:3000`
   - Teléfono físico: `http://IP_DE_TU_PC:3000` y conecta ambos dispositivos a la misma red.

3. Reinicia Expo después de cambiar `EXPO_PUBLIC_API_URL`:

   ```bash
   npm start
   ```

Puedes comprobar el servicio con `http://localhost:3000/health` o `http://localhost:3000/api/pokemon/pikachu`.

## Microservicio Rick y Morty con MongoDB Atlas

El servicio Python consulta la colección `characters` de la base `rickandmorty` en MongoDB Atlas. Configura `MONGODB_URI` en el entorno del servicio; no guardes la URI ni la contraseña en el repositorio. En Atlas, permite el acceso de red desde Render y concede al usuario de base de datos permisos de lectura sobre esa base.

Para ejecutarlo localmente, instala sus dependencias, crea `server/.env` desde la plantilla y reemplaza usuario y contraseña por los de MongoDB Atlas. Si la contraseña incluye caracteres especiales, codifícala para URL. No subas `server/.env` a Git.

```bash
cd server
pip install -r requirements-rick.txt
Copy-Item .env.example .env
python -m uvicorn serverRick:app --app-dir src --env-file .env --host 0.0.0.0 --port 8000
```

El servicio queda en `http://localhost:8000`; primero comprueba `/health` y confirma que responda `"db": true`, después prueba `/api/character/1` o `/api/characters`. La app Expo lee `EXPO_PUBLIC_RICK_API_URL` desde el `.env` de la raíz; para un teléfono físico usa `http://IP_DE_TU_PC:8000`. Reinicia Expo después de cambiar esta URL.

Render despliega las APIs de Pokémon, Rick y Morty, consulta de profesores, creación de profesores, modificación de profesores y eliminación de profesores como servicios independientes. Para cada servicio de profesores configura `MONGODB_URI`, `PROFESORES_MONGODB_DATABASE=Profesores` y `ALLOWED_ORIGINS`. El servicio `profesores-api` consulta perfiles; `add-profesores-api` crea perfiles mediante `POST /api/profesores` y MongoDB genera automáticamente el `_id`; `mod-profesores-api` modifica perfiles mediante `PATCH /api/profesores/:id`; y `del-profesores-api` elimina perfiles mediante `DELETE /api/profesores/:id`. En las rutas de modificación y eliminación, `:id` es el `_id` de MongoDB. Los servicios de escritura verifican disponibilidad en `/health`.

En el entorno de Expo configura `EXPO_PUBLIC_PROFESORES_API_URL` con la URL pública de `profesores-api`, `EXPO_PUBLIC_ADD_PROFESORES_API_URL` con la URL pública de `add-profesores-api`, `EXPO_PUBLIC_MOD_PROFESORES_API_URL` con la URL pública de `mod-profesores-api` y `EXPO_PUBLIC_DEL_PROFESORES_API_URL` con la URL pública de `del-profesores-api`, todas sin barra final. Reinicia o vuelve a compilar Expo después de cambiar esas variables.

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

### Profesores sin conexión

En Android e iOS, la app mantiene una copia local de los profesores en SQLite y una cola persistente de operaciones pendientes. Cada profesor usa un UUID v4 como clave estable y `updated_at` para resolver conflictos; el servidor acepta una escritura solo cuando su marca de tiempo es más nueva. Al sincronizar una creación, el servicio también busca una coincidencia por nombre, apellido y profesión (sin distinguir mayúsculas ni tildes): reutiliza el UUID del registro que ya existe en la nube o, si la migración había generado uno por falta de UUID, adopta el UUID de SQLite. La cola se reintenta automáticamente mientras la app está activa, al recuperar la conexión y desde el aviso de cambios pendientes. Las eliminaciones se conservan como tombstones en la nube para que una sincronización posterior no restaure un registro borrado. Al abrir una base local antigua, la app migra sus IDs enteros a UUID y conserva las operaciones pendientes.

La sincronización necesita `EXPO_PUBLIC_PROFESORES_API_URL`, `EXPO_PUBLIC_ADD_PROFESORES_API_URL`, `EXPO_PUBLIC_MOD_PROFESORES_API_URL` y `EXPO_PUBLIC_DEL_PROFESORES_API_URL`, documentadas arriba. La versión web sigue usando la API en línea y no ofrece la caché SQLite sin conexión.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
