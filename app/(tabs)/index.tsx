// app/(tabs)/index.tsx
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
import QRCode from 'react-native-qrcode-svg';

const { width } = Dimensions.get('window');
const METRIC = (width - 48) / 3;

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [gymId, setGymId] = useState<string | null>(null);
  const [stats, setStats] = useState<{ steps?: number; calories?: number; minutes?: number }>({});
  const [bookings, setBookings] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  /* auth listener */
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  /* user doc → gymId */
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      s => setGymId((s.data() as any)?.gymId ?? null),
      e => console.warn('user doc', e.code)
    );
    return unsub;
  }, [user]);

  /* gym-dependent announcements */
  useEffect(() => {
    if (!gymId) return;
    const q = query(
      collection(db, 'announcements'),
      where('gymId', '==', gymId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q,
      s => setAnnouncements(s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
      e => console.warn('announcements', e.code)
    );
    return unsub;
  }, [gymId]);

  /* non-gym data (bookings, messages) */
  useEffect(() => {
    if (!user) return;

    const unsubBook = onSnapshot(
      query(collection(db, 'bookings'), where('userId', '==', user.uid)),
      s => {
        const arr = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        arr.sort((a, b) => (a.start as Timestamp).toDate().getTime() - (b.start as Timestamp).toDate().getTime());
        setBookings(arr);
      }
    );

    const unsubMsg = onSnapshot(
      query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(3)),
      s => setMessages(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
    );

    return () => { unsubBook(); unsubMsg(); };
  }, [user]);

  if (!user) return null;

  const hr = new Date().getHours();
  const hi = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <LinearGradient colors={['#7c3aed', '#4f46e5', '#312e81']} style={styles.bg}>
      {/* greeting */}
      <Text style={styles.hi}>{hi}, {user.displayName ?? 'Athlete'} 👋</Text>
      <Text style={styles.sub}>Here’s your snapshot today</Text>

      {/* health metrics */}
      <View style={styles.metricRow}>
        <Metric icon="walk"      label="Steps"    value={stats.steps}    />
        <Metric icon="fire"      label="Calories" value={stats.calories} />
        <Metric icon="run-fast"  label="Minutes"  value={stats.minutes} />
      </View>

      {/* ───────── main body ───────── */}
      {!gymId ? (
        /* No gym selected */
        <View style={styles.noGymWrap}>
          <MaterialCommunityIcons name="dumbbell" size={68} color="#c7d2fe" />
          <Text style={styles.noGymTitle}>No gym selected</Text>
          <Text style={styles.noGymDesc}>
            Join a gym to see bookings, community updates, and announcements.
          </Text>

          <Pressable
            style={styles.joinBtn}
            android_ripple={{ color: '#c7d2fe' }}
            onPress={() => router.push('/profile')}
          >
            <MaterialCommunityIcons name="account-edit" size={20} color="#4f46e5" />
            <Text style={styles.joinTxt}>Open Profile</Text>
          </Pressable>
        </View>
      ) : (
        /* Gym selected */
        <>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* bookings */}
            <Section title="All Bookings">
              {bookings.length
                ? bookings.map(b => (
                    <Line key={b.id} icon="calendar" title={b.title ?? 'Gym Booking'} sub={tsToStr(b.start)} />
                  ))
                : <Empty text="No bookings yet" />}
            </Section>

            {/* community */}
            <Section title="Community Updates">
              {messages.length
                ? messages.map(m => (
                    <Line key={m.id} icon="message" title={m.senderName ?? 'Member'} sub={m.text} />
                  ))
                : <Empty text="No new messages" />}
            </Section>

            {/* announcements */}
            <Section title="Announcements">
              {announcements.length
                ? announcements.map(a => (
                    <View key={a.id} style={styles.announceCard}>
                      <Text style={styles.announceTitle}>{a.title}</Text>
                      <Text style={styles.announceDesc}>{a.description}</Text>
                      <Text style={styles.announceTime}>
                        {a.createdAt?.toDate().toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  ))
                : <Empty text="No announcements" />}
            </Section>
          </ScrollView>

          {/* FABs – shown only when gym exists */}
          <Pressable style={styles.fabQR} android_ripple={{ color: '#c7d2fe', radius: 34 }} onPress={() => router.push('/qr')}>
            <QRCode value={user.uid} size={38} color="#4f46e5" backgroundColor="transparent" />
          </Pressable>
          <Pressable style={styles.fabBook} android_ripple={{ color: '#c7d2fe', radius: 34 }} onPress={() => router.push('/bookings')}>
            <MaterialCommunityIcons name="calendar-plus" size={32} color="#4f46e5" />
          </Pressable>
        </>
      )}
    </LinearGradient>
  );
}

/* ─── sub-components ────────────────────────────────────────── */
const Metric = ({ icon, label, value }: any) => (
  <View style={styles.metric}>
    <MaterialCommunityIcons name={icon} size={22} color="#fff" />
    {value === undefined
      ? <ActivityIndicator color="#fff" style={{ marginVertical: 4 }} />
      : <Text style={styles.metricVal}>{value}</Text>}
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
    <MaterialCommunityIcons name={icon} size={22} color="#4f46e5" style={{ marginRight: 12 }} />
    <View style={{ flex: 1 }}>
      <Text style={styles.lineTitle}>{title}</Text>
      <Text style={styles.lineSub} numberOfLines={1}>{sub}</Text>
    </View>
  </View>
);

const Empty = ({ text }: any) => <Text style={styles.empty}>{text}</Text>;

const tsToStr = (ts: Timestamp) =>
  ts.toDate().toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });

/* ─── styles ────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  bg: { flex: 1, paddingTop: 60, paddingHorizontal: 24 },
  hi: { color: '#fff', fontSize: 28, fontWeight: '700' },
  sub: { color: '#e0e7ff', fontSize: 15, marginTop: 4 },

  metricRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  metric: { width: METRIC, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 18, alignItems: 'center', paddingVertical: 14 },
  metricVal: { color: '#fff', fontSize: 22, fontWeight: '700', marginVertical: 4 },
  metricLbl: { color: '#c7d2fe', fontSize: 12 },

  noGymWrap: { alignItems: 'center', marginTop: 48, paddingHorizontal: 20 },
  noGymTitle: { color: '#e0e7ff', fontSize: 22, fontWeight: '700', marginTop: 16 },
  noGymDesc: { color: '#cbd5e1', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginTop: 28, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 28 },
  joinTxt: { marginLeft: 8, color: '#4f46e5', fontWeight: '600', letterSpacing: 0.3 },

  secTitle: { color: '#cbd5e1', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  lineItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 12, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  lineTitle: { fontWeight: '600', color: '#1e293b' },
  lineSub: { color: '#64748b', fontSize: 13, marginTop: 2 },

  announceCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12 },
  announceTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  announceDesc: { marginTop: 4, color: '#475569' },
  announceTime: { marginTop: 6, color: '#94a3b8', fontSize: 12, textAlign: 'right' },

  empty: { color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginBottom: 4 },

  fabQR:  { position: 'absolute', bottom: 24,  right: 24, width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  fabBook:{ position: 'absolute', bottom: 110, right: 24, width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
