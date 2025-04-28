// app/_layout.tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, Slot, SplashScreen, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';
//import { useNutritionStore } from '../lib/store/useNutritionStore';

import { AuthProvider } from '../context/AuthContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<null | object>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => { await SplashScreen.hideAsync(); })();
  }, []);

  // <==== ADD THIS HERE ====
  // useEffect(() => {
  //   if (user) useNutritionStore.getState().initLive();
  // }, [user]);
  // <========================

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    if (user && inAuth) router.replace('/(tabs)');
  }, [ready, user, segments]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
