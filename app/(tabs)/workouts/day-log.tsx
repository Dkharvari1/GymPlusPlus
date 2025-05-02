// app/(tabs)/workouts/day-log.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import { db, auth } from '../../../lib/firebaseConfig';
import {
  doc, updateDoc, arrayRemove, onSnapshot,
} from 'firebase/firestore';

/**
 * Live view of all workout entries for one day.
 */
export default function DayLog() {
  const { day } = useLocalSearchParams<{ day?: string }>();
  const uid = auth.currentUser?.uid;
  const [logs, setLogs] = useState<any[] | null>(null);

  /* realtime listener */
  useEffect(() => {
    if (!uid || !day) return;
    const off = onSnapshot(doc(db, 'users', uid, 'days', day), s => {
      setLogs(s.exists() ? s.data().workouts ?? [] : []);
    });
    return off;
  }, [uid, day]);

  const deleteEntry = async (entry: any) => {
    if (!uid || !day) return;
    await updateDoc(doc(db, 'users', uid, 'days', day), {
      workouts: arrayRemove(entry),
    });
  };

  if (!logs) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#4f46e5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <AntDesign name="arrowleft" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.h1}>Logged Workouts • {day}</Text>
      </View>

      {/* list */}
      {logs.length === 0 ? (
        <Text style={styles.empty}>No workouts logged yet.</Text>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(_, i) => i.toString()}
          contentContainerStyle={{ paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const weightTxt =
              typeof item.weight === 'number' ? item.weight : item.weight ?? '?';
            const unitTxt =
              typeof item.unit === 'string' ? item.unit.toUpperCase() : '';

            return (
              <View style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
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

/* styles unchanged */
const styles = StyleSheet.create({


/* ── styles ─────────────────────────────────────────────── */
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
