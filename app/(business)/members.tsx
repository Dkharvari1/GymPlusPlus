// app/(business)/members.tsx
//
// Shows the roster of members for this gym **and** provides
// a floating action button that opens the QR scanner.
//
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';

import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebaseConfig';

type Member = {
  id: string;
  username?: string;
  email?: string;
  selectedPackage?: { name: string };
};

export default function Members() {
  const router  = useRouter();
  const uid     = auth.currentUser?.uid!;
  const [gymId, setGymId] = useState<string | null>(null);

  /* 1) resolve this owner’s gym id */
  useEffect(() => {
    const q = query(collection(db, 'gyms'), where('ownerUid', '==', uid));
    const unsub = onSnapshot(q, snap => setGymId(snap.empty ? null : snap.docs[0].id));
    return unsub;
  }, [uid]);

  /* 2) live roster */
  const [members, setMembers] = useState<Member[] | null>(null);
  useEffect(() => {
    if (!gymId) return;
    const q = query(collection(db, 'users'), where('gymId', '==', gymId));
    const unsub = onSnapshot(q, snap =>
      setMembers(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
    );
    return unsub;
  }, [gymId]);

  const [search, setSearch] = useState('');

  const filtered = members?.filter(m =>
    m.username?.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase())
  );

  /* loading */
  if (!members) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  return (
    <View style={styles.bg}>
      <Text style={styles.title}>Members</Text>

      <TextInput
        style={styles.search}
        placeholder="Search members..."
        placeholderTextColor="#9ca3af"
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered ?? []}
        keyExtractor={m => m.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.username ?? 'User'}</Text>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={styles.pkg}>
                Package:{' '}
                {item.selectedPackage?.name ?? 'None'}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#94a3b8" />
          </View>
        )}
      />

      {/* ─────────── FAB: open scanner ─────────── */}
      {gymId && (
        <Pressable
          style={styles.fab}
          android_ripple={{ color: '#c7d2fe', radius: 24 }}
             onPress={() => router.push('/scan-user')}
        >
          <MaterialCommunityIcons
            name="qrcode-scan"
            size={28}
            color="#4f46e5"
          />
        </Pressable>
      )}
    </View>
  );
}

/* ── styles ───────────────────────────────────────────────── */
const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#eef1ff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#312e81',
    marginTop: 52,
    marginBottom: 14,
    alignSelf: 'center',
  },
  search: {
    marginHorizontal: 16,
    marginBottom: 18,
    backgroundColor: '#c7d2fe50',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#111827',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed20',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
  },
  name: { color: '#1e1b4b', fontWeight: '600' },
  email: { color: '#475569', fontSize: 12, marginTop: 2 },
  pkg: { color: '#475569', fontSize: 12, fontStyle: 'italic', marginTop: 2 },

  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
});
