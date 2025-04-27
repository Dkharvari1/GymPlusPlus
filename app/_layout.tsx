// app/_layout.tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, Slot, SplashScreen, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';

SplashScreen.preventAutoHideAsync();      // (optional) keep native splash up

export default function RootLayout() {
  /* — your auth / redirect logic — */
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<null | object>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setReady(true);
      SplashScreen.hideAsync();
    });
    return unsub;
  }, []);

  /* redirect once we know auth + current stack */
  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    if (user && inAuth) router.replace('/(tabs)');
  }, [ready, user, segments]);

  /* 1️⃣  ALWAYS render a navigator
     2️⃣  Wrap it in GestureHandlerRootView */
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* or simply:  <Slot />  if you’re not customising screens here */}
        <Slot />
      </Stack>
    </GestureHandlerRootView>
  );
}
