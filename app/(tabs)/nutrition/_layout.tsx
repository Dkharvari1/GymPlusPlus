import { Stack } from 'expo-router';

export default function NutritionStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,      // hide header; add later if you want back arrows
      }}
    />
  );
}
