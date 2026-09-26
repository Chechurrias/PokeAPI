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

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

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
