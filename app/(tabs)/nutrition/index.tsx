import React, { useEffect, useState } from 'react';
//Check
import { LinearGradient } from 'expo-linear-gradient';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from '../../../lib/firebaseConfig';
import {
  collection, getDocs, query, orderBy, limit,
  doc, onSnapshot, updateDoc, increment,
} from 'firebase/firestore';
import { router } from 'expo-router';

/* small helpers */
type FoodCatalog = Record<string, { name: string; calories: number; protein: number }>;
type Meal = { foodId: string; portions: number };

export default function NutritionHome() {
  const uid = auth.currentUser?.uid;

  const [dateId, setDateId] = useState<string | null>(null);
  const [totals, setTotals] = useState<{ calories?: number; protein?: number; water?: number }>({});
  const [meals,  setMeals]  = useState<Meal[]>([]);
  const [catalog, setCatalog] = useState<FoodCatalog>({});

  /* ---------- 1) find latest day-doc id ---------- */
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const ref = collection(db, 'users', uid, 'days');
      const snap = await getDocs(query(ref, orderBy('__name__', 'desc'), limit(1)));
      setDateId(snap.docs[0]?.id ?? null);
    })();
  }, [uid]);

  /* ---------- 2) load food catalog once ---------- */
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'foods'));
      const map: FoodCatalog = {};
      snap.docs.forEach(d => { map[d.id] = d.data() as any; });
      setCatalog(map);
    })();
  }, []);

  /* ---------- 3) stream totals & meals ---------- */
  useEffect(() => {
    if (!uid || !dateId) return;
    return onSnapshot(
      doc(db, 'users', uid, 'days', dateId),
      s => {
        if (!s.exists()) return;
        const d: any = s.data();
        setTotals({ calories: d.calories, protein: d.protein, water: d.water });
        setMeals(d.meals ?? []);
      }
    );
  }, [uid, dateId]);

  /* ---------- 4) quick water ---------- */
  const addWater = async () => {
    if (!uid || !dateId) return;
    await updateDoc(doc(db, 'users', uid, 'days', dateId), { water: increment(250) });
  };

  /* ui helper */
  const metric = (label: string, icon: any, val?: number, unit?: string) => (
    <View style={styles.metricBox}>
      <MaterialCommunityIcons name={icon} size={20} color="#fff" />
      <Text style={styles.metricLbl}>{label}</Text>
      {val === undefined
        ? <ActivityIndicator color="#fff" />
        : <Text style={styles.metricVal}>{val} {unit}</Text>}
    </View>
  );

  return (
    <LinearGradient colors={['#7c3aed', '#4f46e5', '#312e81']} style={styles.bg}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <Text style={styles.h1}>Nutrition • {dateId ?? 'loading…'}</Text>

        {metric('Calories', 'fire',       totals.calories, 'kcal')}
        {metric('Protein',  'food-steak', totals.protein,  'g')}
        {metric('Water',    'cup-water',  totals.water,    'ml')}

        <Pressable style={styles.waterBtn} onPress={addWater}>
          <MaterialCommunityIcons name="plus" size={14} color="#fff" />
          <Text style={styles.waterTxt}>+250 ml water</Text>
        </Pressable>

        <Pressable
          style={styles.btn}
          onPress={() => router.push({ pathname: '/nutrition/log-meal', params: { day: dateId! } })}
          disabled={!dateId}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          <Text style={styles.btnTxt}>Log a meal</Text>
        </Pressable>

        {meals.length > 0 && (
          <>
            <Text style={styles.sub}>Meals today</Text>
            {meals.map((m, i) => {
              const f = catalog[m.foodId];
              return (
                <View key={i} style={styles.mealRow}>
                  <Text style={styles.mealName}>
                    {f ? f.name : 'Food'} × {m.portions}
                  </Text>
                  <Text style={styles.mealKcal}>
                    {f ? f.calories * m.portions : '?'} kcal
                  </Text>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, paddingTop: 60, paddingHorizontal: 24 },
  h1: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 24 },

  metricBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  metricLbl: { color: '#e0e7ff', marginLeft: 8, flex: 1 },
  metricVal: { color: '#fff', fontWeight: '600' },

  waterBtn: {
    alignSelf: 'flex-end', marginTop: 12,
    flexDirection:'row',alignItems:'center',
    backgroundColor:'#0ea5e9',borderRadius:18,
    paddingVertical:6,paddingHorizontal:12,
  },
  waterTxt:{ marginLeft:4,color:'#fff',fontSize:12,fontWeight:'600' },

  btn: {
    marginTop: 32, flexDirection:'row',alignItems:'center',justifyContent:'center',
    backgroundColor:'#4f46e5',borderRadius:24,paddingVertical:14,
  },
  btnTxt:{ marginLeft:6,color:'#fff',fontSize:15,fontWeight:'600' },

  sub:{ color:'#cbd5e1',fontSize:16,fontWeight:'600',marginTop:32,marginBottom:12 },

  mealRow:{
    flexDirection:'row',justifyContent:'space-between',
    backgroundColor:'rgba(255,255,255,0.15)',borderRadius:18,padding:14,marginBottom:10
  },
  mealName:{ color:'#fff',fontWeight:'600',flex:1 },
  mealKcal:{ color:'#e5e7eb' },
});
