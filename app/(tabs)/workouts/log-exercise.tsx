// app/(tabs)/workouts/log-exercise.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebaseConfig';

type Workout = { id:string; name:string };

export default function LogExercise() {
  const { wid, day } = useLocalSearchParams<{ wid?:string; day?:string }>();
  const uid    = auth.currentUser?.uid;
  const dateId = day ?? '';

  /* fetch workout */
  const [move,setMove] = useState<Workout | null>(null);
  useEffect(()=>{ (async()=>{
    if(!wid) return;
    const snap = await getDoc(doc(db,'workouts',wid));
    snap.exists() && setMove({ id:snap.id, ...(snap.data() as any) });
  })(); },[wid]);

  /* form state */
  const [sets, setSets]       = useState('3');
  const [reps, setReps]       = useState('10');
  const [weight, setWeight]   = useState('0');
  const [unit,  setUnit]      = useState<'kg'|'lb'>('kg');

  /* submit */
  const submit = async () => {
    if(!uid || !move) return;
    const ref  = doc(db,'users',uid,'days',dateId);
    const snap = await getDoc(ref);
    if(!snap.exists()) await setDoc(ref,{ workouts:[], meals:[], water:0 });

    const entry = {
      exerciseId: move.id,
      name:       move.name,
      sets:       Number(sets) || 0,
      reps:       Number(reps) || 0,
      weight:     Number(weight) || 0,  // stored as number
      unit,                             // 'kg' | 'lb'
    };

    await updateDoc(ref,{
      workouts:[ ...(snap.exists() && Array.isArray(snap.data().workouts)
                  ? snap.data().workouts : []), entry ]
    });
    router.back();
  };

  if(!move){
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <Pressable onPress={()=>router.back()} style={s.backBtn}>
        <AntDesign name="arrowleft" size={22} color="#fff" />
      </Pressable>

      <Text style={s.h1}>{move.name}</Text>

      <Text style={s.lbl}>Sets</Text>
      <TextInput style={s.input} keyboardType="numeric" value={sets} onChangeText={setSets} />

      <Text style={s.lbl}>Reps</Text>
      <TextInput style={s.input} keyboardType="numeric" value={reps} onChangeText={setReps} />

      <Text style={s.lbl}>Weight</Text>
      <View style={s.row}>
        <TextInput
          style={[s.input,{ flex:1 }]}
          keyboardType="numeric"
          value={weight}
          onChangeText={setWeight}
        />
        <View style={s.unitBar}>
          {(['kg','lb'] as const).map(u=>(
            <Pressable
              key={u}
              style={[s.unitPill, unit===u && s.unitActive]}
              onPress={()=>setUnit(u)}
            >
              <Text style={[s.unitTxt, unit===u && s.unitTxtActive]}>{u.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable style={s.btn} onPress={submit}>
        <Text style={s.btnTxt}>Add to log</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{ flex:1, backgroundColor:'#312e81', padding:24 },
  backBtn:{ padding:6, backgroundColor:'rgba(255,255,255,0.12)',
            borderRadius:14, alignSelf:'flex-start' },
  h1:{ color:'#fff', fontSize:22, fontWeight:'700', marginVertical:16 },
  lbl:{ color:'#a5b4fc', marginTop:14, marginBottom:4 },
  input:{ backgroundColor:'#fff', borderRadius:14, paddingVertical:8,
          paddingHorizontal:14, fontSize:15, color:'#1e293b' },
  row:{ flexDirection:'row', alignItems:'center', marginBottom:4 },
  unitBar:{ flexDirection:'row', marginLeft:8 },
  unitPill:{ borderWidth:1, borderColor:'#4f46e5', borderRadius:14,
             paddingHorizontal:10, paddingVertical:6, marginLeft:4 },
  unitActive:{ backgroundColor:'#4f46e5' },
  unitTxt:{ fontSize:13, color:'#4f46e5' },
  unitTxtActive:{ color:'#fff', fontWeight:'600' },
  btn:{ marginTop:30, backgroundColor:'#4f46e5', borderRadius:20,
        paddingVertical:14, alignItems:'center' },
  btnTxt:{ color:'#fff', fontWeight:'600', fontSize:15 },
});
