import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebaseConfig';

const PARTS = ['Chest','Back','Shoulders','Biceps','Triceps','Quads','Hamstrings','Glutes','Calves','Core'];

export default function RecommendScreen() {
  const [part, setPart]   = useState<string | null>(null);
  const [moves, setMoves] = useState<any[] | null>(null);

  /* when body part changes → fetch workouts */
  useEffect(() => {
    if (!part) return;
    (async () => {
      setMoves(null);
      const q = query(
        collection(db, 'workouts'),
        where('bodyParts', 'array-contains', part.toLowerCase())
      );
      const snap = await getDocs(q);
      setMoves(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    })();
  }, [part]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Choose a body part</Text>
      <View style={styles.row}>
        {PARTS.map(p => (
          <Pressable
            key={p}
            style={[styles.pill, part===p && styles.pillActive]}
            onPress={() => setPart(p)}
          >
            <Text style={[styles.pillTxt, part===p && {color:'#fff'}]}>{p}</Text>
          </Pressable>
        ))}
      </View>

      {part && (
        <>
          <Text style={styles.heading}>Exercises for {part}</Text>
          {!moves ? (
            <ActivityIndicator color="#4f46e5" style={{ marginTop:20 }} />
          ) : moves.length ? (
            moves.map(m => <Text key={m.id} style={styles.move}>• {m.name}</Text>)
          ) : (
            <Text style={styles.empty}>No exercises stored yet.</Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  heading: { fontSize: 18, fontWeight:'700', color:'#1e293b', marginVertical: 12 },
  row: { flexDirection:'row', flexWrap:'wrap' },
  pill: {
    borderWidth:1, borderColor:'#4f46e5', borderRadius:20,
    paddingHorizontal:12, paddingVertical:6, margin:4,
  },
  pillActive: { backgroundColor:'#4f46e5' },
  pillTxt: { color:'#4f46e5', fontSize:13 },
  move: { marginLeft:4, marginVertical:4, color:'#475569' },
  empty:{ color:'#94a3b8', fontStyle:'italic', marginTop:6 }
});
