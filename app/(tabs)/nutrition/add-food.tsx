// app/(tabs)/nutrition/add-food.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../../lib/firebaseConfig";

// define a field shape so TS knows exactly what each item is
type Field = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  keyboardType: "default" | "numeric";
};

export default function AddFood() {
  const { name } = useLocalSearchParams<{ name?: string }>();

  const [foodName, setFoodName] = useState(name ?? "");
  const [calories, setCalories] = useState("");
  const [protein, setProtein]   = useState("");
  const [carbs,   setCarbs]     = useState("");
  const [fat,     setFat]       = useState("");

  // assemble your fields with explicit types
  const fields: Field[] = [
    { label: "Name", value: foodName, onChange: setFoodName, placeholder: "e.g. Greek Yogurt", keyboardType: "default" },
    { label: "Calories (per serving)", value: calories, onChange: setCalories, placeholder: "59", keyboardType: "numeric" },
    { label: "Protein (g per serving)", value: protein, onChange: setProtein, placeholder: "10", keyboardType: "numeric" },
    { label: "Carbs (g per serving)",   value: carbs,   onChange: setCarbs,   placeholder: "7",  keyboardType: "numeric" },
    { label: "Fat (g per serving)",     value: fat,     onChange: setFat,     placeholder: "0",  keyboardType: "numeric" },
  ];

  const ready = fields.every(f => f.value.trim().length > 0);
  const parseNum = (v: string) => parseFloat(v.replace(/,/g, "").trim()) || 0;

  const save = async () => {
    if (!ready) {
      Alert.alert("Missing fields", "Please fill out every field before saving.");
      return;
    }
    console.log("Hey!")
    await addDoc(collection(db, "foods"), {
      calories:  parseNum(calories),
      carbs:     parseNum(carbs),
      fat:       parseNum(fat),
      name:      foodName.trim(),
      protein:   parseNum(protein),
    });
    // send you back to LogMeal so you can immediately log it
    console.log("Hey@")
    router.replace("/nutrition/log-meal");
  };

  const checkifClicked = async() => {
    console.log("It got clicked")

  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={26} color="#fff" />
        </Pressable>
        <Text style={s.h1}>Add Food</Text>

        {fields.map(f => (
          <View key={f.label} style={{ marginBottom: 12 }}>
            <Text style={s.lbl}>{f.label}</Text>
            <TextInput
              placeholder={f.placeholder}
              placeholderTextColor="#a1a1aa"
              style={s.input}
              value={f.value}
              onChangeText={f.onChange}
              keyboardType={f.keyboardType}
            />
          </View>
        ))}

        <Pressable
          style={[s.btn, !ready && { opacity: 0.4 }]}
          disabled={!ready}
          onPress={save}
        >
          <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
          <Text style={s.btnTxt}>Save</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: "#312e81", padding: 24 },
  backBtn: { padding: 6, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14 },
  h1:      { color: "#fff", fontSize: 22, fontWeight: "700", marginVertical: 18 },
  lbl:     { color: "#a5b4fc", marginBottom: 6 },
  input:   {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#1e293b",
  },
  btn:     {
    marginTop: 32,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#4f46e5",
    borderRadius: 22,
    paddingVertical: 14,
  },
  btnTxt:  { color: "#fff", fontWeight: "700", marginLeft: 6, fontSize: 15 },
});
