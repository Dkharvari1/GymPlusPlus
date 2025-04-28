// app/(tabs)/index.tsx

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
  getDoc,
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
import AppleHealthKit from 'react-native-health';

/* QR code */
import QRCode from 'react-native-qrcode-svg';

const { width } = Dimensions.get('window');
const METRIC = (width - 48) / 3; // three health mini-cards

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  /* live UI state */
  const [stats, setStats] = useState<{
    steps?: number;
    calories?: number;
    minutes?: number;
  }>({});
  const [bookings, setBookings] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  /* wait for auth */
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  /* subscribe to announcements for this user’s gym */
  useEffect(() => {
    if (!user) return;
    let unsubAnn: () => void;

    (async () => {
      // look up this member’s gymId
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const gymId = userSnap.exists() ? (userSnap.data() as any).gymId : null;
      if (!gymId) return;

      // subscribe to the gym’s announcements, newest first
      const qAnn = query(
        collection(db, 'announcements'),
        where('gymId', '==', gymId),
        orderBy('createdAt', 'desc')
      );
      unsubAnn = onSnapshot(
        qAnn,
        snap => {
          setAnnouncements(
            snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
          );
        },
        e => console.warn('announcements query error', e)
      );
    })();

    return () => unsubAnn && unsubAnn();
  }, [user]);

  /* firestore listeners for health, bookings, messages */
  useEffect(() => {
    if (!user) return;

    /* health doc (optional server-side) */
    const today = new Date().toISOString().slice(0, 10);
    const healthId = `${today}_${user.uid}`;
    const unsubHealth = onSnapshot(
      doc(db, 'health', healthId),
      s => {
        if (s.exists()) setStats(p => ({ ...p, ...(s.data() as any) }));
      },
      e => console.warn('health query error', e)
    );

    /* all bookings */
    const qBook = query(
      collection(db, 'bookings'),
      where('userId', '==', user.uid)
    );
    const unsubBook = onSnapshot(
      qBook,
      snap => {
        const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        // sort ascending by start time
        arr.sort((a, b) => {
          const aMs = (a.start as Timestamp).toDate().getTime();
          const bMs = (b.start as Timestamp).toDate().getTime();
          return aMs - bMs;
        });
        setBookings(arr);
      },
      e => console.warn('bookings query error', e)
    );

    /* community messages (latest 3) */
    const unsubMsg = onSnapshot(
      query(
        collection(db, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(3)
      ),
      snap =>
        setMessages(
          snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
        ),
      e => console.warn('messages query error', e)
    );

    return () => {
      unsubHealth();
      unsubBook();
      unsubMsg();
    };
  }, [user]);

  /* Apple Health fetch (iOS builds only) */
  const fetchHealth = useCallback(() => {
    if (Platform.OS !== 'ios' || !AppleHealthKit?.initHealthKit) return;
    // HealthKit code is commented out for now
  }, []);
  useEffect(fetchHealth, [fetchHealth]);

  if (!user) return null;

  /* greeting */
  const hr = new Date().getHours();
  const hi = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <LinearGradient
      colors={['#7c3aed', '#4f46e5', '#312e81']}
      style={styles.bg}
    >
      {/* header */}
      <Text style={styles.hi}>
        {hi}, {user.displayName ?? 'Athlete'} 👋
      </Text>
      <Text style={styles.sub}>Here’s your snapshot today</Text>

      {/* health metrics row */}
      <View style={styles.metricRow}>
        <Metric icon="walk" label="Steps" value={stats.steps} />
        <Metric icon="fire" label="Calories" value={stats.calories} />
        <Metric icon="run-fast" label="Minutes" value={stats.minutes} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* bookings section */}
        <Section title="All Bookings">
          {bookings.length ? (
            bookings.map(b => (
              <Line
                key={b.id}
                icon="calendar"
                title={b.title ?? 'Gym Booking'}
                sub={tsToStr(b.start)}
              />
            ))
          ) : (
            <Empty text="No bookings yet" />
          )}
        </Section>

        {/* community section */}
        <Section title="Community Updates">
          {messages.length ? (
            messages.map(m => (
              <Line
                key={m.id}
                icon="message"
                title={m.senderName ?? 'Member'}
                sub={m.text}
              />
            ))
          ) : (
            <Empty text="No new messages" />
          )}
        </Section>

        {/* announcements section */}
        <Section title="Announcements">
          {announcements.length ? (
            announcements.map(a => (
              <View key={a.id} style={styles.announceCard}>
                <Text style={styles.announceTitle}>{a.title}</Text>
                <Text style={styles.announceDesc}>{a.description}</Text>
                <Text style={styles.announceTime}>
                  {a.createdAt
                    ?.toDate()
                    .toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                </Text>
              </View>
            ))
          ) : (
            <Empty text="No announcements" />
          )}
        </Section>
      </ScrollView>

      {/* FAB – QR code */}
      <Pressable
        style={styles.fabQR}
        android_ripple={{ color: '#c7d2fe', radius: 34 }}
        onPress={() => router.push('/qr')}
      >
        <QRCode
          value={user.uid}
          size={38}
          color="#4f46e5"
          backgroundColor="transparent"
        />
      </Pressable>

      {/* FAB – booking shortcut */}
      <Pressable
        style={styles.fabBook}
        android_ripple={{ color: '#c7d2fe', radius: 34 }}
        onPress={() => router.push('/bookings')}
      >
        <MaterialCommunityIcons
          name="calendar-plus"
          size={32}
          color="#4f46e5"
        />
      </Pressable>
    </LinearGradient>
  );
}

/* --- sub-components --- */
const Metric = ({ icon, label, value }: any) => (
  <View style={styles.metric}>
    <MaterialCommunityIcons name={icon} size={22} color="#fff" />
    {value === undefined ? (
      <ActivityIndicator color="#fff" style={{ marginVertical: 4 }} />
    ) : (
      <Text style={styles.metricVal}>{value}</Text>
    )}
    <Text style={styles.metricLbl}>{label}</Text>
  </View>
);

const Section = ({ title, children }: any) => (
  <View style={{ marginTop: 32 }}>
    <Text style={styles.secTitle}>{title}</Text>
    {children}
  </View>
);

const Line = ({ icon, title, sub }: any) => (
  <View style={styles.lineItem}>
    <MaterialCommunityIcons
      name={icon}
      size={22}
      color="#4f46e5"
      style={{ marginRight: 12 }}
    />
    <View style={{ flex: 1 }}>
      <Text style={styles.lineTitle}>{title}</Text>
      <Text style={styles.lineSub} numberOfLines={1}>
        {sub}
      </Text>
    </View>
  </View>
);

const Empty = ({ text }: any) => (
  <Text style={styles.empty}>{text}</Text>
);

const tsToStr = (ts: Timestamp) =>
  ts.toDate().toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });

/* --- styles --- */
const styles = StyleSheet.create({
  bg: { flex: 1, paddingTop: 60, paddingHorizontal: 24 },
  hi: { color: '#fff', fontSize: 28, fontWeight: '700' },
  sub: { color: '#e0e7ff', fontSize: 15, marginTop: 4 },

  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  metric: {
    width: METRIC,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
    alignItems: 'center',
    paddingVertical: 14,
  },
  metricVal: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginVertical: 4,
  },
  metricLbl: { color: '#c7d2fe', fontSize: 12 },

  secTitle: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },

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

  announceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  announceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  announceDesc: { marginTop: 4, color: '#475569' },
  announceTime: {
    marginTop: 6,
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'right',
  },

  empty: {
    color: '#94a3b8',
    fontStyle: 'italic',
    marginBottom: 4,
    textAlign: 'center',
  },

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
  },
  fabBook: {
    position: 'absolute',
    bottom: 110,
    right: 24,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
