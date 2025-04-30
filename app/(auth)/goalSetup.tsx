/*  UPDATED 30 Apr 2025  — single-choice goal + diet  */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebaseConfig';
import AuthCard from '../../ui/AuthCard';

/* static options (unchanged) */
const GOALS = [
  'Lose weight', 'Gain muscle', 'Improve cardio endurance', 'Increase strength',
  'Powerlifting', 'Bodybuilding', 'Cross-functional / HIIT',
  'Improve flexibility & mobility', 'Rehabilitation / injury recovery',
  'Sports performance', 'General health & wellness', 'Maintain weight',
  'Prepare for competition',
] as const;

const DIETS = [
  'Balanced / Portion-controlled', 'High-protein', 'Low-carb', 'Ketogenic',
  'Mediterranean', 'Vegetarian', 'Vegan', 'Pescatarian', 'Paleo',
  'Intermittent fasting',
] as const;

/* ─────────────────────────────────────────────────────────── */
export default function GoalSetup() {
  const router   = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  /* ── form state (now single selections) ───────────────────── */
  const [goal, setGoal]         = useState<string>('');
  const [diet, setDiet]         = useState<string>('');
  const [weightGoal, setWeight] = useState('');   // kg
  const [weeks, setWeeks]       = useState('');   // timeframe

  /* helpers */
  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const valid =
    goal && diet &&
    num(weightGoal) !== null &&
    num(weeks)      !== null;

  /* submit */
  async function save() {
    if (!valid) { Alert.alert('Please complete every field'); return; }
    try {
      setSaving(true);
      await setDoc(
        doc(db, 'users', user!.uid),
        {
          goal,                   // single value now
          diet,
          targetWeightKg : num(weightGoal),
          targetTimeWeeks: num(weeks),
          goalsCompleted : true,
          updatedAt      : serverTimestamp(),
        },
        { merge: true },
      );
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally { setSaving(false); }
  }

  /* pill component */
  const Pill = ({ label, active, onPress }: {
    label: string; active: boolean; onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active && { backgroundColor: '#6366f1' }]}
    >
      <Text style={[styles.pillTxt, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );

  /* render */
  return (
    <LinearGradient
      colors={['#7c3aed', '#4f46e5', '#312e81']}
      style={styles.bg} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
    >
      <ScrollView contentContainerStyle={styles.center}>
        <AuthCard>
          <Text style={styles.title}>Let’s set your goals</Text>

          {/* training goal (single‐choice now) */}
          <Text style={styles.label}>Primary Training Goal</Text>
          <View style={styles.flexWrap}>
            {GOALS.map(g => (
              <Pill key={g} label={g} active={goal === g} onPress={() => setGoal(g)} />
            ))}
          </View>

          {/* diet (single‐choice) */}
          <Text style={styles.label}>Preferred Diet</Text>
          <View style={styles.flexWrap}>
            {DIETS.map(d => (
              <Pill key={d} label={d} active={diet === d} onPress={() => setDiet(d)} />
            ))}
          </View>

          {/* weight + timeframe */}
          <View style={styles.row}>
            <MaterialCommunityIcons name="scale-bathroom" color="#6b7280" size={22} />
            <TextInput
              style={styles.input} placeholder="Target weight (kg)"
              placeholderTextColor="#9ca3af" keyboardType="numeric"
              value={weightGoal} onChangeText={setWeight}
            />
          </View>
          <View style={styles.row}>
            <MaterialCommunityIcons name="calendar-clock" color="#6b7280" size={22} />
            <TextInput
              style={styles.input} placeholder="Time frame (weeks)"
              placeholderTextColor="#9ca3af" keyboardType="numeric"
              value={weeks} onChangeText={setWeeks}
            />
          </View>

          {/* submit */}
          <Pressable
            style={[styles.btn, (!valid || saving) && { opacity: 0.5 }]}
            onPress={save} disabled={!valid || saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> :
              <Text style={styles.btnTxt}>Continue</Text>}
          </Pressable>
        </AuthCard>
      </ScrollView>
    </LinearGradient>
  );
}

/* styles (unchanged except labels) */
const PRIMARY = '#4f46e5';
const styles = StyleSheet.create({
  bg:{ flex:1 }, center:{ flexGrow:1, justifyContent:'center', padding:24 },
  title:{ fontSize:26, fontWeight:'700', color:'#fff', marginBottom:20, textAlign:'center' },
  label:{ color:'#d1d5db', marginBottom:6, fontWeight:'600' },
  flexWrap:{ flexDirection:'row', flexWrap:'wrap', marginBottom:18 },
  pill:{ borderWidth:1, borderColor:'#6366f1', borderRadius:20, paddingVertical:6,
         paddingHorizontal:12, margin:4, backgroundColor:'rgba(99,102,241,0.15)' },
  pillTxt:{ color:'#c7d2fe', fontSize:13 },
  row:{ flexDirection:'row', alignItems:'center', backgroundColor:'rgba(255,255,255,0.25)',
        borderRadius:18, paddingHorizontal:16, marginBottom:16 },
  input:{ flex:1, height:48, color:'#fff', marginLeft:8, fontSize:16 },
  btn:{ backgroundColor:PRIMARY, borderRadius:18, paddingVertical:14,
        alignItems:'center', marginTop:4 },
  btnTxt:{ color:'#fff', fontSize:16, fontWeight:'600' },
});
