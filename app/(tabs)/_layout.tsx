import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { RickProvider } from '@/context/RickContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

function RickyMortyTabIcon({ color }: Readonly<{ color: ColorValue }>) {
  return <MaterialIcons size={25} name="groups" color={color} />;
}

function InfoRickTabIcon({ color }: Readonly<{ color: ColorValue }>) {
  return <MaterialIcons size={24} name="info-outline" color={color} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <RickProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme].tint,
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="RickyMorty"
          options={{
            title: 'Rick y Morty',
            tabBarIcon: RickyMortyTabIcon,
          }}
        />
        <Tabs.Screen
          name="InfoRick"
          options={{
            title: 'Info Rick',
            tabBarIcon: InfoRickTabIcon,
          }}
        />
      </Tabs>
    </RickProvider>
  );
}