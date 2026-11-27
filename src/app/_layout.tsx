import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
  useFonts,
} from '@expo-google-fonts/be-vietnam-pro';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useSync } from '@/sync/service';
import { useData } from '@/data/store';
import { useTheme } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
  });
  const loaded = useData((s) => s.loaded);
  const t = useTheme();

  useEffect(() => {
    void useData
      .getState()
      .init()
      .then(() => useSync.getState().start());
  }, []);

  useEffect(() => {
    if (fontsLoaded && loaded) void SplashScreen.hideAsync();
  }, [fontsLoaded, loaded]);

  if (!fontsLoaded || !loaded) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
    </SafeAreaProvider>
  );
}
