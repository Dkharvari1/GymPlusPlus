import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function QRScreen() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={['#312e81', '#4f46e5', '#7c3aed']}
      style={styles.bg}
    >
      {/* back arrow */}
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
      </Pressable>

      {/* main content */}
      <View style={styles.center}>
        <MaterialCommunityIcons name="qrcode-scan" size={96} color="#fff" />
        <Text style={styles.msg}>Show this QR at the gym front desk.</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 34,
    left: 24,
    padding: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  msg: {
    fontSize: 16,
    color: '#e0e7ff',
    marginTop: 16,
    textAlign: 'center',
  },
});
