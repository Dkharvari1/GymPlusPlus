// app/(tabs)/nutrition/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { auth, db } from "../../../lib/firebaseConfig";
import {
  Timestamp,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";

/* ── helper to format YYYY‑MM‑DD in LOCAL time ───────────────── */
const buildDayId = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

/* ── types & constants ──────────────────────────────────────── */
type FoodCatalog = Record<
  string,
  { name: string; calories: number; protein: number }
>;
type Meal = {
  foodId: string;
  portions: number;
  type?: "breakfast" | "lunch" | "dinner" | "snack";
};

const FILTERS = ["breakfast", "lunch", "dinner", "snack", "all"] as const;
type Filter = (typeof FILTERS)[number];
const MEAL_ORDER: Filter[] = ["breakfast", "lunch", "dinner", "snack"];

/* ───────────────────────────────────────────────────────────── */
export default function NutritionHome() {
  const uid = auth.currentUser?.uid;

  /* ── state ────────────────────────────────────────────────── */
  const [dateId, setDateId] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [water, setWater] = useState<number | undefined>();
  const [waterInput, setWaterInput] = useState("250");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [catalog, setCatalog] = useState<FoodCatalog>({});
  const [filter, setFilter] = useState<Filter>("all");

  /* new‑day modal */
  const [modalOpen, setModalOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());

  /* ── 1) Ensure TODAY exists, then load day list ───────────── */
  useEffect(() => {
    if (!uid) return;

    (async () => {
      const todayId = buildDayId(new Date());
      const colRef = collection(db, "users", uid, "days");

      // fetch all day IDs, newest first
      const snap = await getDocs(query(colRef, orderBy("__name__", "desc")));
      let ids = snap.docs.map((d) => d.id);

      // seed today if missing
      if (!ids.includes(todayId)) {
        await setDoc(
          doc(db, "users", uid, "days", todayId),
          {
            calories: 0,
            protein: 0,
            water: 0,
            meals: [],
            createdAt: Timestamp.now(),
          },
          { merge: true },
        );
        ids = [todayId, ...ids];
      }

      setDays(ids);
      setDateId(todayId);
    })();
  }, [uid]);

  /* ── 2) LIVE food catalog listener ────────────────────────── */
  useEffect(() => {
    const off = onSnapshot(collection(db, "foods"), (snap) => {
      const map: FoodCatalog = {};
      snap.docs.forEach((d) => (map[d.id] = d.data() as any));
      setCatalog(map);
    });
    return off; // unsubscribe on unmount
  }, []);

  /* ── 3) meals + water for the selected day ────────────────── */
  useEffect(() => {
    if (!uid || !dateId) return;
    return onSnapshot(doc(db, "users", uid, "days", dateId), (s) => {
      if (!s.exists()) return;
      const d = s.data() as any;
      setWater(d.water);
      setMeals(Array.isArray(d.meals) ? d.meals : []);
    });
  }, [uid, dateId]);

  /* ── derived totals ──────────────────────────────────────── */
  const filteredMeals = useMemo(
    () =>
      filter === "all"
        ? meals
        : meals.filter((m) => (m.type ?? "all") === filter),
    [meals, filter],
  );

  const { calories, protein } = useMemo(() => {
    let c = 0,
      p = 0;
    for (const m of filteredMeals) {
      const f = catalog[m.foodId];
      if (!f) continue;
      c += f.calories * m.portions;
      p += f.protein * m.portions;
    }
    return { calories: c, protein: p };
  }, [filteredMeals, catalog]);

  /* ── helpers & actions ────────────────────────────────────── */
  const parseAmount = () => {
    const n = Math.max(0, Math.round(Number(waterInput)));
    return Number.isFinite(n) ? n : 0;
  };

  const changeWater = async (delta: number) => {
    if (!uid || !dateId || delta === 0) return;
    await updateDoc(doc(db, "users", uid, "days", dateId), {
      water: increment(delta),
    });
  };
  const addWater = () => changeWater(parseAmount());
  const removeWater = () => changeWater(-parseAmount());

  const deleteMeal = async (idx: number) => {
    if (!uid || !dateId) return;
    await updateDoc(doc(db, "users", uid, "days", dateId), {
      meals: arrayRemove(meals[idx]),
    });
  };

  const createDay = async () => {
    if (!uid) return;
    const id = buildDayId(pickerDate);
    const ref = doc(db, "users", uid, "days", id);

    if (!(await getDoc(ref)).exists()) {
      await setDoc(ref, {
        calories: 0,
        protein: 0,
        water: 0,
        meals: [],
        createdAt: Timestamp.now(),
      });
    }

    setModalOpen(false);
    setDays((cur) => (cur.includes(id) ? cur : [id, ...cur]));
    setDateId(id);
  };

  const confirmDeleteDay = () => {
    if (!uid || !dateId) return;
    Alert.alert("Delete this day?", "All meals and water will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "users", uid, "days", dateId));
          setDays((cur) => {
            const next = cur.filter((d) => d !== dateId);
            setDateId(next[0] ?? null);
            return next;
          });
        },
      },
    ]);
  };

  /* ── small metric box ─────────────────────────────────────── */
  const Metric = ({
    label,
    icon,
    val,
    unit,
  }: {
    label: string;
    icon: any;
    val?: number;
    unit?: string;
  }) => (
    <View style={styles.metricBox}>
      <MaterialCommunityIcons name={icon} size={20} color="#fff" />
      <Text style={styles.metricLbl}>{label}</Text>
      {val === undefined ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.metricVal}>
          {val} {unit}
        </Text>
      )}
    </View>
  );

  /* ── UI ───────────────────────────────────────────────────── */
  return (
    <>
      <LinearGradient colors={["#7c3aed", "#4f46e5", "#312e81"]} style={styles.bg}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {/* header */}
          <View style={styles.headerRow}>
            <Text style={styles.h1}>
              {dateId ? `Nutrition • ${dateId}` : "No day selected"}
            </Text>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setModalOpen(true)}
            >
              <MaterialCommunityIcons name="calendar-plus" size={20} color="#fff" />
            </TouchableOpacity>
            {dateId && (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={confirmDeleteDay}
              >
                <MaterialCommunityIcons
                  name="trash-can"
                  size={20}
                  color="#fca5a5"
                />
              </TouchableOpacity>
            )}
          </View>

          {/* filter pills */}
          <View style={styles.pillBar}>
            {FILTERS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setFilter(p)}
                style={[styles.pill, filter === p && styles.pillActive]}
              >
                <Text
                  style={[styles.pillTxt, filter === p && styles.pillTxtActive]}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Metric label="Calories" icon="fire" val={calories} unit="kcal" />
          <Metric label="Protein" icon="food-steak" val={protein} unit="g" />
          <Metric label="Water" icon="cup-water" val={water} unit="ml" />

          {/* water controls */}
          <View style={styles.waterRow}>
            <TextInput
              style={styles.waterInput}
              value={waterInput}
              onChangeText={setWaterInput}
              keyboardType="number-pad"
              placeholder="ml"
              placeholderTextColor="#cbd5e1"
            />
            <Pressable
              style={styles.waterAdd}
              onPress={addWater}
              disabled={!dateId}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#fff" />
            </Pressable>
            <Pressable
              style={styles.waterSub}
              onPress={removeWater}
              disabled={!dateId}
            >
              <MaterialCommunityIcons name="minus" size={16} color="#fff" />
            </Pressable>
          </View>

          {/* log meal button */}
          <Pressable
            style={styles.btn}
            disabled={!dateId}
            onPress={() =>
              router.push({
                pathname: "/nutrition/log-meal",
                params: { day: dateId! },
              })
            }
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            <Text style={styles.btnTxt}>Log a meal</Text>
          </Pressable>

          {/* meal list */}
          {filteredMeals.length > 0 && (
            <>
              <Text style={styles.sub}>Meals&nbsp;today</Text>
              {MEAL_ORDER.filter((t) =>
                filter === "all" ? true : t === filter,
              ).map((type) => {
                const group = filteredMeals.filter(
                  (m) => (m.type ?? "all") === type,
                );
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
                              {f ? f.name : "Food"} × {m.portions}
                            </Text>
                            <Text style={styles.mealKcal}>
                              {f ? f.calories * m.portions : "?"} kcal
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => deleteMeal(meals.indexOf(m))}
                          >
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

      {/* modal for new day */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select a date</Text>

            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_, d) => d && setPickerDate(d)}
              maximumDate={new Date(2100, 11, 31)}
              minimumDate={new Date(2020, 0, 1)}
              style={{ alignSelf: "center" }}
            />

            <View style={styles.modalBtns}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setModalOpen(false)}
              >
                <Text style={styles.modalCancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={createDay}>
                <Text style={styles.modalSaveTxt}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

/* ── styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  bg: { flex: 1, paddingTop: 60, paddingHorizontal: 24 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  h1: { flex: 1, color: "#fff", fontSize: 26, fontWeight: "700" },
  iconBtn: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginLeft: 8,
  },
  pillBar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  pillActive: { backgroundColor: "#4f46e5" },
  pillTxt: { color: "#e0e7ff", fontSize: 13 },
  pillTxtActive: { color: "#fff", fontWeight: "600" },
  metricBox: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  metricLbl: { color: "#e0e7ff", marginLeft: 8, flex: 1 },
  metricVal: { color: "#fff", fontWeight: "600" },
  waterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-end",
    marginTop: 10,
    marginBottom: 6,
  },
  waterInput: {
    minWidth: 60,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#fff",
    textAlign: "center",
    fontSize: 13,
  },
  waterAdd: { backgroundColor: "#22c55e", padding: 8, borderRadius: 14 },
  waterSub: { backgroundColor: "#ef4444", padding: 8, borderRadius: 14 },
  btn: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4f46e5",
    borderRadius: 24,
    paddingVertical: 14,
  },
  btnTxt: { marginLeft: 6, color: "#fff", fontSize: 15, fontWeight: "600" },
  sub: {
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 32,
    marginBottom: 12,
  },
  groupHdr: { color: "#a5b4fc", fontSize: 15, fontWeight: "600", marginBottom: 6 },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  mealName: { color: "#fff", fontWeight: "600" },
  mealKcal: { color: "#e5e7eb", fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  modalCard: {
    width: "100%",
    borderRadius: 22,
    padding: 24,
    backgroundColor: "#1e1b4b",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 18,
    alignSelf: "center",
  },
  modalBtns: { flexDirection: "row", justifyContent: "flex-end", marginTop: 24 },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginRight: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modalSave: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#4f46e5",
  },
  modalCancelTxt: { color: "#94a3b8", fontWeight: "600" },
  modalSaveTxt: { color: "#fff", fontWeight: "600" },
});
