import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, db } from '../lib/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

export default function QRScreen() {
  const router = useRouter();
  const user   = auth.currentUser;

  const [info, setInfo] = React.useState<{
    uid: string;
    gymId: string | null;
    gymName?: string;
    package?: any;
  } | null>(null);

  /* pull profile, then gym name if missing */
  React.useEffect(() => {
    if (!user) return;
    (async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const d    = snap.data() as any;
      let gymName = d?.gymName;
      if (!gymName && d?.gymId) {
        const g = await getDoc(doc(db, 'gyms', d.gymId));
        if (g.exists()) gymName = (g.data() as any).name ?? (g.data() as any).gymName;
      }
      setInfo({
        uid: user.uid,
        gymId: d?.gymId ?? null,
        gymName,
        package: d?.selectedPackage ?? d?.package,
      });
    })();
  }, [user]);

  if (!info) {
    return (
      <View style={[styles.bg, styles.center]}>
        <MaterialCommunityIcons name="loading" size={32} color="#fff" />
      </View>
    );
  }

  const payload = JSON.stringify({ uid: info.uid, gymId: info.gymId });

  return (
    <LinearGradient colors={['#312e81', '#4f46e5', '#7c3aed']} style={styles.bg}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
      </Pressable>

      <View style={styles.center}>
        <QRCode value={payload} size={240} color="#fff" backgroundColor="transparent" />

        <Text style={styles.name}>{auth.currentUser?.displayName}</Text>
        <Text style={styles.sub}>
          {info.gymName ?? 'No gym selected'}
        </Text>
        {info.package && (
          <Text style={styles.pkg}>Package: {info.package.name ?? info.package}</Text>
        )}

        <Text style={styles.msg}>Present this QR at the gym front desk.</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 34, left: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 24 },
  sub: { color: '#c7d2fe', marginTop: 4 },
  pkg: { color: '#e0e7ff', marginTop: 2, fontStyle: 'italic' },
  msg: { color: '#cbd5e1', marginTop: 24, textAlign: 'center', paddingHorizontal: 32 },
});
