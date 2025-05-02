// app/scan-user.tsx
import React, {
    useEffect,
    useState,
    useCallback,
  } from 'react';
  import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Alert,
  } from 'react-native';
  import { useRouter, useFocusEffect } from 'expo-router';
  import {
    CameraView,
    BarcodeScanningResult,
    PermissionStatus,
    useCameraPermissions,
  } from 'expo-camera';
  import { MaterialCommunityIcons } from '@expo/vector-icons';
  
  import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    getDoc,
    updateDoc,
    increment,
    Timestamp,
  } from 'firebase/firestore';
  import { auth, db } from '../../lib/firebaseConfig';
import { CameraType} from 'expo-image-picker';
  
  export default function ScanUser() {
    const router = useRouter();
  
    /* 1) camera permission */
    const [perm, requestPerm] = useCameraPermissions();
    const status = perm?.status ?? PermissionStatus.UNDETERMINED;
  
    /* 2) owner’s gym id */
    const [gymId, setGymId] = useState<string | null>(null);
    useEffect(() => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const q = query(collection(db, 'gyms'), where('ownerUid', '==', uid));
      const unsub = onSnapshot(q, s =>
        setGymId(s.empty ? null : s.docs[0].id),
      );
      return unsub;
    }, []);
  
    /* 3) on‑screen state */
    const [scanned,   setScanned]   = useState(false);
    const [member,    setMember]    = useState<any | null>(null);
    const [checkedIn, setCheckedIn] = useState(false);
  
    /* 4) reset every time the screen (re)gains focus, and also on blur */
    useFocusEffect(
      useCallback(() => {
        setScanned(false);
        setMember(null);
        setCheckedIn(false);
        return () => {
          setScanned(false);
          setMember(null);
          setCheckedIn(false);
        };
      }, []),
    );
  
    /* 5) scan handler */
    const handleScan = async (res: BarcodeScanningResult) => {
      if (scanned) return;
      setScanned(true);
  
      try {
        const { uid, gymId: userGym } = JSON.parse(res.data);
        if (!uid) throw new Error('Invalid QR');
  
        if (!gymId || gymId !== userGym) {
          Alert.alert('Wrong gym', 'This member belongs to a different gym.');
          return setTimeout(() => setScanned(false), 1500);
        }
  
        const snap = await getDoc(doc(db, 'users', uid));
        if (!snap.exists()) throw new Error('User not found');
        setMember({ id: uid, ...(snap.data() as any) });
      } catch (err: any) {
        Alert.alert('Error', err.message ?? 'Could not read QR');
        setTimeout(() => setScanned(false), 1500);
      }
    };
  
    /* 6) Firestore check‑in (map approach retained) */
    const checkIn = async () => {
      if (!member) return;
      const today = new Date();
      const key   = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  
      await updateDoc(doc(db, 'users', member.id), {
        lastCheckIn: Timestamp.now(),
        [`checkins.${key}`]: increment(1),
      });
  
      setCheckedIn(true);
    };
  
    /* ─── UI STATES ─── */
  
    if (status !== PermissionStatus.GRANTED) {
      return (
        <View style={styles.center}>
          <Text style={styles.txt}>
            Camera permission {status === PermissionStatus.DENIED ? 'denied' : 'required'}.
          </Text>
          <Pressable style={styles.btn} onPress={requestPerm}>
            <Text style={styles.btnTxt}>Request permission</Text>
          </Pressable>
        </View>
      );
    }
  
    if (checkedIn) {
      return (
        <View style={[styles.center, { backgroundColor: '#22c55e' }]}>
          <MaterialCommunityIcons name="check-decagram" size={72} color="#fff" />
          <Text style={styles.doneTxt}>Checked In</Text>
          <Pressable
            style={[styles.btn, { backgroundColor: '#16a34a' }]}
            onPress={() => router.back()}
          >
            <Text style={styles.btnTxt}>Back to members</Text>
          </Pressable>
        </View>
      );
    }
  
    return (
      <View style={{ flex: 1 }}>
        {!member ? (
          <>
            <CameraView
              style={{ flex: 1 }}
              facing={CameraType.back}
              onBarcodeScanned={handleScan}
            />
            {scanned && (
              <ActivityIndicator
                size="large"
                color="#fff"
                style={StyleSheet.absoluteFill}
              />
            )}
            <Pressable style={styles.back} onPress={() => router.back()}>
              <MaterialCommunityIcons name="close" size={28} color="#fff" />
            </Pressable>
          </>
        ) : (
          <View style={styles.center}>
            <Text style={styles.h1}>{member.username ?? member.displayName}</Text>
            <Text style={styles.line}>Email: {member.email}</Text>
            {member.selectedPackage && (
              <Text style={styles.line}>
                Package: {member.selectedPackage.name ?? member.selectedPackage}
              </Text>
            )}
            {member.goal && <Text style={styles.line}>Goal: {member.goal}</Text>}
  
            <Pressable style={styles.btn} onPress={checkIn}>
              <Text style={styles.btnTxt}>Check In</Text>
            </Pressable>
  
            <Pressable
              style={[styles.btn, { backgroundColor: '#475569', marginTop: 14 }]}
              onPress={() => {
                setMember(null);
                setScanned(false);
              }}
            >
              <Text style={styles.btnTxt}>Scan another</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }
  
  /* ── styles ─────────────────────────────────────────────── */
  const styles = StyleSheet.create({
    back: {
      position: 'absolute',
      top: 54,
      left: 24,
      padding: 4,
    },
    center: {
      flex: 1,
      backgroundColor: '#312e81',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    txt: { color: '#fff', fontSize: 16, textAlign: 'center' },
    h1: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 12 },
    line: { color: '#cbd5e1', marginTop: 4 },
    btn: {
      marginTop: 24,
      backgroundColor: '#4f46e5',
      paddingHorizontal: 36,
      paddingVertical: 10,
      borderRadius: 24,
    },
    btnTxt: { color: '#fff', fontWeight: '600' },
    doneTxt: { color: '#fff', fontSize: 28, fontWeight: '700', marginVertical: 16 },
  });
  