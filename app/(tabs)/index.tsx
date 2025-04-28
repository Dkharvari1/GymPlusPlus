import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';

/* Apple Health (iOS) — guarded so Expo Go doesn’t crash */
import AppleHealthKit, {
  HealthkitPermissions,
  HealthInputOptions,
  HealthValue,
} from 'react-native-health';

/* QR code */
import QRCode from 'react-native-qrcode-svg';

const { width } = Dimensions.get('window');
const CARD = (width - 64) / 2;   // quick-action grid cards
const METRIC = (width - 48) / 3;   // three health mini-cards

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  /* live UI state */
  const [stats, setStats] = useState<{ steps?: number; calories?: number; minutes?: number }>({});
  const [bookings, setBookings] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);

  /* wait for auth */
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  /* firestore listeners */
  useEffect(() => {
    if (!user) return;

    /* health doc (optional server-side) */
    const today = new Date().toISOString().slice(0, 10);
    const healthId = `${today}_${user.uid}`;
    const unsubHealth = onSnapshot(doc(db, 'health', healthId), s => {
      if (s.exists()) setStats(p => ({ ...p, ...(s.data() as any) }));
    });

    /* upcoming bookings (next 3) */
    const nowTS = Timestamp.now();
    const qBook = query(
      collection(db, 'bookings'),
      where('userId', '==', user.uid),
      where('start', '>=', nowTS),
      orderBy('start'),
      limit(3)
    );
    const unsubBook = onSnapshot(qBook, s =>
      setBookings(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    /* community messages (latest 3) */
    const unsubMsg = onSnapshot(
      query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(3)),
      s => setMessages(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => { unsubHealth(); unsubBook(); unsubMsg(); };
  }, [user]);

  /* Apple Health fetch (iOS builds only) */
  const fetchHealth = useCallback(() => {
    if (Platform.OS !== 'ios' || !AppleHealthKit?.initHealthKit) return;

    const perms: HealthkitPermissions = {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.StepCount,
          AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          AppleHealthKit.Constants.Permissions.AppleExerciseTime,
        ],
        write: [],
      },
    };

    AppleHealthKit.initHealthKit(perms, err => {
      if (err) return console.warn('HealthKit init error', err);
      const opts: HealthInputOptions = { date: new Date().toISOString() };

      AppleHealthKit.getStepCount(opts, (_e: string, r: HealthValue) =>
        r?.value !== undefined && setStats(p => ({ ...p, steps: Math.round(r.value) }))
      );
      AppleHealthKit.getActiveEnergyBurned(opts, (_e, r) =>
        r?.value !== undefined && setStats(p => ({ ...p, calories: Math.round(r.value) }))
      );
      AppleHealthKit.getAppleExerciseTime(opts, (_e, r) =>
        r?.value !== undefined && setStats(p => ({ ...p, minutes: Math.round(r.value) }))
      );
    });
  }, []);
  useEffect(fetchHealth, [fetchHealth]);

  if (!user) return null;

  /* greeting */
  const hr = new Date().getHours();
  const hi = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';

  /* quick-action grid (bookings FAB below) */
  const actions = [
    { icon: 'dumbbell', label: 'Start Workout', path: '/workout' },
    { icon: 'food-apple', label: 'Nutrition Log', path: '/nutrition' },
    { icon: 'chat', label: 'Community', path: '/chat' },
  ];

  return (
    <LinearGradient colors={['#7c3aed', '#4f46e5', '#312e81']} style={styles.bg}>
      {/* header */}
      <Text style={styles.hi}>{hi}, {user.displayName ?? 'Athlete'} 👋</Text>
      <Text style={styles.sub}>Here’s your snapshot today</Text>

      {/* health metrics row */}
      <View style={styles.metricRow}>
        <Metric icon="walk" label="Steps" value={stats.steps} />
        <Metric icon="fire" label="Calories" value={stats.calories} />
        <Metric icon="run-fast" label="Minutes" value={stats.minutes} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* bookings section */}
        <Section title="Upcoming Bookings"
          actionLabel="Reserve"
          onAction={() => router.push('/bookings')}>
          {bookings.length
            ? bookings.map(b => (
              <Line key={b.id}
                icon="calendar"
                title={b.title ?? 'Gym Booking'}
                sub={tsToStr(b.start)} />
            ))
            : <Empty text="No upcoming bookings" />}
        </Section>

        {/* community section */}
        <Section title="Community Updates">
          {messages.length
            ? messages.map(m => (
              <Line key={m.id}
                icon="message"
                title={m.senderName ?? 'Member'}
                sub={m.text} />
            ))
            : <Empty text="No new messages" />}
        </Section>

        {/* quick-action grid */}
        <View style={styles.grid}>
          {actions.map(a => (
            <Pressable key={a.label}
              style={styles.card}
              android_ripple={{ color: '#e5e7ff' }}
              onPress={() => router.push(a.path)}>
              <MaterialCommunityIcons name={a.icon} size={32} color="#4f46e5" />
              <Text style={styles.cardTxt}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* FAB – QR code */}
      <Pressable style={styles.fabQR}
        android_ripple={{ color: '#c7d2fe', radius: 34 }}
        onPress={() => router.push('/qr')}>
        <QRCode value={user.uid} size={38} color="#4f46e5" backgroundColor="transparent" />
      </Pressable>

      {/* FAB – booking shortcut */}
      <Pressable style={styles.fabBook}
        android_ripple={{ color: '#c7d2fe', radius: 34 }}
        onPress={() => router.push('/bookings')}>
        <MaterialCommunityIcons name="calendar-plus" size={32} color="#4f46e5" />
      </Pressable>
    </LinearGradient>
  );
}

/* ─── small components ─── */
const Metric = ({ icon, label, value }: any) => (
  <View style={styles.metric}>
    <MaterialCommunityIcons name={icon} size={22} color="#fff" />
    {value === undefined
      ? <ActivityIndicator color="#fff" style={{ marginVertical: 4 }} />
      : <Text style={styles.metricVal}>{value}</Text>}
    <Text style={styles.metricLbl}>{label}</Text>
  </View>
);

const Section = ({ title, children, actionLabel, onAction }: any) => (
  <View style={{ marginTop: 32 }}>
    <View style={styles.secHeader}>
      <Text style={styles.secTitle}>{title}</Text>
      {actionLabel && (
        <Pressable onPress={onAction}>
          <Text style={styles.secAction}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
    {children}
  </View>
);

const Line = ({ icon, title, sub }: any) => (
  <View style={styles.lineItem}>
    <MaterialCommunityIcons name={icon} size={22} color="#4f46e5" style={{ marginRight: 12 }} />
    <View style={{ flex: 1 }}>
      <Text style={styles.lineTitle}>{title}</Text>
      <Text style={styles.lineSub} numberOfLines={1}>{sub}</Text>
    </View>
  </View>
);

const Empty = ({ text }: any) => <Text style={styles.empty}>{text}</Text>;

const tsToStr = (ts: Timestamp) =>
  ts.toDate().toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });

/* ─── styles ─── */
const styles = StyleSheet.create({
  bg: { flex: 1, paddingTop: 60, paddingHorizontal: 24 },
  hi: { color: '#fff', fontSize: 28, fontWeight: '700' },
  sub: { color: '#e0e7ff', fontSize: 15, marginTop: 4 },

  metricRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  metric: {
    width: METRIC,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
    alignItems: 'center',
    paddingVertical: 14,
  },
  metricVal: { color: '#fff', fontSize: 22, fontWeight: '700', marginVertical: 4 },
  metricLbl: { color: '#c7d2fe', fontSize: 12 },

  secHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  secTitle: { color: '#cbd5e1', fontSize: 15, fontWeight: '600' },
  secAction: { color: '#4f46e5', fontSize: 14, fontWeight: '600' },

  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  lineTitle: { fontWeight: '600', color: '#1e293b' },
  lineSub: { color: '#64748b', fontSize: 13, marginTop: 2 },

  empty: { color: '#94a3b8', fontStyle: 'italic', marginBottom: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 24, paddingBottom: 90 },
  card: {
    width: CARD,
    height: CARD,
    margin: 8,
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTxt: { marginTop: 8, fontSize: 15, fontWeight: '600', color: '#4f46e5', textAlign: 'center' },

  /* floating buttons */
  fabQR: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabBook: {
    position: 'absolute',
    bottom: 110,           /* 72 + 14 + shadow gap */
    right: 24,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
