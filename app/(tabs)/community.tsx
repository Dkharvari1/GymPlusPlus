// app/(tabs)/community.tsx

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  SafeAreaView,
} from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  getDoc,
  orderBy,
  query,
  getDocs,
  where,
  limit as limitTo,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { db } from '../../lib/firebaseConfig';

/* -------------------------------------------------------------- */
const GRADIENT = ['#312e81', '#4f46e5', '#7c3aed'] as const;
const PRIMARY = '#4f46e5';
const AVSZ = 36;

/* privileged roles → badge styling */
const ROLE_BADGE: Record<string, { label: string; bg: string }> = {
  business: { label: 'Gym', bg: '#a78bfa' },
  owner: { label: 'Owner', bg: '#facc15' },
  manager: { label: 'Manager', bg: '#38bdf8' },
};

interface Msg {
  id: string;
  text: string;
  senderUid: string;
  senderName: string;
  senderRole?: string;
  photoURL?: string | null;
  createdAt: any;
}

/* -------------------------------------------------------------- */
export default function CommunityScreen() {
  const auth = getAuth();
  const user = auth.currentUser!;
  const nav = useNavigation();
  const router = useRouter();

  /* which gym chat to load */
  const [gymId, setGymId] = useState<string | null>(null);
  const [gymName, setGymName] = useState('Community');
  const [myRole, setMyRole] = useState<'member' | 'business' | 'owner' | 'manager'>('member');

  /* chat state */
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  /* avatar cache */
  const photos = useRef<Record<string, string | null>>({});

  const listRef = useRef<FlatList<Msg>>(null);

  // 1️⃣ Watch own user doc for gymId & role
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', user.uid), async snap => {
      const d = snap.data() as any;
      const role: string = d?.role ?? 'member';
      setMyRole(role as any);

      if (role === 'business' || role === 'owner' || role === 'manager') {
        // business accounts: look up the gym they own
        const gymsQ = query(
          collection(db, 'gyms'),
          where('ownerUid', '==', user.uid),
          limitTo(1)
        );
        const gymsSnap = await getDocs(gymsQ);
        setGymId(gymsSnap.empty ? null : gymsSnap.docs[0].id);
      } else {
        // regular members: use their gymId field
        setGymId(d?.gymId ?? null);
      }
    });
    return unsub;
  }, [user.uid]);

  // 2️⃣ Load gym name when gymId is set
  useEffect(() => {
    if (!gymId) return;
    getDoc(doc(db, 'gyms', gymId)).then(s => {
      if (s.exists()) setGymName(((s.data() as any).name as string) || 'Community');
    });
  }, [gymId]);

  // update navigation title
  useLayoutEffect(() => {
    nav.setOptions({ title: gymName });
  }, [nav, gymName]);

  // 3️⃣ Subscribe to this gym’s chat messages
  useEffect(() => {
    setMsgs([]);
    if (!gymId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const q = query(
      collection(db, 'gyms', gymId, 'messages'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      snap => {
        const arr = snap.docs.map(d => {
          const m = { id: d.id, ...(d.data() as any) } as Msg;
          // legacy fallback
          if (!m.senderRole) m.senderRole = 'member';
          if (m.photoURL) photos.current[m.senderUid] = m.photoURL;
          return m;
        });
        setMsgs(arr);
        setLoading(false);
      },
      err => {
        console.warn('messages listener error', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [gymId]);

  // 4️⃣ Send a new message
  const send = useCallback(async () => {
    if (!input.trim() || !gymId) return;
    await addDoc(collection(db, 'gyms', gymId, 'messages'), {
      text: input.trim(),
      senderUid: user.uid,
      senderName: user.displayName || 'Anonymous',
      senderRole: myRole,
      photoURL: user.photoURL || null,
      createdAt: serverTimestamp(),
    });
    setInput('');
    // scroll up to see your new message
    setTimeout(() => listRef.current?.scrollToOffset({ offset: 0 }), 100);
  }, [input, gymId, user, myRole]);

  /* ─── UI helpers ───────────────────────────────────────── */
  const Avatar = ({ uri, name }: { uri?: string | null; name: string }) =>
    uri ? (
      <Image source={{ uri }} style={styles.avatar} />
    ) : (
      <View style={[styles.avatar, styles.fallback]}>
        <Text style={styles.init}>
          {name
            .split(' ')
            .map(w => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </Text>
      </View>
    );

  const fmt = (t: any) =>
    t?.toDate().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });

  const Row = ({ item }: { item: Msg }) => {
    const me = item.senderUid === user.uid;
    const badg = ROLE_BADGE[item.senderRole || ''];
    const uri = photos.current[item.senderUid];

    if (me) {
      return (
        <View style={[styles.row, { justifyContent: 'flex-end' }]}>
          <View style={[styles.bub, styles.right]}>
            <Text style={styles.msg}>{item.text}</Text>
            <Text style={styles.time}>{fmt(item.createdAt)}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.row}>
        <Avatar uri={uri} name={item.senderName} />
        <View style={[styles.bub, styles.left]}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.senderName}</Text>
            {badg && (
              <View style={[styles.badge, { backgroundColor: badg.bg }]}>
                <Text style={styles.badgeTxt}>{badg.label}</Text>
              </View>
            )}
          </View>
          <Text style={styles.msg}>{item.text}</Text>
          <Text style={styles.time}>{fmt(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  /* ─── render states ─────────────────────────────────────── */
  if (loading) {
    return (
      <LinearGradient colors={GRADIENT} style={styles.full}>
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );
  }

  // only non-business members without a gym see the “no gym” screen
  if (!gymId && myRole === 'member') {
    return (
      <LinearGradient colors={GRADIENT} style={styles.full}>
        <SafeAreaView style={styles.center}>
          <AntDesign name="team" size={72} color="#c7d2fe" />
          <Text style={styles.noTitle}>No gym selected</Text>
          <Text style={styles.noDesc}>
            Join a gym to unlock community chat.
          </Text>
          <Pressable
            style={styles.profileBtn}
            onPress={() => router.push('/profile')}
          >
            <AntDesign name="user" size={20} color={PRIMARY} />
            <Text style={styles.profileTxt}>Open Profile</Text>
          </Pressable>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  /* ─── main chat UI ─────────────────────────────────────── */
  return (
    <LinearGradient colors={GRADIENT} style={styles.full}>
      <SafeAreaView style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={msgs}
          renderItem={Row}
          keyExtractor={m => m.id}
          inverted
          contentContainerStyle={styles.list}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder="Message your gym..."
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <Pressable style={styles.send} onPress={send}>
              <AntDesign name="arrowup" size={20} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ─── styles ───────────────────────────────────────────────── */
const styles = StyleSheet.create({
  full: { flex: 1 },
  list: { padding: 12, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  noTitle: { fontSize: 22, color: '#e0e7ff', fontWeight: '700', marginTop: 12 },
  noDesc: { color: '#cbd5e1', textAlign: 'center', marginTop: 6, lineHeight: 22 },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 26,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 26,
  },
  profileTxt: { marginLeft: 8, color: PRIMARY, fontWeight: '600' },

  avatar: { width: AVSZ, height: AVSZ, borderRadius: AVSZ / 2, marginRight: 6 },
  fallback: { backgroundColor: '#475569', justifyContent: 'center', alignItems: 'center' },
  init: { color: '#fff', fontWeight: '600' },

  bub: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  left: { backgroundColor: 'rgba(255,255,255,0.2)' },
  right: { backgroundColor: PRIMARY },

  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  name: { color: '#d1d5db', fontSize: 12, fontWeight: '600' },
  badge: { marginLeft: 6, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt: { color: '#1e293b', fontSize: 10, fontWeight: '700' },

  msg: { color: '#fff', fontSize: 15 },
  time: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 4, textAlign: 'right' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 15,
  },
  send: {
    marginLeft: 8,
    backgroundColor: PRIMARY,
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
