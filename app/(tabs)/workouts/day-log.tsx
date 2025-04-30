// app/(tabs)/workouts/day-log.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import { db, auth } from '../../../lib/firebaseConfig';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';

/**
 * Shows all workout entries logged for a single day.
 * (Guard added — 29 Apr 2025 — so older entries that lack `unit`
 * won’t crash when we try to call toUpperCase().)
 */
export default function DayLog() {
  const { day } = useLocalSearchParams<{ day?: string }>();
  const uid = auth.currentUser?.uid;
  const [logs, setLogs] = useState<any[] | null>(null);

  /* fetch once */
  useEffect(() => {
    if (!uid || !day) return;
    (async () => {
      const snap = await getDoc(doc(db, 'users', uid, 'days', day));
      setLogs(snap.exists() ? snap.data().workouts ?? [] : []);
    })();
  }, [uid, day]);

  /* delete helper */
  const deleteEntry = async (entry: any) => {
    if (!uid || !day) return;
    await updateDoc(doc(db, 'users', uid, 'days', day), {
      workouts: arrayRemove(entry),
    });
    setLogs((cur) => cur!.filter((e) => e !== entry));
  };

  /* loading */
  if (!logs) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color="#4f46e5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.iconBtn}>
          <AntDesign name="arrowleft" size={22} color="#fff" />
        </Pressable>
        <Text style={s.h1}>Logged Workouts • {day}</Text>
      </View>

      {/* content */}
      {logs.length === 0 ? (
        <Text style={s.empty}>No workouts logged yet.</Text>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(_, i) => i.toString()}
          contentContainerStyle={{ paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            /* ── safe display helpers ─────────────────────── */
            const weightTxt =
              typeof item.weight === 'number' ? item.weight : item.weight ?? '?';
            const unitTxt =
              typeof item.unit === 'string' ? item.unit.toUpperCase() : '';

            return (
              <View style={s.card}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.name}</Text>
                  <Text style={s.meta}>
                    {item.sets} × {item.reps} — {weightTxt} {unitTxt}
                  </Text>
                </View>

                <Pressable onPress={() => deleteEntry(item)}>
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={22}
                    color="#f87171"
                  />
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

/* ── styles ─────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f6ff', padding: 16 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f6ff',
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconBtn: { padding: 6, backgroundColor: '#4f46e5', borderRadius: 14 },
  h1: {
    color: '#1e293b',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
    flex: 1,
  },
  empty: {
    color: '#64748b',
    fontStyle: 'italic',
    alignSelf: 'center',
    marginTop: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  name: { fontWeight: '600', fontSize: 15, color: '#1e1f36' },
  meta: { color: '#475569', fontSize: 13, marginTop: 2 },
});
