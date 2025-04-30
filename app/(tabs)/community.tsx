// app/(tabs)/community.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from 'react-native';
import { AntDesign } from '@expo/vector-icons';
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
import { db } from '../../lib/firebaseConfig';

/* ─── types ───────────────────────────────────────────────────────────── */
interface ChatMessage {
  id: string;
  text: string;
  senderUid: string;
  senderName: string;
  createdAt: any; // Firestore Timestamp
}

/* ─── component ───────────────────────────────────────────────────────── */
export default function CommunityScreen() {
  const auth = getAuth();
  const user = auth.currentUser!;
  const [gymId, setGymId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  /* fetch gymId */
  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) setGymId((snap.data() as any).gymId ?? null);
    })();
  }, [user.uid]);

  /* subscribe to chat */
  useEffect(() => {
    if (!gymId) return;
    const q = query(
      collection(db, 'gyms', gymId, 'messages'),
      orderBy('createdAt', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      const msgs: ChatMessage[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<ChatMessage, 'id'>),
      }));
      setMessages(msgs);
      setLoading(false);
      // scroll to bottom
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 0);
    });
    return unsub;
  }, [gymId]);

  /* send */
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !gymId) return;
    await addDoc(collection(db, 'gyms', gymId, 'messages'), {
      text: input.trim(),
      senderUid: user.uid,
      senderName: user.displayName || 'Anonymous',
      createdAt: serverTimestamp(),
    });
    setInput('');
  }, [input, gymId, user]);

  /* bubble renderer */
  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderUid === user.uid;
    return (
      <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
        {!isMe && <Text style={styles.name}>{item.senderName}</Text>}
        <Text style={styles.msg}>{item.text}</Text>
        <Text style={styles.time}>
          {item.createdAt?.toDate().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  /* loading / no-gym UI */
  if (loading)
    return (
      <LinearGradient colors={['#312e81', '#4f46e5', '#7c3aed']} style={styles.full}>
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );
  if (!gymId)
    return (
      <LinearGradient colors={['#312e81', '#4f46e5', '#7c3aed']} style={styles.full}>
        <Text style={styles.info}>Join a gym to access community chat.</Text>
      </LinearGradient>
    );

  /* main UI */
  return (
    <LinearGradient colors={['#312e81', '#4f46e5', '#7c3aed']} style={styles.full}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
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
    </LinearGradient>
  );
}

/* ─── styles ───────────────────────────────────────────────────────────── */
const PRIMARY = '#4f46e5';
const BG_GRADIENT = ['#312e81', '#4f46e5', '#7c3aed'];

const styles = StyleSheet.create({
  full: { flex: 1 },
  flex: { flex: 1 },
  list: { padding: 12, paddingBottom: 80, paddingTop: 60 },
  info: { color: '#e0e7ff', fontSize: 16, textAlign: 'center', marginTop: 40 },

  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
    marginVertical: 6,
  },
  bubbleLeft: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
  },
  bubbleRight: {
    backgroundColor: PRIMARY,
    alignSelf: 'flex-end',
  },
  name: { color: '#d1d5db', fontSize: 12, marginBottom: 4 },
  msg: { color: '#fff', fontSize: 15 },
  time: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 4, textAlign: 'right' },

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
