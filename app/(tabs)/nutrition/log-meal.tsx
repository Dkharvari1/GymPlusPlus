// app/(tabs)/nutrition/log-meal.tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { auth, db } from "../../../lib/firebaseConfig";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { format } from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ── favourites hook (per-user) ───────────────────────────────── */
function useFavorites(uid: string | null | undefined) {
  const key = uid ? `@favFoods:${uid}` : "@favFoods:anon";
  const [favs, setFavs] = useState<Set<string>>(new Set());

  /* load when uid changes */
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(key);
      setFavs(raw ? new Set(JSON.parse(raw)) : new Set());
    })();
  }, [key]);

  /* toggle & persist */
  const toggle = async (id: string) => {
    const next = new Set(favs);
    next.has(id) ? next.delete(id) : next.add(id);
    setFavs(next);
    await AsyncStorage.setItem(key, JSON.stringify([...next]));
  };

  return { favs, toggle };
}

/* ── types & constants ───────────────────────────────────────── */
type Food = { id: string; name: string; calories: number; protein: number };
type MealType = "breakfast" | "lunch" | "dinner" | "snack";
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

/* ─────────────────────────────────────────────────────────────── */
export default function LogMeal() {
  const uid = auth.currentUser?.uid ?? null;
  const { day } = useLocalSearchParams<{ day?: string }>();
  const dateId = day ?? format(new Date(), "yyyy-MM-dd");

  /* state */
  const { favs, toggle } = useFavorites(uid);
  const [foods, setFoods] = useState<Food[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Food | null>(null);
  const [portion, setPort] = useState("1");
  const [mealType, setMealType] = useState<MealType>("breakfast");

  /* fetch foods */
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "foods"));
      setFoods(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Food, "id">) })));
    })();
  }, []);

  const favList = foods.filter((f) => favs.has(f.id));
  const results =
    q.length < 2 ? [] : foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));

  /* ── submit meal ───────────────────────────────────────────── */
  const submit = async () => {
    if (!uid || !sel) return;
    const portions = Number(portion) || 1;
    const ref = doc(db, "users", uid, "days", dateId);

    /* ensure day doc exists */
    const snap = await getDoc(ref);
    if (!snap.exists()) await setDoc(ref, { water: 0, meals: [] });

    /* push new meal */
    await updateDoc(ref, {
      meals: [
        ...(snap.exists() && Array.isArray(snap.data().meals) ? snap.data().meals : []),
        { foodId: sel.id, portions, type: mealType },
      ],
    });
    router.back();
  };

  /* ── helpers ───────────────────────────────────────────────── */
  const FoodRow = ({ food }: { food: Food }) => (
    <Pressable style={s.item} onPress={() => setSel(food)}>
      <Text style={s.itemTxt}>{food.name}</Text>
      <MaterialCommunityIcons
        name={favs.has(food.id) ? "heart" : "heart-outline"}
        size={20}
        color="#ef4444"
        onPress={() => toggle(food.id)}
      />
    </Pressable>
  );

  /* ── UI ─────────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
        </Pressable>
        <Text style={s.h1}>Log a Meal</Text>
      </View>

      <TextInput
        placeholder="Search food…"
        placeholderTextColor="#9ca3af"
        style={s.search}
        value={q}
        onChangeText={(t) => {
          setQ(t);
          setSel(null);
        }}
      />

      {/* favourites */}
      {q.length < 2 && favList.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={s.favLbl}>Favorites</Text>
          {favList.map((f) => (
            <FoodRow key={f.id} food={f} />
          ))}
        </View>
      )}

      {/* search results */}
      {!sel && q.length >= 2 && (
        results.length === 0 ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(f) => f.id}
            renderItem={({ item }) => <FoodRow food={item} />}
          />
        )
      )}

      {/* confirmation card */}
      {sel && (
        <View style={s.card}>
          <Text style={s.name}>{sel.name}</Text>

          {/* meal-type pills */}
          <View style={s.pillBar}>
            {MEAL_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => setMealType(t)}
                style={[s.pill, mealType === t && s.pillActive]}
              >
                <Text style={[s.pillTxt, mealType === t && s.pillTxtActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            placeholder="1"
            placeholderTextColor="#9ca3af"
            style={s.portion}
            keyboardType="numeric"
            value={portion}
            onChangeText={setPort}
          />

          <View style={s.macroRow}>
            <Text style={s.macroTxt}>{sel.calories * (Number(portion) || 1)} kcal</Text>
            <Text style={s.macroTxt}>{sel.protein * (Number(portion) || 1)} g protein</Text>
          </View>

          <Pressable style={s.btn} onPress={submit}>
            <Text style={s.btnTxt}>Add to log</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

/* ── styles (unchanged) ───────────────────────────────────────── */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#312e81", padding: 24 },
  head: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  h1: { color: "#fff", fontSize: 20, fontWeight: "700", marginLeft: 8 },
  search: { backgroundColor: "#fff", borderRadius: 18, padding: 12, fontSize: 15, marginBottom: 16 },
  favLbl: { color: "#cbd5e1", marginBottom: 6, marginLeft: 6 },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
  },
  itemTxt: { color: "#1e293b", fontWeight: "600" },
  card: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 24, padding: 24 },
  name: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 20 },
  pillBar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)" },
  pillActive: { backgroundColor: "#4f46e5" },
  pillTxt: { color: "#e0e7ff", fontSize: 13 },
  pillTxtActive: { color: "#fff", fontWeight: "600" },
  portion: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    color: "#1e293b",
    marginBottom: 16,
    width: 120,
    textAlign: "center",
  },
  macroRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 24 },
  macroTxt: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btn: { backgroundColor: "#4f46e5", borderRadius: 18, paddingVertical: 14, alignItems: "center" },
  btnTxt: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
