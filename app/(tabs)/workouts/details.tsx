// app/(tabs)/workouts/details.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebaseConfig';
import YoutubePlayer from 'react-native-youtube-iframe';
import { ResizeMode, Video } from 'expo-av';

export default function ExerciseDetails() {
  const { wid, day } = useLocalSearchParams<{ wid?: string; day?: string }>();
  const [data, setData] = useState<any | null>(null);
  const [playing, setPlaying] = useState(false);

  /* fetch once */
  useEffect(() => {
    if (!wid) return;
    (async () => {
      const snap = await getDoc(doc(db, 'workouts', wid));
      snap.exists() ? setData({ id: snap.id, ...snap.data() }) : setData(null);
    })();
  }, [wid]);

  const onStateChange = useCallback((state: string) => {
    if (state === 'ended') setPlaying(false);
  }, []);

  if (!wid) {
    return (
      <View style={s.center}>
        <Text style={s.err}>No exercise selected.</Text>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#5b4df0" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <Pressable onPress={() => router.back()} style={s.backBtn}>
        <AntDesign name="arrowleft" size={22} color="#fff" />
      </Pressable>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={s.title}>{data.name}</Text>

        {/* video */}
        {data.videoId ? (
          <YoutubePlayer
            height={240}
            play={playing}
            videoId={data.videoId}
            onChangeState={onStateChange}
            webViewProps={{ allowsInlineMediaPlayback: true }}
          />
        ) : data.videoUrl ? (
          <Video
            source={{ uri: data.videoUrl }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            style={{ width: '100%', height: 220, borderRadius: 12, marginBottom: 20 }}
          />
        ) : null}

        {/* metadata */}
        <Text style={s.sub}>
          Difficulty: <Text style={s.val}>{data.difficulty}</Text>
        </Text>
        <Text style={s.sub}>
          Body parts: <Text style={s.val}>{data.bodyParts?.join(', ')}</Text>
        </Text>
        <Text style={s.sub}>
          Equipment: <Text style={s.val}>{data.equipment?.join(', ') || 'None'}</Text>
        </Text>
        {data.goals && data.goals.length > 0 && (
          <Text style={s.sub}>
            Goals: <Text style={s.val}>{data.goals.join(', ')}</Text>
          </Text>
        )}

        {/* instructions */}
        {data.instructions && (
          <>
            <Text style={s.h2}>How to perform</Text>
            <Text style={s.txt}>{data.instructions}</Text>
          </>
        )}
      </ScrollView>

      {/* add to log */}
      {wid && day && (
        <Pressable
          style={s.addBtn}
          onPress={() => router.push({ pathname:'/workouts/log-exercise', params:{ wid, day } })}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          <Text style={s.addTxt}>Add to log</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

/* styles */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#312e81', padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#312e81' },
  err: { color: '#fff', fontSize: 16 },
  backBtn: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 8, marginBottom: 16 },
  sub: { color: '#a5b4fc', fontSize: 15, marginBottom: 6 },
  val: { color: '#fff', fontWeight: '600' },
  h2: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 22, marginBottom: 8 },
  txt: { color: '#e0e7ff', lineHeight: 22 },
  addBtn: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    backgroundColor: '#4f46e5',
    borderRadius: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTxt: { color: '#fff', fontWeight: '700', marginLeft: 8 },
});
