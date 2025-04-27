import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  Pressable,
  ActivityIndicator,
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

const { width } = Dimensions.get('window');
const CARD = (width - 64) / 2;  // grid card size
const METRIC = (width - 48) / 3;  // 3 mini-cards

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  /* live data */
  const [stats, setStats] = useState<{ steps?: number; calories?: number; minutes?: number }>({});
  const [bookings, setBookings] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);

  /* wait for auth */
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  /* subscribe to today’s health, upcoming bookings, chat */
  useEffect(() => {
    if (!user) return;

    /* ---------- health doc ---------- */
    const today = new Date().toISOString().slice(0, 10);           // YYYY-MM-DD
    const healthId = `${today}_${user.uid}`;
    const unsubHealth = onSnapshot(doc(db, 'health', healthId), snap => {
      if (snap.exists()) setStats(snap.data() as any);
    });

    /* ---------- bookings ---------- */
    const nowTS = Timestamp.now();
    const qBook = query(
      collection(db, 'bookings'),
      where('userId', '==', user.uid),
      where('start', '>=', nowTS),
      orderBy('start'),
      limit(3)
    );
    const unsubBook = onSnapshot(qBook, snap => {
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    /* ---------- community messages ---------- */
    const qMsg = query(
      collection(db, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const unsubMsg = onSnapshot(qMsg, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubHealth();
      unsubBook();
      unsubMsg();
    };
  }, [user]);

  if (!user) return null;

  /* --------- Feature grid --------- */
  const features = [
    { icon: 'dumbbell', label: 'Start Workout', path: '/workout' },
    { icon: 'calendar', label: 'Reserve Area', path: '/booking' },
    { icon: 'account-tie', label: 'Book Trainer', path: '/trainers' },
    { icon: 'food-apple', label: 'Nutrition Log', path: '/nutrition' },
    { icon: 'chat', label: 'Community', path: '/chat' },
    { icon: 'qrcode-scan', label: 'QR Check-in', path: '/qr' },
  ];

  return (
    <LinearGradient
      colors={['#7c3aed', '#4f46e5', '#312e81']}
      style={styles.bg}
    >
      {/* header */}
      <Text style={styles.hi}>Hi, {user.displayName ?? 'Athlete'} 👋</Text>
      <Text style={styles.sub}>Here’s your snapshot today</Text>

      {/* metrics */}
      <View style={styles.metricRow}>
        <MetricCard icon="walk" label="Steps" value={stats.steps} />
        <MetricCard icon="fire" label="Calories" value={stats.calories} />
        <MetricCard icon="run-fast" label="Minutes" value={stats.minutes} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* bookings */}
        <Section title="Upcoming Bookings">
          {bookings.length ? bookings.map(b => (
            <LineItem
              key={b.id}
              title={b.title ?? 'Gym Booking'}
              sub={toDateTime(b.start)}
              icon="calendar"
            />
          )) : <EmptyMsg text="No upcoming bookings" />}
        </Section>

        {/* community */}
        <Section title="Community Updates">
          {messages.length ? messages.map(m => (
            <LineItem
              key={m.id}
              title={m.senderName ?? 'Member'}
              sub={m.text}
              icon="message"
            />
          )) : <EmptyMsg text="No new messages" />}
        </Section>

        {/* feature grid */}
        {/* <View style={styles.grid}>
          {features.map(f => (
            <Pressable
              key={f.label}
              style={styles.card}
              android_ripple={{ color: '#e5e7ff' }}
              onPress={() => router.push(f.path)}
            >
              <MaterialCommunityIcons name={f.icon} size={32} color="#4f46e5" />
              <Text style={styles.cardTxt}>{f.label}</Text>
            </Pressable>
          ))}
        </View> */}
      </ScrollView>
    </LinearGradient>
  );
}

/* — sub-components — */

function MetricCard({ icon, label, value }: { icon: any; label: string; value?: number }) {
  return (
    <View style={styles.metric}>
      <MaterialCommunityIcons name={icon} size={22} color="#fff" />
      {value === undefined
        ? <ActivityIndicator color="#fff" style={{ marginVertical: 4 }} />
        : <Text style={styles.metricVal}>{value}</Text>}
      <Text style={styles.metricLbl}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 32 }}>
      <Text style={styles.secTitle}>{title}</Text>
      {children}
    </View>
  );
}

function LineItem({ title, sub, icon }: { title: string; sub: string; icon: any }) {
  return (
    <View style={styles.lineItem}>
      <MaterialCommunityIcons name={icon} size={22} color="#4f46e5" style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.lineTitle}>{title}</Text>
        <Text style={styles.lineSub} numberOfLines={1}>{sub}</Text>
      </View>
    </View>
  );
}

function EmptyMsg({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

function toDateTime(ts: any) {
  const date = ts?.toDate?.() ?? new Date();
  return date.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
}

/* — styles — */

const styles = StyleSheet.create({
  bg: { flex: 1, paddingTop: 60, paddingHorizontal: 24 },
  hi: { color: '#fff', fontSize: 28, fontWeight: '700' },
  sub: { color: '#e0e7ff', fontSize: 15, marginTop: 4 },

  metricRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  metric: {
    width: METRIC, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18, alignItems: 'center', paddingVertical: 14,
  },
  metricVal: { color: '#fff', fontSize: 22, fontWeight: '700', marginVertical: 4 },
  metricLbl: { color: '#c7d2fe', fontSize: 12 },

  secTitle: { color: '#cbd5e1', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  lineItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 18, padding: 12, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  lineTitle: { fontWeight: '600', color: '#1e293b' },
  lineSub: { color: '#64748b', fontSize: 13, marginTop: 2 },

  empty: { color: '#94a3b8', fontStyle: 'italic', marginBottom: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 24, paddingBottom: 80 },
  card: {
    width: CARD, height: CARD, margin: 8, backgroundColor: '#fff',
    borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  cardTxt: { marginTop: 8, fontSize: 15, fontWeight: '600', color: '#4f46e5', textAlign: 'center' },
});
