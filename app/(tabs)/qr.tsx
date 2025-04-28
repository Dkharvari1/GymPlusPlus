import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function QRScreen() {
  return (
    <LinearGradient
      colors={['#312e81', '#4f46e5', '#7c3aed']}
      style={styles.bg}
    >
      <View style={styles.center}>
        <MaterialCommunityIcons name="qrcode-scan" size={96} color="#fff" />
        <Text style={styles.msg}>Show this QR at the gym front desk.</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  msg: { fontSize: 16, color: '#e0e7ff', marginTop: 16, textAlign: 'center' },
});
