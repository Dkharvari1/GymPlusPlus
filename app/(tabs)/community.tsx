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
  ViewStyle,
  Platform,
  StyleProp,
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
import { db } from '../../lib/firebaseConfig'; // adjust if located elsewhere

/* ---------- types -------------------------------------------------------- */
interface ChatMessage {
  id: string;
  text: string;
  senderUid: string;
  senderName: string;
  createdAt: any; // Firestore Timestamp | null while pending
}

/* ---------- component ---------------------------------------------------- */
export default function CommunityScreen() {
  const auth = getAuth();
  const user = auth.currentUser;

  const [gymId, setGymId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  const listRef = useRef<FlatList<ChatMessage>>(null);

  /* -- get the user’s gymId once ----------------------------------------- */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) setGymId(snap.data().gymId ?? null);
    })();
  }, [user]);

  /* -- subscribe to messages in that gym --------------------------------- */
  useEffect(() => {
    if (!gymId) return;
    const q = query(
      collection(db, 'gyms', gymId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs: ChatMessage[] = [];
      snap.forEach((d) =>
        msgs.push({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) })
      );
      setMessages(msgs);
      setLoading(false);
      // scroll after the JS thread flushes
      setTimeout(
        () => ((listRef.current as any)?.scrollToEnd({ animated: true })),
        0
      );
    });
    return unsub;
  }, [gymId]);

  /* -- send --------------------------------------------------------------- */
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !user || !gymId) return;
    await addDoc(collection(db, 'gyms', gymId, 'messages'), {
      text: input.trim(),
      senderUid: user.uid,
      senderName: user.displayName || 'Anonymous',
      createdAt: serverTimestamp(),
    });
    setInput('');
  }, [input, user, gymId]);

  /* -- render helpers ----------------------------------------------------- */
  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderUid === user?.uid;
    const bubbleStyles: StyleProp<ViewStyle> = [
      styles.bubble,
      isMe ? styles.bubbleRight : styles.bubbleLeft,
    ];

    return (
      <View style={bubbleStyles}>
        {!isMe && <Text style={styles.name}>{item.senderName}</Text>}
        <Text style={styles.msg}>{item.text}</Text>
      </View>
    );
  };

  /* -- UI states ---------------------------------------------------------- */
  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );

  if (!gymId)
    return (
      <View style={styles.center}>
        <Text style={styles.info}>Join a gym to access community chat.</Text>
      </View>
    );

  /* -- main UI ------------------------------------------------------------ */
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() =>
          (listRef.current as any)?.scrollToEnd({ animated: true })
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          placeholder="Message your gym..."
          placeholderTextColor="#7a7a7d"
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <Pressable style={styles.sendBtn} onPress={sendMessage}>
          <AntDesign name="arrowup" size={20} color="white" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ---------- styles ------------------------------------------------------- */
const bubbleBase: ViewStyle = {
  maxWidth: '75%',
  borderRadius: 16,
  paddingVertical: 8,
  paddingHorizontal: 12,
  marginVertical: 4,
};

//container: { flex: 1, backgroundColor: '#0e0f11' },
  const lavender = '#A29DF3';             // pick any shade you like
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lavender },
  listContent: { padding: 12, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: lavender },
  info: { color: '#8c8d91', fontSize: 15, textAlign: 'center', padding: 24 },

  /* bubbles ▸ explicitly ViewStyle */
  bubble: bubbleBase as ViewStyle,
  bubbleLeft: {
    ...bubbleBase,
    backgroundColor: '#1f1f22',
    alignSelf: 'flex-start',
  } as ViewStyle,
  bubbleRight: {
    ...bubbleBase,
    backgroundColor: '#4e8cff',
    alignSelf: 'flex-end',
  } as ViewStyle,
  name: { color: '#7f8083', fontSize: 12, marginBottom: 2 },
  msg: { color: '#ffffff', fontSize: 15 },

  /* input row */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    borderColor: '#2a2a2e',
    backgroundColor: '#141518',
  } as ViewStyle,
  input: {
    flex: 1,
    backgroundColor: '#1d1e22',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 15,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: '#4e8cff',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
});
