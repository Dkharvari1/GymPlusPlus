import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { auth, db } from '../../../lib/firebaseConfig';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

/* ── types ─────────────────────────────────────────────────── */
type Food = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
};
type UserPrefs = { goals?: string[]; diet?: string | null };

/* ── helpers ───────────────────────────────────────────────── */
const MUSCLE_GOALS = [
  'Gain muscle', 'Increase strength', 'Powerlifting', 'Bodybuilding',
] as const;
const WEIGHT_LOSS_GOALS = ['Lose weight', 'Maintain weight'] as const;

const isMeat       = (n: string) => /chicken|beef|turkey|pork|bacon|steak|sirloin/i.test(n);
const isSeafood    = (n: string) => /salmon|shrimp|tuna|cod|trout/i.test(n);
const isDairyOrEgg = (n: string) => /milk|cheese|yogurt|egg|butter|cottage/i.test(n);

/* ── diet filter ───────────────────────────────────────────── */
function allowedByDiet(food: Food, diet?: string | null) {
  switch (diet) {
    case 'Vegetarian':   return !isMeat(food.name);
    case 'Vegan':        return !isMeat(food.name) && !isDairyOrEgg(food.name);
    case 'Pescatarian':  return !isMeat(food.name) || isSeafood(food.name);
    case 'Low-carb':
    case 'Ketogenic':    return (food.carbs ?? 0) <= 10;
    /* diets that don’t prohibit foods outright */
    default:             return true;
  }
}

/* ── scoring ───────────────────────────────────────────────── */
function score(food: Food, prefs: UserPrefs) {
  const proto = food.protein;
  const cal   = food.calories;
  let s = proto * 4 - cal / 40 + (food.fiber ?? 0);

  const mainGoal = prefs.goals?.[0] ?? '';
  if (MUSCLE_GOALS.includes(mainGoal as any) || prefs.diet === 'High-protein')
    s += proto * 2;
  if (WEIGHT_LOSS_GOALS.includes(mainGoal as any))
    s += (140 - cal) / 5;
  if (prefs.diet === 'Low-carb' || prefs.diet === 'Ketogenic')
    s -= (food.carbs ?? 0);

  return s;
}

/* ── component ─────────────────────────────────────────────── */
export default function RecommendFood() {
  const uid = auth.currentUser?.uid;
  const [foods, setFoods] = useState<Food[]>([]);
  const [prefs, setPrefs] = useState<UserPrefs>({});

  /* load catalog once */
  useEffect(() => { (async () => {
    const snap = await getDocs(collection(db, 'foods'));
    setFoods(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  })(); }, []);

  /* load user prefs once */
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists())
        setPrefs({ goals: snap.data().goals, diet: snap.data().diet });
    })();
  }, [uid]);

  /* compute top 20 recommendations */
  const picks = useMemo(() => {
    const filtered = foods.filter(f => allowedByDiet(f, prefs.diet));
    return filtered
      .map(f => ({ f, s: score(f, prefs) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map(x => x.f);
  }, [foods, prefs]);

  /* row renderer */
  const Row = ({ item }: { item: Food }) => (
    <Pressable
      style={styles.item}
      onPress={() =>
        router.push({ pathname: '/nutrition/log-meal', params: { prefill: item.name } })
      }
    >
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.meta}>{item.calories} kcal • {item.protein} g P</Text>
    </Pressable>
  );

  return (
    <LinearGradient colors={['#7c3aed', '#4f46e5', '#312e81']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.head}>
          <Pressable onPress={() => router.back()}>
            <MaterialCommunityIcons name="chevron-left" size={26} color="#fff" />
          </Pressable>
          <Text style={styles.h1}>Recommended Foods</Text>
        </View>

        {foods.length === 0 ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
        ) : picks.length === 0 ? (
          <Text style={styles.empty}>Nothing fits your diet just yet.</Text>
        ) : (
          <FlatList
            data={picks}
            keyExtractor={i => i.id}
            renderItem={Row}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ── styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', padding: 24, gap: 8 },
  h1:   { color: '#fff', fontSize: 20, fontWeight: '700' },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#fff',
  },
  name: { color: '#1e293b', fontWeight: '600', flex: 1 },
  meta: { color: '#1e293b', fontSize: 12, fontWeight: '500' },
  empty:{ color: '#fff', textAlign: 'center', marginTop: 40 },
});
