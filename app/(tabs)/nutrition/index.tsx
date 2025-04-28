import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { auth, db } from '../../../lib/firebaseConfig';
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  onSnapshot,
  updateDoc,
  increment,
} from 'firebase/firestore';

/* ── types & constants ──────────────────────────────────────────── */
type FoodCatalog = Record<
  string,
  { name: string; calories: number; protein: number }
>;
type Meal = { foodId: string; portions: number; type?: string };

const FILTERS = ['breakfast', 'lunch', 'dinner', 'snack', 'all'] as const;
type Filter = typeof FILTERS[number];

const MEAL_ORDER: Filter[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function NutritionHome() {
  const uid = auth.currentUser?.uid;

  const [dateId, setDateId]   = useState<string | null>(null);
  const [water, setWater]     = useState<number | undefined>();
  const [meals, setMeals]     = useState<Meal[]>([]);
  const [catalog, setCatalog] = useState<FoodCatalog>({});
  const [filter, setFilter]   = useState<Filter>('all');

  /* ── 1) latest day id ─────────────────────────────────────────── */
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const ref  = collection(db, 'users', uid, 'days');
      const snap = await getDocs(query(ref, orderBy('__name__', 'desc'), limit(1)));
      setDateId(snap.docs[0]?.id ?? null);
    })();
  }, [uid]);

  /* ── 2) food catalog ─────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'foods'));
      const map: FoodCatalog = {};
      snap.docs.forEach(d => { map[d.id] = d.data() as any; });
      setCatalog(map);
    })();
  }, []);

  /* ── 3) realtime meals & water ───────────────────────────────── */
  useEffect(() => {
    if (!uid || !dateId) return;
    return onSnapshot(doc(db, 'users', uid, 'days', dateId), s => {
      if (!s.exists()) return;
      const d: any = s.data();
      setWater(d.water);
      setMeals(Array.isArray(d.meals) ? d.meals : []);
    });
  }, [uid, dateId]);

  /* ── 4) filtering & totals ───────────────────────────────────── */
  const filteredMeals = useMemo(() =>
    filter === 'all' ? meals : meals.filter(m => (m.type ?? 'all') === filter),
  [meals, filter]);

  const { calories, protein } = useMemo(() => {
    let cal = 0, pro = 0;
    for (const m of filteredMeals) {
      const f = catalog[m.foodId];
      if (!f) continue;
      cal += f.calories * m.portions;
      pro += f.protein  * m.portions;
    }
    return { calories: cal, protein: pro };
  }, [filteredMeals, catalog]);

  /* ── actions ─────────────────────────────────────────────────── */
  const addWater = async () => {
    if (!uid || !dateId) return;
    await updateDoc(doc(db, 'users', uid, 'days', dateId), { water: increment(250) });
  };

  const deleteMeal = async (idx: number) => {
    if (!uid || !dateId) return;
    const next = meals.filter((_, i) => i !== idx);
    await updateDoc(doc(db, 'users', uid, 'days', dateId), { meals: next });
  };

  /* ── helper for metric row ───────────────────────────────────── */
  const metric = (label: string, icon: any, val?: number, unit?: string) => (
    <View style={styles.metricBox}>
      <MaterialCommunityIcons name={icon} size={20} color="#fff" />
      <Text style={styles.metricLbl}>{label}</Text>
      {val === undefined
        ? <ActivityIndicator color="#fff" />
        : <Text style={styles.metricVal}>{val} {unit}</Text>}
    </View>
  );

  /* ── UI ───────────────────────────────────────────────────────── */
  return (
    <LinearGradient colors={['#7c3aed', '#4f46e5', '#312e81']} style={styles.bg}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <Text style={styles.h1}>Nutrition • {dateId ?? 'loading…'}</Text>

        {/* filter pills */}
        <View style={styles.pillBar}>
          {FILTERS.map(p => (
            <Pressable
              key={p}
              onPress={() => setFilter(p)}
              style={[styles.pill, filter === p && styles.pillActive]}
            >
              <Text style={[styles.pillTxt, filter === p && styles.pillTxtActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {metric('Calories', 'fire',       calories, 'kcal')}
        {metric('Protein',  'food-steak', protein,  'g')}
        {metric('Water',    'cup-water',  water,    'ml')}

        <Pressable style={styles.waterBtn} onPress={addWater}>
          <MaterialCommunityIcons name="plus" size={14} color="#fff" />
          <Text style={styles.waterTxt}>+250 ml water</Text>
        </Pressable>

        <Pressable
          style={styles.btn}
          onPress={() =>
            router.push({ pathname: '/nutrition/log-meal', params: { day: dateId! } })
          }
          disabled={!dateId}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          <Text style={styles.btnTxt}>Log a meal</Text>
        </Pressable>

        {/* ── grouped meal list ──────────────────────────────────── */}
        {filteredMeals.length > 0 && (
          <>
            <Text style={styles.sub}>Meals today</Text>

            {MEAL_ORDER
              .filter(t => filter === 'all' ? true : t === filter)
              .map(type => {
                const group = filteredMeals.filter(m => (m.type ?? 'all') === type);
                if (group.length === 0) return null;

                return (
                  <View key={type} style={{ marginBottom: 18 }}>
                    <Text style={styles.groupHdr}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>

                    {group.map((m, i) => {
                      const f = catalog[m.foodId];
                      return (
                        <View key={i} style={styles.mealRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.mealName}>
                              {f ? f.name : 'Food'} × {m.portions}
                            </Text>
                            <Text style={styles.mealKcal}>
                              {f ? f.calories * m.portions : '?'} kcal
                            </Text>
                          </View>
                          <Pressable onPress={() => deleteMeal(meals.indexOf(m))}>
                            <MaterialCommunityIcons
                              name="trash-can-outline"
                              size={20}
                              color="#f87171"
                            />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

/* ── styles ───────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  bg: { flex: 1, paddingTop: 60, paddingHorizontal: 24 },
  h1: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 24 },

  pillBar:{ flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:18 },
  pill:{
    paddingHorizontal:14,paddingVertical:6,borderRadius:16,
    backgroundColor:'rgba(255,255,255,0.12)',
  },
  pillActive:{ backgroundColor:'#4f46e5' },
  pillTxt:{ color:'#e0e7ff',fontSize:13 },
  pillTxtActive:{ color:'#fff',fontWeight:'600' },

  metricBox:{ flexDirection:'row',alignItems:'center',marginBottom:14 },
  metricLbl:{ color:'#e0e7ff',marginLeft:8,flex:1 },
  metricVal:{ color:'#fff',fontWeight:'600' },

  waterBtn:{
    alignSelf:'flex-end',marginTop:12,flexDirection:'row',alignItems:'center',
    backgroundColor:'#0ea5e9',borderRadius:18,paddingVertical:6,paddingHorizontal:12,
  },
  waterTxt:{ marginLeft:4,color:'#fff',fontSize:12,fontWeight:'600' },

  btn:{
    marginTop:32,flexDirection:'row',alignItems:'center',justifyContent:'center',
    backgroundColor:'#4f46e5',borderRadius:24,paddingVertical:14,
  },
  btnTxt:{ marginLeft:6,color:'#fff',fontSize:15,fontWeight:'600' },

  sub:{ color:'#cbd5e1',fontSize:16,fontWeight:'600',marginTop:32,marginBottom:12 },

  groupHdr:{ color:'#a5b4fc',fontSize:15,fontWeight:'600',marginBottom:6 },

  mealRow:{
    flexDirection:'row',alignItems:'center',gap:14,
    backgroundColor:'rgba(255,255,255,0.15)',borderRadius:18,padding:14,marginBottom:10
  },
  mealName:{ color:'#fff',fontWeight:'600' },
  mealKcal:{ color:'#e5e7eb',fontSize:12 },
});
