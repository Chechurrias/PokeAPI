// Importa un componente personalizado para los botones de la barra de pestañas que activa respuesta háptica (vibración leve al tocar).
import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { ProfesoresProvider } from '@/context/ProfesoresContext';
import { RickProvider } from '@/context/RickContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router'; // Importa el componente Tabs (barra de pestañas) y el hook usePathname (para leer la ruta actual) de Expo Router.
import type { ColorValue } from 'react-native'; // Importa el tipo TypeScript ColorValue para validar los colores asignados a los iconos de React Native.


// --- COMPONENTES AUXILIARES PARA LOS ICONOS DE LAS PESTAÑAS ---

// Componente funcional que renderiza el icono para cada pestaña de la app.
function RickyMortyTabIcon({ color }: Readonly<{ color: ColorValue }>) {
  return <MaterialIcons size={25} name="groups" color={color} />;
}
function InfoRickTabIcon({ color }: Readonly<{ color: ColorValue }>) {
  return <MaterialIcons size={24} name="info-outline" color={color} />;
}
function ProfesoresTabIcon({ color }: Readonly<{ color: ColorValue }>) {
  return <MaterialIcons size={25} name="school" color={color} />;
}
function PokeAPITabIcon({ color }: Readonly<{ color: ColorValue }>) {
  return <MaterialIcons size={25} name="catching-pokemon" color={color} />;
}
function infoPokeAPI({ color }: Readonly<{ color: ColorValue }>) {
  return <MaterialIcons size={25} name="info-outline" color={color} />;
}
function HomeTabIcon({ color }: Readonly<{ color: ColorValue }>) {
  return <MaterialIcons size={25} name="home" color={color} />;
}

// --- COMPONENTE PRINCIPAL DE NAVEGACIÓN ---

export default function TabLayout() {
  // Evalúa el tema actual del dispositivo ('dark' o 'light') garantizando que siempre sea una de esas dos cadenas.
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  // Obtiene la ruta relativa activa en la que se encuentra navegando el usuario (ej. "/RickyMorty").
  const pathname = usePathname();

  // Detecta la sección activa para mostrar solo sus pestañas relacionadas.
  const isRickSection = pathname.endsWith('/RickyMorty') || pathname.endsWith('/InfoRick');
  const isProfesSection = pathname.endsWith('/Profes');
  // PokéAPI usa las rutas reales index (/) y explore (/explore).
  const isPokeSection = pathname === '/' || pathname.endsWith('/explore');


  return (
    // Envuelve toda la navegación en el RickProvider para que las pestañas accedan a los datos de Rick y Morty.
    <RickProvider>
      {/* Envuelve las pestañas en ProfesoresProvider para dar acceso a los datos de la base de datos de profesores. */}
      <ProfesoresProvider>
        {/* Contenedor principal de pestañas de Expo Router */}
        <Tabs
          screenOptions={{
            // Define el color del icono/texto activo según el tema (Dark/Light) usando la paleta del tema.
            tabBarActiveTintColor: Colors[colorScheme].tint,
            // Oculta el encabezado superior (header) nativo por defecto en todas las pantallas.
            headerShown: false,
            // Reemplaza el botón de pestaña por defecto con el componente que da la vibración háptica al presionar.
            tabBarButton: HapticTab,
          }}
        >
          {/* Pantalla "home" (Inicio) */}
          <Tabs.Screen
            name="home"
            options={{
              title: 'Inicio',
              tabBarIcon: HomeTabIcon,
              tabBarStyle: { display: 'none' }, // Oculta la barra de pestañas completamente cuando se está en Home.
            }}
          />

          {/* Pestaña de consulta Pokémon; se oculta al entrar en otras secciones. */}
          <Tabs.Screen
            name="index"
            options={{
              title: 'PokeAPI',
              tabBarIcon: PokeAPITabIcon,
              href: isRickSection || isProfesSection ? null : undefined,
            }}
          />

          {/* Pestaña info PokeAPI (explore) */}
          <Tabs.Screen
            name="explore"
            options={{
              title: 'info PokeAPI',
              tabBarIcon: infoPokeAPI,
              href: isRickSection || isProfesSection ? null : undefined,
            }}
          />

          {/* Pantalla "RickyMorty" */}
          <Tabs.Screen
            name="RickyMorty"
            options={{
              title: 'Rick y Morty',
              tabBarIcon: RickyMortyTabIcon,
              href: isProfesSection || isPokeSection ? null : undefined,
            }}
                    />

                    {/* Pantalla "InfoRick" */}
          <Tabs.Screen
            name="InfoRick"
            options={{
              title: 'Info Rick',
              tabBarIcon: InfoRickTabIcon,
              href: isProfesSection || isPokeSection ? null : undefined,
            }}
          />

          {/* Pantalla "Profes" (Profesores) */}
          <Tabs.Screen
            name="Profes"
            options={{
              title: 'Profesores',
              tabBarIcon: ProfesoresTabIcon,
              // Oculta Profesores dentro de Rick y Morty o de PokéAPI.
              href: isRickSection || isPokeSection ? null : undefined,
            }}
          />


        </Tabs>
      </ProfesoresProvider>
    </RickProvider>
  );
}