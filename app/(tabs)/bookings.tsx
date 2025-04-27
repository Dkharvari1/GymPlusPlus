import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function BookingsScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.txt}>🗓️  Your upcoming bookings will appear here.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    txt: { fontSize: 16, color: '#475569', textAlign: 'center', paddingHorizontal: 32 },
});
