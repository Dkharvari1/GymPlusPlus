// app/(tabs)/community.tsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  SafeAreaView,
} from 'react-native';
import { AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { db } from '../../lib/firebaseConfig';
import { useRouter } from 'expo-router';

/* ─── constants ─────────────────────────────────────────────────────── */
const PRIMARY = '#4f46e5';
const BG_GRADIENT = ['#312e81', '#4f46e5', '#7c3aed'] as const;
const AVATAR_SIZE = 36;

/* ─── types ─────────────────────────────────────────────────────────── */
interface ChatMessage {
  id: string;
  text: string;
  senderUid: string;
  senderName: string;
  photoURL?: string | null;
  createdAt: any; // Firestore Timestamp
}

/* ─── component ─────────────────────────────────────────────────────── */
export default function CommunityScreen() {
  const auth = getAuth();
  const user = auth.currentUser!;
  const navigation = useNavigation();
  const router = useRouter();

  const [gymId, setGymId] = useState<string | null>(null);
  const [gymName, setGymName] = useState('Community');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const listRef = useRef<FlatList<ChatMessage>>(null);

  /* 🔄 LIVE listener for the user’s gymId */
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => setGymId((snap.data() as any)?.gymId ?? null),
      (err) => console.warn('user doc listener', err.code)
    );
    return unsub;
  }, [user.uid]);

  /* gym name */
  useEffect(() => {
    if (!gymId) return;
    (async () => {
      const snap = await getDoc(doc(db, 'gyms', gymId));
      if (snap.exists()) setGymName((snap.data() as any).name ?? 'Community');
    })();
  }, [gymId]);

  /* optional nav-bar title */
  useLayoutEffect(() => {
    navigation.setOptions({ title: gymName });
  }, [navigation, gymName]);

  /* subscribe to chat (DESC for inverted list) */
  useEffect(() => {
    if (!gymId) return;
    const q = query(
      collection(db, 'gyms', gymId, 'messages'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const msgs: ChatMessage[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, 'id'>),
        }));
        setMessages(msgs);
        setLoading(false);

        /* cache avatars */
        msgs.forEach(async (m) => {
          if (m.photoURL) {
            setPhotos((p) => ({ ...p, [m.senderUid]: m.photoURL! }));
          } else if (photos[m.senderUid] === undefined) {
            const uSnap = await getDoc(doc(db, 'users', m.senderUid));
            setPhotos((p) => ({
              ...p,
              [m.senderUid]:
                uSnap.exists() ? (uSnap.data() as any).photoURL ?? null : null,
            }));
          }
        });
      },
      (err) => console.warn('messages listener', err.code)
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId]);

  /* send message (includes photoURL) */
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !gymId) return;
    await addDoc(collection(db, 'gyms', gymId, 'messages'), {
      text: input.trim(),
      senderUid: user.uid,
      senderName: user.displayName || 'Anonymous',
      photoURL: user.photoURL ?? null,
      createdAt: serverTimestamp(),
    });
    setInput('');
    setTimeout(
      () => listRef.current?.scrollToOffset({ offset: 0, animated: true }),
      100
    );
  }, [input, gymId, user]);

  /* avatar helper */
  const Avatar = ({ uri, name }: { uri?: string | null; name: string }) =>
    uri ? (
      <Image source={{ uri }} style={styles.avatar} />
    ) : (
      <View style={[styles.avatar, styles.avatarFallback]}>
        <Text style={styles.initials}>
          {name
            .split(' ')
            .map((w) => w[0]?.toUpperCase())
            .join('')
            .slice(0, 2)}
        </Text>
      </View>
    );

  /* row renderer */
  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderUid === user.uid;
    const uri = item.photoURL ?? photos[item.senderUid];

    /* ── your own message: right-aligned bubble ── */
    if (isMe) {
      return (
        <View style={[styles.row, { justifyContent: 'flex-end' }]}>
          <View style={[styles.bubble, styles.bubbleRight]}>
            <Text style={styles.msg}>{item.text}</Text>
            <Text style={styles.time}>
              {item.createdAt
                ?.toDate()
                .toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
            </Text>
          </View>
        </View>
      );
    }

    /* ── other user: avatar + bubble ── */
    return (
      <View style={styles.row}>
        <Avatar uri={uri} name={item.senderName} />
        <View style={[styles.bubble, styles.bubbleLeft]}>
          <Text style={styles.name}>{item.senderName}</Text>
          <Text style={styles.msg}>{item.text}</Text>
          <Text style={styles.time}>
            {item.createdAt
              ?.toDate()
              .toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}
          </Text>
        </View>
      </View>
    );
  };

  /* loading + no-gym handling */
  if (loading)
    return (
      <LinearGradient colors={BG_GRADIENT} style={styles.full}>
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );

  if (!gymId)
    return (
      <LinearGradient colors={BG_GRADIENT} style={styles.full}>
        <SafeAreaView style={styles.flexCenter}>
          <MaterialCommunityIcons name="dumbbell" size={72} color="#c7d2fe" />
          <Text style={styles.noGymTitle}>No gym selected</Text>
          <Text style={styles.noGymDesc}>
            Join a gym to unlock community chat, bookings, and more.
          </Text>

          <Pressable
            onPress={() => router.push('/profile')}
            style={styles.joinBtn}
            android_ripple={{ color: '#c7d2fe' }}
          >
            <MaterialCommunityIcons name="account-edit" size={20} color="#4f46e5" />
            <Text style={styles.joinTxt}>Open Profile</Text>
          </Pressable>
        </SafeAreaView>
      </LinearGradient>
    );

  /* main UI */
  return (
    <LinearGradient colors={BG_GRADIENT} style={styles.full}>
      <SafeAreaView style={styles.flex}>
        {/* in-app header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>{gymName}</Text>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          <FlatList
            ref={listRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            inverted
            contentContainerStyle={styles.list}
          />

          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder="Message your gym..."
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <Pressable style={styles.sendBtn} onPress={sendMessage}>
              <AntDesign name="arrowup" size={20} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ─── styles ─────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  full: { flex: 1 },
  flex: { flex: 1 },

  /* no-gym UI */
  flexCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  noGymTitle: { color: '#e0e7ff', fontSize: 22, fontWeight: '700', marginTop: 12 },
  noGymDesc: { color: '#cbd5e1', fontSize: 15, textAlign: 'center', marginTop: 6, lineHeight: 22 },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 26,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 26,
  },
  joinTxt: { marginLeft: 8, color: '#4f46e5', fontWeight: '600', letterSpacing: 0.3 },

  /* chat header */
  header: { alignItems: 'center', paddingVertical: 8 },
  headerText: {
    color: '#c7d2fe',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  list: { paddingHorizontal: 12, paddingBottom: 8 },

  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },

  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginHorizontal: 6,
  },
  avatarFallback: {
    backgroundColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: { color: '#fff', fontWeight: '600' },

  bubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  bubbleLeft: { backgroundColor: 'rgba(255,255,255,0.2)' },
  bubbleRight: { backgroundColor: PRIMARY },

  name: { color: '#d1d5db', fontSize: 12, marginBottom: 4 },
  msg: { color: '#fff', fontSize: 15 },
  time: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  sendBtn: {
    marginLeft: 8,
    backgroundColor: PRIMARY,
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
